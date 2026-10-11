"""Reusable authentication dependencies for the Food Save API (Stage 3B).

Administrator endpoints need one shared way to turn an
``Authorization: Bearer <token>`` header into a trusted profile row:

1. The Bearer token is verified with Supabase Auth using the anon-key
   client (get_supabase_auth_client) - never the secret key.
2. The profile (and therefore the role) is read from the profiles
   table with the service-role client - never from the request body,
   query string, or any client-supplied field.
3. HTTP 401 for a missing or invalid token; HTTP 403 when the verified
   profile role is not 'admin'.

The rules mirror ``app.routers.auth`` so every endpoint in the API
behaves identically. No secret value is ever echoed into errors.
"""

from fastapi import Depends, Header, HTTPException, status
from supabase_auth.errors import AuthError

from app.supabase_client import (
    BackendConfigurationError,
    get_supabase_auth_client,
    get_supabase_client,
)

NOT_AUTHENTICATED_DETAIL = "Not authenticated."
FORBIDDEN_DETAIL = "Administrator access required."
SERVICE_UNAVAILABLE_MESSAGE = (
    "Service is temporarily unavailable. Please try again later."
)


def extract_bearer_token(authorization: str | None) -> str:
    """Extract the Bearer token; 401 on any missing/malformed header."""
    if not authorization:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=NOT_AUTHENTICATED_DETAIL,
        )
    scheme, _, token = authorization.partition(" ")
    if scheme.lower() != "bearer" or not token.strip():
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=NOT_AUTHENTICATED_DETAIL,
        )
    return token.strip()


def get_current_profile(authorization: str | None = Header(default=None)) -> dict:
    """Return the trusted profiles row for the Bearer-token holder.

    Raises 401 when the token is missing, malformed, or rejected by
    Supabase Auth; 503/502 (safe messages only) on configuration or
    upstream failures; 403 when no profile row exists for the user
    (role cannot be proven).
    """
    token = extract_bearer_token(authorization)

    try:
        auth_client = get_supabase_auth_client()
    except BackendConfigurationError:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=SERVICE_UNAVAILABLE_MESSAGE,
        )
    try:
        user_response = auth_client.auth.get_user(token)
    except AuthError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=NOT_AUTHENTICATED_DETAIL,
        )
    except BackendConfigurationError:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=SERVICE_UNAVAILABLE_MESSAGE,
        )
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=SERVICE_UNAVAILABLE_MESSAGE,
        )

    auth_user = getattr(user_response, "user", None) if user_response else None
    if auth_user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=NOT_AUTHENTICATED_DETAIL,
        )

    try:
        client = get_supabase_client()
    except BackendConfigurationError:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=SERVICE_UNAVAILABLE_MESSAGE,
        )
    try:
        response = (
            client.table("profiles")
            .select("id, email, full_name, role")
            .eq("id", auth_user.id)
            .maybe_single()
            .execute()
        )
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=SERVICE_UNAVAILABLE_MESSAGE,
        )
    profile = getattr(response, "data", None)
    if not profile:
        # Authenticated in Supabase Auth, but there is no trusted
        # profile row -> no role can be proven, so admin access is
        # denied rather than assumed.
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=FORBIDDEN_DETAIL,
        )
    return profile


def require_admin(profile: dict = Depends(get_current_profile)) -> dict:
    """Dependency: the verified token holder MUST be role 'admin'."""
    if profile.get("role") != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=FORBIDDEN_DETAIL,
        )
    return profile
