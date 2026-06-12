from __future__ import annotations

import base64
import json
import os
import re
import urllib.error
import urllib.request
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Callable
from urllib.parse import parse_qsl, unquote, urlencode, urlparse, urlsplit, urlunsplit


HttpRequest = Callable[[str, str, dict[str, str] | None], "SimpleFinHttpResponse"]
SIMPLEFIN_USER_AGENT = "FinSight/0.1 SimpleFIN local client"
SIMPLEFIN_TRANSACTION_LOOKBACK_DAYS = 45
SIMPLEFIN_INITIAL_BACKFILL_DAYS = 365


class SimpleFinError(Exception):
    pass


@dataclass
class SimpleFinHttpResponse:
    status_code: int
    body: Any


class SimpleFinCredentialStore:
    def __init__(self, path: str | Path | None = None):
        configured_path = path or os.getenv("FINSIGHT_SIMPLEFIN_CREDENTIAL_PATH")
        self.path = Path(configured_path) if configured_path else Path.home() / ".finsight" / "simplefin_credentials.json"

    def has_access_url(self) -> bool:
        return bool(self.load_state().get("access_url"))

    def load_access_url(self) -> str | None:
        value = self.load_state().get("access_url")
        return value if isinstance(value, str) and value else None

    def save_access_url(self, access_url: str) -> None:
        state = self.load_state()
        state.update({"access_url": access_url, "has_credentials": True})
        self.save_state(state)

    def clear_access_url(self) -> None:
        state = self.load_state()
        state.pop("access_url", None)
        state["has_credentials"] = False
        self.save_state(state)

    def load_state(self) -> dict[str, Any]:
        if not self.path.exists():
            return {}
        try:
            data = json.loads(self.path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            return {}
        return data if isinstance(data, dict) else {}

    def save_state(self, state: dict[str, Any]) -> None:
        self.path.parent.mkdir(mode=0o700, parents=True, exist_ok=True)
        try:
            os.chmod(self.path.parent, 0o700)
        except OSError:
            pass
        payload = json.dumps(state, indent=2, sort_keys=True)
        flags = os.O_WRONLY | os.O_CREAT | os.O_TRUNC
        descriptor = os.open(self.path, flags, 0o600)
        with os.fdopen(descriptor, "w", encoding="utf-8") as handle:
            handle.write(payload)
        try:
            os.chmod(self.path, 0o600)
        except OSError:
            pass


class SimpleFinClient:
    def __init__(self, http_request: HttpRequest | None = None):
        self.http_request = http_request or _default_http_request

    def claim_setup_token(self, setup_token: str) -> str:
        claim_url = _decode_setup_token(setup_token)
        _require_https(claim_url, "SimpleFIN setup token URL")
        response = self.http_request(
            "POST",
            claim_url,
            {
                "Accept": "text/plain, application/json",
                "Content-Length": "0",
                "User-Agent": SIMPLEFIN_USER_AGENT,
            },
        )
        if response.status_code != 200:
            raise SimpleFinError(_sanitize_error(f"SimpleFIN claim failed with {response.status_code}: {response.body}"))
        access_url = str(response.body).strip()
        _require_https(access_url, "SimpleFIN access URL")
        return access_url

    def fetch_accounts(
        self,
        access_url: str,
        synced_at: str | None = None,
        start_at: datetime | None = None,
        end_at: datetime | None = None,
    ) -> dict[str, Any]:
        _require_https(access_url, "SimpleFIN access URL")
        request_url, auth_header = _build_simplefin_accounts_request(access_url, synced_at, start_at, end_at)
        headers = {
            "Accept": "application/json",
            "User-Agent": SIMPLEFIN_USER_AGENT,
        }
        if auth_header:
            headers["Authorization"] = auth_header
        response = self.http_request(
            "GET",
            request_url,
            headers,
        )
        if response.status_code != 200:
            raise SimpleFinError(_sanitize_error(f"SimpleFIN accounts sync failed with {response.status_code}: {response.body}"))
        if not isinstance(response.body, dict):
            raise SimpleFinError("SimpleFIN accounts sync returned an invalid response.")
        errlist = response.body.get("errlist") or []
        fatal_errors = [error for error in errlist if not _is_nonfatal_accounts_warning(error, response.body)]
        if fatal_errors:
            raise SimpleFinError(_sanitize_error(f"SimpleFIN accounts sync returned errors: {fatal_errors}"))
        return response.body


class SimpleFinService:
    provider = "simplefin"
    mode = "real"

    def __init__(
        self,
        client: SimpleFinClient | None = None,
        credential_store: SimpleFinCredentialStore | None = None,
        now: Callable[[], str] | None = None,
    ):
        self.client = client or SimpleFinClient()
        self.credential_store = credential_store or SimpleFinCredentialStore()
        self.now = now or _utc_now

    def status(self) -> dict[str, Any]:
        state = self.credential_store.load_state()
        has_credentials = self.credential_store.has_access_url()
        status = str(state.get("status") or ("connected" if has_credentials else "unconfigured"))
        if status == "disconnected" and has_credentials:
            status = "connected"
        message = str(state.get("message") or _message_for_status(status, has_credentials))
        return self._response(status=status, message=message, state=state)

    def connect(self, setup_token: str | None, store: Any | None = None) -> dict[str, Any]:
        if not setup_token:
            state = self.credential_store.load_state()
            state.update(
                {
                    "status": "unconfigured",
                    "message": "Add a SimpleFIN setup token to create a local connection.",
                    "last_error": None,
                    "next_retry_at": None,
                }
            )
            self.credential_store.save_state(state)
            return self._response(status="unconfigured", message=state["message"], state=state)

        try:
            access_url = self.client.claim_setup_token(setup_token)
        except SimpleFinError as error:
            return self._record_error(error)

        synced_at = self.now()
        try:
            if store is not None:
                end_at = _parse_sync_datetime(synced_at)
                self._sync_windows(store, access_url, synced_at, _initial_backfill_windows(end_at))
                _reclassify_store_transactions(store)
        except SimpleFinError as error:
            state = self.credential_store.load_state()
            state.update({"access_url": access_url, "has_credentials": True})
            self.credential_store.save_state(state)
            return self._record_error(error)

        coverage = store.simplefin_transaction_coverage() if store is not None and hasattr(store, "simplefin_transaction_coverage") else {"start_date": None, "end_date": None}
        state = self.credential_store.load_state()
        state.update(
            {
                "access_url": access_url,
                "has_credentials": True,
                "status": "connected",
                "message": "SimpleFIN connection saved locally.",
                "last_synced_at": synced_at if store is not None else state.get("last_synced_at"),
                "backfill_completed_at": synced_at if store is not None else state.get("backfill_completed_at"),
                "transaction_coverage_start": coverage.get("start_date"),
                "transaction_coverage_end": coverage.get("end_date"),
                "last_error": None,
                "retry_count": 0,
                "next_retry_at": None,
            }
        )
        self.credential_store.save_state(state)
        return self._response(status="connected", message=state["message"], state=state)

    def sync(self, store: Any) -> dict[str, Any]:
        access_url = self.credential_store.load_access_url()
        if not access_url:
            state = self.credential_store.load_state()
            state.update({"status": "unconfigured", "message": "Connect SimpleFIN before syncing."})
            self.credential_store.save_state(state)
            return self._response(status="unconfigured", message=state["message"], state=state)

        try:
            synced_at = self.now()
            end_at = _parse_sync_datetime(synced_at)
            existing_coverage = store.simplefin_transaction_coverage() if hasattr(store, "simplefin_transaction_coverage") else {"start_date": None, "end_date": None}
            should_backfill = not existing_coverage.get("start_date") or not existing_coverage.get("end_date")
            if should_backfill:
                self._sync_windows(store, access_url, synced_at, _initial_backfill_windows(end_at))
            else:
                start_at = end_at - timedelta(days=SIMPLEFIN_TRANSACTION_LOOKBACK_DAYS)
                self._sync_windows(store, access_url, synced_at, [(start_at, end_at)])
            _reclassify_store_transactions(store)
        except SimpleFinError as error:
            return self._record_error(error)

        coverage = store.simplefin_transaction_coverage() if hasattr(store, "simplefin_transaction_coverage") else {"start_date": None, "end_date": None}
        state = self.credential_store.load_state()
        state.update(
            {
                "status": "synced",
                "message": "SimpleFIN sync complete.",
                "last_synced_at": synced_at,
                "backfill_completed_at": synced_at if should_backfill else state.get("backfill_completed_at"),
                "transaction_coverage_start": coverage.get("start_date"),
                "transaction_coverage_end": coverage.get("end_date"),
                "last_error": None,
                "retry_count": 0,
                "next_retry_at": None,
            }
        )
        self.credential_store.save_state(state)
        return self._response(status="synced", message=state["message"], state=state)

    def _sync_windows(self, store: Any, access_url: str, synced_at: str, windows: list[tuple[datetime, datetime]]) -> None:
        for start_at, end_at in windows:
            account_set = self.client.fetch_accounts(access_url, synced_at, start_at, end_at)
            store.import_simplefin_account_set(
                account_set,
                synced_at,
                coverage_start=start_at.date().isoformat(),
                coverage_end=end_at.date().isoformat(),
            )

    def disconnect(self) -> dict[str, Any]:
        self.credential_store.clear_access_url()
        state = self.credential_store.load_state()
        state.update(
            {
                "status": "disconnected",
                "message": "SimpleFIN credentials removed from local storage.",
                "last_error": None,
                "next_retry_at": None,
                "has_credentials": False,
            }
        )
        self.credential_store.save_state(state)
        return self._response(status="disconnected", message=state["message"], state=state)

    def _record_error(self, error: Exception) -> dict[str, Any]:
        state = self.credential_store.load_state()
        retry_count = int(state.get("retry_count") or 0) + 1
        state.update(
            {
                "status": "error",
                "message": "SimpleFIN needs attention.",
                "last_error": _sanitize_error(str(error)),
                "retry_count": retry_count,
                "next_retry_at": _retry_after(self.now(), retry_count),
            }
        )
        self.credential_store.save_state(state)
        return self._response(status="error", message=state["message"], state=state)

    def _response(self, status: str, message: str, state: dict[str, Any]) -> dict[str, Any]:
        return {
            "provider": self.provider,
            "status": status,
            "mode": self.mode,
            "message": message,
            "has_credentials": self.credential_store.has_access_url(),
            "last_synced_at": state.get("last_synced_at"),
            "backfill_completed_at": state.get("backfill_completed_at"),
            "transaction_coverage_start": state.get("transaction_coverage_start"),
            "transaction_coverage_end": state.get("transaction_coverage_end"),
            "last_error": state.get("last_error"),
            "retry_count": int(state.get("retry_count") or 0),
            "next_retry_at": state.get("next_retry_at"),
        }


def _default_http_request(method: str, url: str, headers: dict[str, str] | None = None) -> SimpleFinHttpResponse:
    request = urllib.request.Request(url, method=method, data=b"" if method == "POST" else None, headers=headers or {})
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            text = response.read().decode("utf-8")
            return SimpleFinHttpResponse(status_code=response.status, body=_parse_body(text))
    except urllib.error.HTTPError as error:
        text = error.read().decode("utf-8", errors="replace")
        return SimpleFinHttpResponse(status_code=error.code, body=_parse_body(text))
    except urllib.error.URLError as error:
        raise SimpleFinError(_sanitize_error(f"SimpleFIN request failed: {error.reason}")) from error


def _parse_body(text: str) -> Any:
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        return text


def _decode_setup_token(setup_token: str) -> str:
    token = setup_token.strip()
    padding = "=" * (-len(token) % 4)
    try:
        decoded = base64.urlsafe_b64decode((token + padding).encode("ascii")).decode("utf-8")
    except (UnicodeDecodeError, ValueError) as error:
        raise SimpleFinError("SimpleFIN setup token is invalid.") from error
    return decoded


def _require_https(url: str, label: str) -> None:
    parsed = urlparse(url)
    if parsed.scheme != "https" or not parsed.netloc:
        raise SimpleFinError(f"{label} must be an HTTPS URL.")


def _build_simplefin_accounts_request(
    access_url: str,
    synced_at: str | None = None,
    start_at: datetime | None = None,
    end_at: datetime | None = None,
) -> tuple[str, str | None]:
    parsed = urlsplit(f"{access_url.rstrip('/')}/accounts")
    if not parsed.hostname:
        raise SimpleFinError("SimpleFIN access URL is invalid.")

    host = parsed.hostname
    if parsed.port:
        host = f"{host}:{parsed.port}"

    auth_header = None
    if parsed.username is not None:
        username = unquote(parsed.username)
        password = unquote(parsed.password or "")
        credentials = base64.b64encode(f"{username}:{password}".encode("utf-8")).decode("ascii")
        auth_header = f"Basic {credentials}"

    query = _accounts_query(parsed.query, synced_at, start_at, end_at)
    safe_url = urlunsplit((parsed.scheme, host, parsed.path, query, parsed.fragment))
    return safe_url, auth_header


def _accounts_query(existing_query: str, synced_at: str | None, start_at: datetime | None = None, end_at: datetime | None = None) -> str:
    managed_keys = {"version", "start-date", "end-date", "pending", "balances-only"}
    query_pairs = [(key, value) for key, value in parse_qsl(existing_query, keep_blank_values=True) if key not in managed_keys]
    end_at = end_at or _parse_sync_datetime(synced_at)
    start_at = start_at or (end_at - timedelta(days=SIMPLEFIN_TRANSACTION_LOOKBACK_DAYS))
    query_pairs.extend(
        [
            ("version", "2"),
            ("start-date", str(int(start_at.timestamp()))),
            ("end-date", str(int(end_at.timestamp()))),
            ("pending", "1"),
        ]
    )
    return urlencode(query_pairs)


def _initial_backfill_windows(end_at: datetime) -> list[tuple[datetime, datetime]]:
    start_at = end_at - timedelta(days=SIMPLEFIN_INITIAL_BACKFILL_DAYS)
    windows: list[tuple[datetime, datetime]] = []
    cursor = start_at
    while cursor < end_at:
        window_end = min(cursor + timedelta(days=SIMPLEFIN_TRANSACTION_LOOKBACK_DAYS), end_at)
        windows.append((cursor, window_end))
        cursor = window_end
    return windows


def _parse_sync_datetime(value: str | None) -> datetime:
    if not value:
        return datetime.now(timezone.utc)
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return datetime.now(timezone.utc)
    if parsed.tzinfo is None:
        return parsed.replace(tzinfo=timezone.utc)
    return parsed.astimezone(timezone.utc)


def _is_nonfatal_accounts_warning(error: Any, body: dict[str, Any]) -> bool:
    if not isinstance(error, dict):
        return False
    if error.get("code") != "gen.api":
        return False
    message = str(error.get("msg") or error.get("message") or "").lower()
    return bool(body.get("accounts")) and "date range" in message and "45 days" in message


def _sanitize_error(message: str) -> str:
    sanitized = re.sub(r"https://\S+", "[redacted-url]", message)
    sanitized = re.sub(r"//[^/@\s:]+:[^/@\s]+@", "//[redacted]@", sanitized)
    return sanitized


def _retry_after(now_value: str, retry_count: int) -> str:
    try:
        base = datetime.fromisoformat(now_value)
    except ValueError:
        base = datetime.now(timezone.utc)
    delay_minutes = min(60, 2 ** max(retry_count - 1, 0))
    return (base + timedelta(minutes=delay_minutes)).isoformat()


def _message_for_status(status: str, has_credentials: bool) -> str:
    if status == "synced":
        return "SimpleFIN sync complete."
    if status == "connected" or has_credentials:
        return "SimpleFIN connection saved locally."
    if status == "error":
        return "SimpleFIN needs attention."
    if status == "disconnected":
        return "SimpleFIN credentials removed from local storage."
    return "Add a SimpleFIN setup token to create a local connection."


def _reclassify_store_transactions(store: Any) -> None:
    if hasattr(store, "reclassify_transactions"):
        store.reclassify_transactions()


def _utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()
