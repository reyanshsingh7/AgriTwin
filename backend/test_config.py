"""Deployment-config tests (pure Python)."""
from config import cors_origins, parse_cors_origins


def test_parse_empty_and_missing():
    assert parse_cors_origins("") == [] and parse_cors_origins(None) == []
    assert parse_cors_origins(" , ,") == []


def test_parse_strips_whitespace_and_trailing_slash_and_dedupes():
    raw = " https://a.vercel.app/ , https://b.onrender.com,https://a.vercel.app "
    assert parse_cors_origins(raw) == ["https://a.vercel.app", "https://b.onrender.com"]


def test_cors_origins_reads_environment(monkeypatch=None):
    import os
    old = os.environ.get("CORS_ORIGINS")
    try:
        os.environ["CORS_ORIGINS"] = "https://agritwin.example.com/"
        assert cors_origins() == ["https://agritwin.example.com"]
        del os.environ["CORS_ORIGINS"]
        assert cors_origins() == []
    finally:
        if old is not None:
            os.environ["CORS_ORIGINS"] = old
