"""Reusable Supabase client for the Food Save backend.

Uses the official ``supabase`` Python package with credentials from
``app.config``. The client is created lazily on first use — never
during import or application startup — so the API starts even when
Supabase credentials are not configured yet.

The secret key stays strictly on the backend: it is never logged,
never returned from endpoints, and never sent to the frontend.
"""

from supabase import Client, create_client

from app.config import SUPABASE_ANON_KEY, SUPABASE_SECRET_KEY, SUPABASE_URL


class BackendConfigurationError(RuntimeError):
    """Raised when required backend configuration is missing."""


_client = None


def get_supabase_client() -> Client:
    """Return the shared Supabase client, creating it on first use.

    Raises BackendConfigurationError (without revealing any secret
    values) when SUPABASE_URL or SUPABASE_SECRET_KEY is missing.
    """
    global _client
    if _client is None:
        if not SUPABASE_URL or not SUPABASE_SECRET_KEY:
            raise BackendConfigurationError(
                "Supabase credentials are not configured. "
                "Set SUPABASE_URL and SUPABASE_SECRET_KEY in backend/.env."
            )
        _client = create_client(SUPABASE_URL, SUPABASE_SECRET_KEY)
    return _client


def get_supabase_auth_client() -> Client:
    """Create a FRESH Supabase client for a single auth operation.

    Uses the public/anonymous key (never the secret key) so auth
    calls behave exactly like a client-side SDK call. A new client
    is returned on every call — callers must not share it across
    requests, otherwise one user's session could leak into another
    user's request.

    Raises BackendConfigurationError (without revealing any secret
    values) when SUPABASE_URL or SUPABASE_ANON_KEY is missing.
    """
    if not SUPABASE_URL or not SUPABASE_ANON_KEY:
        raise BackendConfigurationError(
            "Supabase auth is not configured. "
            "Set SUPABASE_URL and SUPABASE_ANON_KEY in backend/.env."
        )
    return create_client(SUPABASE_URL, SUPABASE_ANON_KEY)