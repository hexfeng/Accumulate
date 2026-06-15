import csv
from io import StringIO
from datetime import UTC, datetime
from typing import Any
from urllib.error import URLError
from urllib.request import urlopen

from app.domain.schemas import MarketQuote, SecuritySearchResult


class MarketDataError(RuntimeError):
    pass


_SYMBOL_DIRECTORY_CACHE: list[SecuritySearchResult] | None = None
_NASDAQ_LISTED_URL = "https://www.nasdaqtrader.com/dynamic/SymDir/nasdaqlisted.txt"
_OTHER_LISTED_URL = "https://www.nasdaqtrader.com/dynamic/SymDir/otherlisted.txt"
_EXCHANGE_NAMES = {
    "A": "NYSE American",
    "N": "NYSE",
    "P": "NYSE Arca",
    "Q": "NASDAQ",
    "V": "IEX",
    "Z": "Cboe BZX",
}


class YahooFinanceQuoteService:
    provider = "yfinance"

    quote_types = {"EQUITY", "ETF"}

    def search(self, query: str, max_results: int = 10) -> list[SecuritySearchResult]:
        normalized_query = query.strip().upper()
        if not normalized_query:
            return []
        try:
            import yfinance as yf
        except ImportError as error:
            raise MarketDataError("yfinance is not installed. Run pip install -r apps/api/requirements.txt.") from error

        results_by_symbol: dict[str, SecuritySearchResult] = {}
        for search_query in _search_queries(normalized_query):
            for quote in _search_yfinance(yf, search_query, max_results * 3, normalized_query):
                result = _quote_to_search_result(quote, self.provider)
                if result and _matches_search(result, normalized_query):
                    results_by_symbol.setdefault(result.symbol, result)

        for catalog_result in _search_symbol_catalog(normalized_query, max_results * 3):
            result = SecuritySearchResult.model_validate(catalog_result)
            results_by_symbol.setdefault(result.symbol, result)

        prefix_candidates = [
            result for result in results_by_symbol.values()
            if "." not in result.symbol and result.symbol.startswith(normalized_query) and 2 <= len(result.symbol) <= 5
        ][:6]
        for result in prefix_candidates:
            for suffix in (".NE",):
                suffix_symbol = f"{result.symbol}{suffix}"
                if suffix_symbol in results_by_symbol:
                    continue
                for quote in _search_yfinance(yf, suffix_symbol, 1, normalized_query):
                    suffix_result = _quote_to_search_result(quote, self.provider)
                    if suffix_result and _matches_search(suffix_result, normalized_query):
                        results_by_symbol.setdefault(suffix_result.symbol, suffix_result)

        return sorted(results_by_symbol.values(), key=lambda result: _search_rank(result, normalized_query))[:max_results]

    def get_quote(self, symbol: str) -> MarketQuote:
        normalized_symbol = symbol.strip().upper()
        if not normalized_symbol:
            raise MarketDataError("Symbol is required.")
        try:
            import yfinance as yf
        except ImportError as error:
            raise MarketDataError("yfinance is not installed. Run pip install -r apps/api/requirements.txt.") from error

        try:
            ticker = yf.Ticker(normalized_symbol)
            fast_info = dict(getattr(ticker, "fast_info", {}) or {})
            price = _first_number(
                fast_info,
                "last_price",
                "lastPrice",
                "regular_market_price",
                "regularMarketPrice",
                "previous_close",
                "previousClose",
            )
            info = _safe_info(ticker)
        except Exception as error:
            raise MarketDataError(f"Could not fetch quote for {normalized_symbol}.") from error

        if price is None or price <= 0:
            raise MarketDataError(f"No market price was found for {normalized_symbol}.")

        name = str(info.get("longName") or info.get("shortName") or normalized_symbol)
        currency = str(fast_info.get("currency") or info.get("currency") or "CAD").upper()
        previous_close = _first_number(
            fast_info,
            "previous_close",
            "previousClose",
            "regular_market_previous_close",
            "regularMarketPreviousClose",
        )
        change_amount = round(price - previous_close, 4) if previous_close and previous_close > 0 else None
        change_pct = round((change_amount / previous_close) * 100, 4) if change_amount is not None and previous_close else None
        return MarketQuote(
            symbol=normalized_symbol,
            name=name,
            price=round(price, 4),
            currency=currency,
            change_amount=change_amount,
            change_pct=change_pct,
            provider=self.provider,
            as_of=datetime.now(UTC).isoformat(),
        )


def _safe_info(ticker: Any) -> dict[str, Any]:
    try:
        value = getattr(ticker, "info", {}) or {}
    except Exception:
        return {}
    return dict(value) if isinstance(value, dict) else {}


def _search_queries(normalized_query: str) -> list[str]:
    queries = [normalized_query]
    wildcard_query = f"{normalized_query}*"
    if wildcard_query not in queries:
        queries.append(wildcard_query)
    return queries


