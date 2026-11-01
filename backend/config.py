"""Deployment configuration read from environment variables (no third-party dependencies)."""
import os


def parse_cors_origins(raw):
    """
    Turn "https://a.app, https://b.app/" into ["https://a.app", "https://b.app"].
    Blank entries are dropped and trailing slashes removed, because browsers send the Origin
    header without a trailing slash, so "https://b.app/" would otherwise never match.
    """
    if not raw:
        return []
    origins = []
    for part in raw.split(","):
        origin = part.strip().rstrip("/")
        if origin and origin not in origins:
            origins.append(origin)
    return origins


def cors_origins():
    """Extra allowed origins for a deployed frontend, from the CORS_ORIGINS env var."""
    return parse_cors_origins(os.environ.get("CORS_ORIGINS", ""))
