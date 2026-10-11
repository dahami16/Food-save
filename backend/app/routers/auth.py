"""Authentication endpoints for the Food Save API.

  POST /api/auth/signup  — register a new customer via Supabase Auth
  POST /api/auth/login   — password sign-in via Supabase Auth
  GET  /api/auth/me      — profile of the Bearer-token holder

Security rules enforced here:
  - Passwords are never stored, logged, or returned; Supabase Auth
    (auth.users) owns credentials and hashing exclusively.
  - The client can never choose a role: signup always yields the
    trigger-default 'customer'; login returns the role read from
    the trusted profiles record.
  - Auth calls use a FRESH anon-key client per request
    (get_supabase_auth_client); profile lookups use the shared
    service-role client (get_supabase_client), which bypasses RLS.
    Neither client nor any key ever reaches the frontend.
"""

from fastapi import APIRouter, Header, HTTPException, status
from supabase_auth.errors import AuthApiError, AuthError

from app.schemas import (
    AuthSuccessResponse,
    LoginRequest,
    ProfileResponse,
    SessionTokens,
    SignupRequest,
    UserPublic,
)
from app.supabase_client import (
    BackendConfigurationError,
    get_supabase_auth_client,
    get_supabase_client,
)

router = APIRouter(prefix="/api/auth", tags=["auth"])

GENERIC_AUTH_FAILURE = "Incorrect email or password."
MISSING_PROFILE_MESSAGE = (
    "Your account is not fully set up yet. Please contact support."
)
SERVICE_UNAVAILABLE_MESSAGE = (
    "Authentication is temporarily unavailable. Please try again later."
)


def _require_config() -> None:
    """Map a missing backend configuration to 503 (no secrets leaked)."""
    raise HTTPException(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        detail=SERVICE_UNAVAILABLE_MESSAGE,
    )


def _auth_error_to_http(error: Exception) -> HTTPException:
    """Translate a Supabase auth failure into a safe HTTP error."""
    if isinstance(error, BackendConfigurationError):
        return HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=SERVICE_UNAVAILABLE_MESSAGE,
        )
    if isinstance(error, AuthApiError):
        provider_status = getattr(error, "status", None)
        if provider_status in (400, 401, 403, 404, 422):
            return HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=GENERIC_AUTH_FAILURE,
            )
        if provider_status == 429:
            return HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Too many attempts. Please wait and try again.",
            )
    return HTTPException(
        status_code=status.HTTP_502_BAD_GATEWAY,
        detail=SERVICE_UNAVAILABLE_MESSAGE,
    )


def _read_profile(user_id: str) -> dict:
    """Fetch one trusted profile row by id via the service-role client."""
    try:
        client = get_supabase_client()
    except BackendConfigurationError:
        _require_config()
    try:
        response = (
            client.table("profiles")
            .select("id, email, full_name, role")
            .eq("id", user_id)
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
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=MISSING_PROFILE_MESSAGE,
        )
    return profile


def _public_user(user_id: str, email, full_name, role: str) -> UserPublic:
    return UserPublic(
        id=user_id,
        email=email,
        full_name=full_name,
        role=role,
    )

@router.post(
    "/signup",
    response_model=AuthSuccessResponse,
    status_code=status.HTTP_201_CREATED,
)
def signup(payload: SignupRequest):
    """Register a customer. The DB trigger creates the profile row."""
    email = payload.email.strip().lower()
    try:
        auth_client = get_supabase_auth_client()
    except BackendConfigurationError:
        _require_config()
    try:
        result = auth_client.auth.sign_up(
            {
                "email": email,
                "password": payload.password,
                "options": {"data": {"full_name": payload.full_name.strip()}},
            }
        )
    except (AuthError, BackendConfigurationError) as error:
        raise _auth_error_to_http(error)
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=SERVICE_UNAVAILABLE_MESSAGE,
        )

    auth_user = result.user
    if auth_user is None:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=SERVICE_UNAVAILABLE_MESSAGE,
        )

    profile = _read_profile(auth_user.id)
    session = None
    if result.session is not None:
        session = SessionTokens(
            access_token=result.session.access_token,
            refresh_token=result.session.refresh_token,
        )
    # When email confirmation is enabled Supabase returns no session;
    # registration still succeeded (HTTP 201) via the profile row.
    return AuthSuccessResponse(
        user=_public_user(
            auth_user.id,
            profile.get("email"),
            profile.get("full_name"),
            profile.get("role", "customer"),
        ),
        session=session,
    )


@router.post("/login", response_model=AuthSuccessResponse)
def login(payload: LoginRequest):
    """Password sign-in. Tokens only when Supabase returns a session."""
    email = payload.email.strip().lower()
    try:
        auth_client = get_supabase_auth_client()
    except BackendConfigurationError:
        _require_config()
    try:
        result = auth_client.auth.sign_in_with_password(
            {"email": email, "password": payload.password}
        )
    except (AuthError, BackendConfigurationError) as error:
        raise _auth_error_to_http(error)
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=SERVICE_UNAVAILABLE_MESSAGE,
        )

    if result.session is None or result.user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=GENERIC_AUTH_FAILURE,
        )

    profile = _read_profile(result.user.id)
    return AuthSuccessResponse(
        user=_public_user(
            result.user.id,
            profile.get("email"),
            profile.get("full_name"),
            profile.get("role", "customer"),
        ),
        session=SessionTokens(
            access_token=result.session.access_token,
            refresh_token=result.session.refresh_token,
        ),
    )


def _bearer_token(authorization: str | None) -> str:
    """Extract the Bearer token; 401 on any missing/malformed header."""
    if not authorization:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated.",
        )
    scheme, _, token = authorization.partition(" ")
    if scheme.lower() != "bearer" or not token.strip():
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated.",
        )
    return token.strip()


@router.get("/me", response_model=ProfileResponse)
def me(authorization: str | None = Header(default=None)):
    """Return the profile of the Bearer-token holder (token-derived id)."""
    token = _bearer_token(authorization)
    try:
        auth_client = get_supabase_auth_client()
    except BackendConfigurationError:
        _require_config()
    try:
        user_response = auth_client.auth.get_user(token)
    except (AuthError, BackendConfigurationError) as error:
        raise _auth_error_to_http(error)
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=SERVICE_UNAVAILABLE_MESSAGE,
        )

    auth_user = (
        getattr(user_response, "user", None) if user_response else None
    )
    if auth_user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated.",
        )

    profile = _read_profile(auth_user.id)
    return ProfileResponse(
        id=profile.get("id", auth_user.id),
        email=profile.get("email"),
        full_name=profile.get("full_name"),
        role=profile.get("role", "customer"),
    )