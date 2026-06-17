import sys
from types import SimpleNamespace

from app.integrations.market_data import YahooFinanceQuoteService


class FakeYahooSearch:
    def __init__(self, query, **_kwargs):
        responses = {
            "M": [
                {"symbol": "M", "shortname": "Macy's Inc", "longname": "Macy's, Inc.", "quoteType": "EQUITY", "exchDisp": "NYSE"},
                {"symbol": "PBLS", "longname": "Parabilis Medicines, Inc. Common Stock", "quoteType": "EQUITY", "exchDisp": "NASDAQ"},
            ],
            "M*": [
                {"symbol": "PBLS", "longname": "Parabilis Medicines, Inc. Common Stock", "quoteType": "EQUITY", "exchDisp": "NASDAQ"},
                {"symbol": "MU", "shortname": "Micron Technology, Inc.", "longname": "Micron Technology, Inc.", "quoteType": "EQUITY", "exchDisp": "NASDAQ"},
                {"symbol": "MUU", "shortname": "Direxion Daily MU Bull 2X ETF", "quoteType": "ETF", "exchDisp": "NASDAQ"},
                {"symbol": "QM=F", "shortname": "E-mini Crude Oil Futures", "quoteType": "FUTURE", "exchDisp": "NY Mercantile"},
            ],
            "M.NE": [],
            "MU.NE": [
                {"symbol": "MU.NE", "shortname": "MICRON CDR (CAD HEDGED)", "longname": "Micron Technology, Inc.", "quoteType": "EQUITY", "exchDisp": "NEO"},
            ],
            "MUU.NE": [],
        }
        self.quotes = responses.get(query, [])


def test_search_merges_wildcard_and_suffix_matches_then_ranks_them(monkeypatch):
    monkeypatch.setattr("app.integrations.market_data._search_symbol_catalog", lambda _query, _max_results: [])
    monkeypatch.setitem(sys.modules, "yfinance", SimpleNamespace(Search=FakeYahooSearch))

    results = YahooFinanceQuoteService().search("m", max_results=10)

    assert [result.symbol for result in results] == ["M", "MU", "MU.NE", "MUU", "PBLS"]
    assert results[2].currency == "CAD"
    assert all(result.quote_type in {"EQUITY", "ETF"} for result in results)


def test_search_uses_symbol_catalog_when_yahoo_search_is_sparse(monkeypatch):
    class SparseYahooSearch:
        def __init__(self, query, **_kwargs):
            responses = {
                "M": [{"symbol": "M", "shortname": "Macy's Inc", "longname": "Macy's, Inc.", "quoteType": "EQUITY", "exchDisp": "NYSE"}],
                "M*": [],
                "MU.NE": [
                    {"symbol": "MU.NE", "shortname": "MICRON CDR (CAD HEDGED)", "longname": "Micron Technology, Inc.", "quoteType": "EQUITY", "exchDisp": "NEO"},
                ],
                "MUU.NE": [],
            }

            self.quotes = responses.get(query, [])

    monkeypatch.setitem(sys.modules, "yfinance", SimpleNamespace(Search=SparseYahooSearch))
    monkeypatch.setattr(
        "app.integrations.market_data._search_symbol_catalog",
        lambda _query, _max_results: [
            {"symbol": "MU", "name": "Micron Technology, Inc.", "quote_type": "EQUITY", "exchange": "NASDAQ", "currency": "USD", "price": None, "provider": "nasdaq-trader", "as_of": None},
            {"symbol": "MUU", "name": "Direxion Daily MU Bull 2X ETF", "quote_type": "ETF", "exchange": "NASDAQ", "currency": "USD", "price": None, "provider": "nasdaq-trader", "as_of": None},
        ],
    )

    results = YahooFinanceQuoteService().search("mu", max_results=10)

    assert [result.symbol for result in results] == ["MU", "MU.NE", "MUU"]


def test_search_falls_back_to_global_market_symbols(monkeypatch):
    class EmptyYahooSearch:
        def __init__(self, _query, **_kwargs):
            self.quotes = []

    monkeypatch.setitem(sys.modules, "yfinance", SimpleNamespace(Search=EmptyYahooSearch))
    monkeypatch.setattr("app.integrations.market_data._search_symbol_catalog", lambda _query, _max_results: [])

    symbols = {result.symbol for result in YahooFinanceQuoteService().search("samsung", max_results=10)}
    symbols.update(result.symbol for result in YahooFinanceQuoteService().search("600519", max_results=10))
    symbols.update(result.symbol for result in YahooFinanceQuoteService().search("tencent", max_results=10))
    symbols.update(result.symbol for result in YahooFinanceQuoteService().search("asml", max_results=10))
    symbols.update(result.symbol for result in YahooFinanceQuoteService().search("nikkei", max_results=10))

    assert {"005930.KS", "600519.SS", "0700.HK", "ASML.AS", "^N225"}.issubset(symbols)