def _search_yfinance(yf: Any, query: str, max_results: int, normalized_query: str) -> list[dict[str, Any]]:
    try:
        search = yf.Search(
            query,
            max_results=max_results,
            news_count=0,
            lists_count=0,
            include_cb=False,
            raise_errors=False,
        )
    except Exception as error:
        raise MarketDataError(f"Could not search securities for {normalized_query}.") from error
    return list(getattr(search, "quotes", []) or [])


def _search_symbol_catalog(normalized_query: str, max_results: int) -> list[SecuritySearchResult]:
    catalog = _load_symbol_catalog()
    matches = [result for result in catalog if _matches_search(result, normalized_query)]
    return sorted(matches, key=lambda result: _search_rank(result, normalized_query))[:max_results]


def _load_symbol_catalog() -> list[SecuritySearchResult]:
    global _SYMBOL_DIRECTORY_CACHE
    if _SYMBOL_DIRECTORY_CACHE is not None:
        return _SYMBOL_DIRECTORY_CACHE

    try:
        catalog = [*_read_nasdaq_listed(), *_read_other_listed()]
    except (OSError, URLError, TimeoutError):
        catalog = []
    _SYMBOL_DIRECTORY_CACHE = catalog
    return catalog


def _read_nasdaq_listed() -> list[SecuritySearchResult]:
    rows = _read_pipe_delimited_url(_NASDAQ_LISTED_URL)
    results: list[SecuritySearchResult] = []
    for row in rows:
        symbol = (row.get("Symbol") or "").strip().upper()
        if not symbol or row.get("Test Issue") == "Y":
            continue
        is_etf = row.get("ETF") == "Y"
        results.append(
            SecuritySearchResult(
                symbol=symbol,
                name=(row.get("Security Name") or symbol).strip(),
                quote_type="ETF" if is_etf else "EQUITY",
                exchange="NASDAQ",
                currency="USD",
                provider="nasdaq-trader",
            )
        )
    return results


def _read_other_listed() -> list[SecuritySearchResult]:
    rows = _read_pipe_delimited_url(_OTHER_LISTED_URL)
    results: list[SecuritySearchResult] = []
    for row in rows:
        symbol = (row.get("NASDAQ Symbol") or row.get("ACT Symbol") or "").strip().upper()
        if not symbol or row.get("Test Issue") == "Y":
            continue
        is_etf = row.get("ETF") == "Y"
        exchange = _EXCHANGE_NAMES.get((row.get("Exchange") or "").strip().upper(), (row.get("Exchange") or "").strip())
        results.append(
            SecuritySearchResult(
                symbol=symbol,
                name=(row.get("Security Name") or symbol).strip(),
                quote_type="ETF" if is_etf else "EQUITY",
                exchange=exchange,
                currency="USD",
                provider="nasdaq-trader",
            )
        )
    return results


def _read_pipe_delimited_url(url: str) -> list[dict[str, str]]:
    with urlopen(url, timeout=8) as response:
        content = response.read().decode("utf-8", errors="replace")
    lines = [line for line in content.splitlines() if line and not line.startswith("File Creation Time")]
    return list(csv.DictReader(StringIO("\n".join(lines)), delimiter="|"))


def _quote_to_search_result(quote: dict[str, Any], provider: str) -> SecuritySearchResult | None:
    quote_type = str(quote.get("quoteType") or "").upper()
    symbol = str(quote.get("symbol") or "").upper()
    name = str(quote.get("longname") or quote.get("shortname") or symbol)
    if quote_type not in YahooFinanceQuoteService.quote_types or not symbol:
        return None
    return SecuritySearchResult(
        symbol=symbol,
        name=name,
        quote_type=quote_type,
        exchange=str(quote.get("exchDisp") or quote.get("exchange") or ""),
        currency=_guess_currency(symbol),
        provider=provider,
    )


def _matches_search(result: SecuritySearchResult, normalized_query: str) -> bool:
    haystacks = (result.symbol.upper(), result.name.upper())
    return any(normalized_query in value for value in haystacks)


def _search_rank(result: SecuritySearchResult, normalized_query: str) -> tuple[int, int, int, str]:
    symbol = result.symbol.upper()
    name = result.name.upper()
    base_symbol = symbol.split(".", 1)[0]
    if symbol == normalized_query:
        bucket = 0
    elif len(normalized_query) == 1 and symbol.startswith(normalized_query) and name.startswith(normalized_query):
        bucket = 1
    elif symbol.startswith(normalized_query):
        bucket = 2
    elif name.startswith(normalized_query):
        bucket = 3
    elif normalized_query in symbol:
        bucket = 4
    else:
        bucket = 5
    return (bucket, len(base_symbol), 1 if "." in symbol else 0, symbol)


def _first_number(values: dict[str, Any], *keys: str) -> float | None:
    for key in keys:
        value = values.get(key)
        if isinstance(value, int | float) and not isinstance(value, bool):
            return float(value)
    return None


def _guess_currency(symbol: str) -> str:
    if symbol.endswith(".TO") or symbol.endswith(".V") or symbol.endswith(".NE") or symbol.endswith(".CN"):
        return "CAD"
    return "USD"
