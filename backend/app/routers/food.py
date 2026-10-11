"""Public catalog and administrator food management endpoints (Stage 3B).

Public (no authentication):
    GET    /api/catalog/options  - categories, dietary, locations, prices
    GET    /api/food             - non-expired listings (+ search/filters)
    GET    /api/food/{food_id}   - one non-expired listing (404 otherwise)

Administrator only (Bearer token + verified 'admin' profile role):
    GET    /api/admin/food       - all listings, expired items included
    POST   /api/admin/food       - create + multipart image upload
    PATCH  /api/admin/food/{id}  - partial update, optional image replace
    DELETE /api/admin/food/{id}  - delete + best-effort image cleanup

Security rules enforced here:
    - The role comes only from the trusted profiles row (require_admin
      in app.dependencies); created_by is always the verified token
      holder and any created_by supplied by the client is ignored.
    - Images are identified by magic bytes (never by the original
      filename or the client's MIME type alone), stored at a generated
      food-items/<uuid>.<ext> path in the public 'food-images' bucket,
      and only the resulting public URL reaches food_items.image_url.
    - Storage objects are deleted only when the URL demonstrably points
      inside the configured bucket on this Supabase project.
    - Expiry compares against the UTC date (independent of the backend
      host timezone): expired rows are excluded, items expiring today
      remain eligible.
    - No secret, token, or environment value ever appears in responses.
"""

import uuid
from datetime import date, datetime, timezone
from typing import Optional

from fastapi import (
    APIRouter,
    Depends,
    File,
    Form,
    HTTPException,
    Query,
    UploadFile,
    status,
)
from pydantic import ValidationError

from app.config import SUPABASE_URL
from app.dependencies import require_admin
from app.schemas import (
    AdminFoodListResponse,
    CatalogCategory,
    CatalogDietaryOption,
    CatalogLocation,
    CatalogOptionsResponse,
    CatalogPriceOption,
    FoodCategoryRef,
    FoodDeleteResponse,
    FoodDietaryRef,
    FoodItemAdmin,
    FoodItemPublic,
    FoodListResponse,
    FoodLocationRef,
)
from app.supabase_client import BackendConfigurationError, get_supabase_client

router = APIRouter(prefix="/api", tags=["food"])

STORAGE_BUCKET = "food-images"
MAX_IMAGE_BYTES = 5 * 1024 * 1024
MAX_NAME_LENGTH = 200
MAX_PRICE = 99999999.99  # numeric(10,2) upper bound

# Sniffed magic-byte type -> canonical MIME type (the sniffed type wins).
IMAGE_TYPES = {
    "jpg": "image/jpeg",
    "jpeg": "image/jpeg",
    "png": "image/png",
    "webp": "image/webp",
}
# Original filename extensions we are willing to accept at all.
FILENAME_EXTENSIONS = {"jpg", "jpeg", "png", "webp"}

SERVICE_UNAVAILABLE_MESSAGE = (
    "Service is temporarily unavailable. Please try again later."
)
STORAGE_UNAVAILABLE_MESSAGE = (
    "Food image storage is unavailable. The 'food-images' bucket must be "
    "created or configured manually in the Supabase Dashboard."
)
FOOD_NOT_FOUND_DETAIL = "Food item not found."
INVALID_IMAGE_DETAIL = "Only JPEG, PNG, and WebP images are supported."

# Explicit column list including the three PostgREST embeds. All three
# foreign keys on food_items are NOT NULL, so each embed resolves to a
# single object (never a list).
FOOD_SELECT = (
    "id, name, image_url, price, expiry_date, reminder_enabled, "
    "category_id, location_id, dietary_id, created_by, created_at, "
    "categories(id, name, slug), locations(id, address), "
    "dietary_options(id, name)"
)

def _client():
    """Shared service-role client, or a safe 503 (no secrets leaked)."""
    try:
        return get_supabase_client()
    except BackendConfigurationError:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=SERVICE_UNAVAILABLE_MESSAGE,
        )


def _run(builder) -> object:
    """Execute a Supabase query; upstream failures become a safe 502."""
    try:
        return builder.execute()
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=SERVICE_UNAVAILABLE_MESSAGE,
        )


def _rows(response) -> list:
    data = getattr(response, "data", None)
    return data or []


def _utc_today() -> str:
    """ISO date in UTC - independent of the backend host's local time."""
    return datetime.now(timezone.utc).date().isoformat()


def _is_expired(expiry_value, today: str) -> bool:
    """Strictly before today is expired; today itself stays eligible."""
    return str(expiry_value)[:10] < today


def _escape_like(term: str) -> str:
    """Escape LIKE wildcards so user input is matched literally."""
    return term.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")


def _to_public(row: dict) -> FoodItemPublic:
    """Map one joined food_items row onto the public response shape."""
    return FoodItemPublic(
        id=str(row["id"]),
        name=row["name"],
        image_url=row["image_url"],
        price=float(row["price"]),
        expiry_date=row["expiry_date"],
        category=FoodCategoryRef(**row["categories"]),
        location=FoodLocationRef(**row["locations"]),
        dietary=FoodDietaryRef(**row["dietary_options"]),
    )


def _to_admin(row: dict) -> FoodItemAdmin:
    """Map one joined food_items row onto the admin response shape."""
    base = _to_public(row).model_dump()
    return FoodItemAdmin(
        **base,
        reminder_enabled=bool(row.get("reminder_enabled", True)),
        created_by=str(row.get("created_by", "")),
        created_at=row.get("created_at"),
    )


def _fetch_food(client, food_id: uuid.UUID) -> dict:
    """Fetch one food row by id, or raise a consistent 404."""
    response = _run(
        client.table("food_items")
        .select(FOOD_SELECT)
        .eq("id", str(food_id))
        .maybe_single()
    )
    row = getattr(response, "data", None)
    if not row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=FOOD_NOT_FOUND_DETAIL,
        )
    return row


def _detect_image_type(data: bytes) -> Optional[str]:
    """Magic-byte sniff: JPEG, PNG, or WebP only (None otherwise)."""
    if len(data) >= 3 and data[:3] == b"\xff\xd8\xff":
        return "jpg"
    if len(data) >= 8 and data[:8] == b"\x89PNG\r\n\x1a\n":
        return "png"
    if len(data) >= 12 and data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return "webp"
    return None


def _validate_image(upload: UploadFile) -> tuple:
    """Return (bytes, storage extension, MIME type) or raise 413/422.

    The sniffed magic bytes are authoritative. The original filename
    extension and the client-declared MIME type must merely be
    consistent with what the bytes actually are - neither is ever
    trusted to decide the Storage path or content type.
    """
    original = (upload.filename or "").strip().lower()
    if original and "." in original:
        declared_ext = original.rsplit(".", 1)[-1]
        if declared_ext not in FILENAME_EXTENSIONS:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=INVALID_IMAGE_DETAIL,
            )
    data = upload.file.read(MAX_IMAGE_BYTES + 1)
    if len(data) > MAX_IMAGE_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="Image must be 5 MB or smaller.",
        )
    detected = _detect_image_type(data)
    if detected is None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=INVALID_IMAGE_DETAIL,
        )
    declared_mime = (upload.content_type or "").strip().lower()
    if (
        declared_mime
        and declared_mime != "application/octet-stream"
        and declared_mime != IMAGE_TYPES[detected]
    ):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Image content does not match its declared file type.",
        )
    return data, detected, IMAGE_TYPES[detected]


def _storage_object_path(image_url: Optional[str]) -> Optional[str]:
    """Extract the object path ONLY for URLs inside our own bucket.

    Returns None for anything else (external hosts, other buckets,
    traversal segments), so cleanup can never delete arbitrary objects
    based on untrusted URLs.
    """
    if not image_url or not SUPABASE_URL:
        return None
    if not isinstance(image_url, str):
        return None
    prefix = f"{SUPABASE_URL.rstrip('/')}/storage/v1/object/public/{STORAGE_BUCKET}/"
    if not image_url.startswith(prefix):
        return None
    path = image_url[len(prefix):]
    if not path or path.startswith("/") or ".." in path:
        return None
    return path


def _best_effort_remove(client, object_path: str) -> bool:
    """Attempt Storage cleanup; True only when no error was raised."""
    try:
        client.storage.from_(STORAGE_BUCKET).remove([object_path])
        return True
    except Exception:
        return False


def _upload_image(client, data: bytes, extension: str, content_type: str) -> tuple:
    """Upload bytes to a generated path; return (object_path, public_url).

    The original filename never reaches Storage - only
    food-items/<uuid>.<ext> does. On any failure a safe 502 is raised
    and the message points at the manual Supabase Dashboard setup.
    """
    object_path = f"food-items/{uuid.uuid4().hex}.{extension}"
    try:
        bucket = client.storage.from_(STORAGE_BUCKET)
        bucket.upload(
            object_path,
            data,
            {"content-type": content_type, "cache-control": "3600"},
        )
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=STORAGE_UNAVAILABLE_MESSAGE,
        )
    try:
        public_url = str(bucket.get_public_url(object_path))
    except Exception:
        _best_effort_remove(client, object_path)  # never orphan an upload
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=STORAGE_UNAVAILABLE_MESSAGE,
        )
    return object_path, public_url


def _ensure_reference(client, table: str, ref_id: uuid.UUID, label: str) -> None:
    """422 when a referenced catalog id does not exist.

    ``table`` is always a fixed literal from this module - never built
    from request input.
    """
    response = _run(
        client.table(table).select("id").eq("id", str(ref_id)).maybe_single()
    )
    if not getattr(response, "data", None):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Unknown {label}.",
        )


@router.get("/catalog/options", response_model=CatalogOptionsResponse)
def catalog_options() -> CatalogOptionsResponse:
    """Reference data for the Filters / Add Food screens (public)."""
    client = _client()
    categories = _rows(
        _run(
            client.table("categories")
            .select("id, name, slug, display_order")
            .order("display_order")
        )
    )
    dietary = _rows(
        _run(
            client.table("dietary_options")
            .select("id, name, display_order")
            .order("display_order")
        )
    )
    locations = _rows(
        _run(client.table("locations").select("id, address").order("address"))
    )
    prices = _rows(
        _run(
            client.table("price_options")
            .select("id, label, min_price, max_price, sort_order")
            .order("sort_order")
        )
    )
    return CatalogOptionsResponse(
        categories=[CatalogCategory(**row) for row in categories],
        dietary_options=[CatalogDietaryOption(**row) for row in dietary],
        locations=[CatalogLocation(**row) for row in locations],
        price_options=[CatalogPriceOption(**row) for row in prices],
    )


@router.get("/food", response_model=FoodListResponse)
def list_food(
    search: Optional[str] = Query(default=None, max_length=100),
    category_id: Optional[uuid.UUID] = None,
    dietary_id: Optional[uuid.UUID] = None,
    location_id: Optional[uuid.UUID] = None,
    min_price: Optional[float] = Query(default=None, ge=0, le=MAX_PRICE),
    max_price: Optional[float] = Query(default=None, ge=0, le=MAX_PRICE),
) -> FoodListResponse:
    """Public listings: expired rows excluded, expiring today included."""
    if min_price is not None and max_price is not None and min_price > max_price:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="min_price cannot be greater than max_price.",
        )
    today = _utc_today()
    client = _client()
    query = (
        client.table("food_items")
        .select(FOOD_SELECT)
        .gte("expiry_date", today)  # excludes yesterday, keeps today
        .order("expiry_date")
    )
    term = (search or "").strip()
    if term:
        query = query.ilike("name", f"%{_escape_like(term)}%")
    if category_id is not None:
        query = query.eq("category_id", str(category_id))
    if dietary_id is not None:
        query = query.eq("dietary_id", str(dietary_id))
    if location_id is not None:
        query = query.eq("location_id", str(location_id))
    if min_price is not None:
        query = query.gte("price", min_price)
    if max_price is not None:
        query = query.lte("price", max_price)

    items: list[FoodItemPublic] = []
    for row in _rows(_run(query)):
        if _is_expired(row.get("expiry_date"), today):
            continue  # defence in depth if the DB filter was bypassed
        try:
            items.append(_to_public(row))
        except (KeyError, TypeError, ValueError, ValidationError):
            continue  # skip malformed rows rather than failing the list
    return FoodListResponse(items=items)


@router.get("/food/{food_id}", response_model=FoodItemPublic)
def get_food(food_id: uuid.UUID) -> FoodItemPublic:
    """One public listing; 404 when missing or no longer public."""
    client = _client()
    row = _fetch_food(client, food_id)
    if _is_expired(row.get("expiry_date"), _utc_today()):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=FOOD_NOT_FOUND_DETAIL,
        )
    return _to_public(row)


@router.get("/admin/food", response_model=AdminFoodListResponse)
def admin_list_food(
    profile: dict = Depends(require_admin),
) -> AdminFoodListResponse:
    """All listings for Admin Home / Expiry Alarm (expired included)."""
    client = _client()
    response = _run(
        client.table("food_items")
        .select(FOOD_SELECT)
        .order("created_at", desc=True)
    )
    items: list[FoodItemAdmin] = []
    for row in _rows(response):
        try:
            items.append(_to_admin(row))
        except (KeyError, TypeError, ValueError, ValidationError):
            continue  # skip malformed rows rather than failing the list
    return AdminFoodListResponse(items=items)


@router.post(
    "/admin/food",
    response_model=FoodItemAdmin,
    status_code=status.HTTP_201_CREATED,
)
def create_food(
    image: UploadFile = File(...),
    name: str = Form(...),
    category_id: uuid.UUID = Form(...),
    location_id: uuid.UUID = Form(...),
    dietary_id: uuid.UUID = Form(...),
    price: float = Form(..., ge=0, le=MAX_PRICE),
    expiry_date: date = Form(...),
    reminder_enabled: bool = Form(default=True),
    profile: dict = Depends(require_admin),
) -> FoodItemAdmin:
    """Create a listing and upload its image (multipart, admin only).

    ``created_by`` always comes from the verified token holder; any
    ``created_by`` or role field in the request body is ignored.
    """
    clean_name = name.strip()
    if not 2 <= len(clean_name) <= MAX_NAME_LENGTH:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Name must be between 2 and {MAX_NAME_LENGTH} characters.",
        )

    client = _client()
    _ensure_reference(client, "categories", category_id, "category")
    _ensure_reference(client, "locations", location_id, "location")
    _ensure_reference(client, "dietary_options", dietary_id, "dietary option")

    data, extension, content_type = _validate_image(image)
    object_path, image_url = _upload_image(client, data, extension, content_type)

    payload = {
        "name": clean_name,
        "image_url": image_url,
        "category_id": str(category_id),
        "location_id": str(location_id),
        "dietary_id": str(dietary_id),
        "price": price,
        "expiry_date": expiry_date.isoformat(),
        "reminder_enabled": reminder_enabled,
        "created_by": str(profile["id"]),  # trusted id only
    }
    try:
        created = _rows(_run(client.table("food_items").insert(payload)))
    except HTTPException:
        _best_effort_remove(client, object_path)  # never orphan an upload
        raise
    if not created or not created[0].get("id"):
        _best_effort_remove(client, object_path)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=SERVICE_UNAVAILABLE_MESSAGE,
        )
    new_id = created[0]["id"]
    return _to_admin(_fetch_food(client, uuid.UUID(str(new_id))))


@router.patch("/admin/food/{food_id}", response_model=FoodItemAdmin)
def update_food(
    food_id: uuid.UUID,
    image: Optional[UploadFile] = File(default=None),
    name: Optional[str] = Form(default=None),
    category_id: Optional[uuid.UUID] = Form(default=None),
    location_id: Optional[uuid.UUID] = Form(default=None),
    dietary_id: Optional[uuid.UUID] = Form(default=None),
    price: Optional[float] = Form(default=None, ge=0, le=MAX_PRICE),
    expiry_date: Optional[date] = Form(default=None),
    reminder_enabled: Optional[bool] = Form(default=None),
    profile: dict = Depends(require_admin),
) -> FoodItemAdmin:
    """Partial update; replacing the image is optional (admin only).

    Image rules: the new image is uploaded to a NEW unique path first;
    ``image_url`` changes only after the database update succeeds. If
    the update fails the new object is removed and the old record (and
    its image) are preserved. After a successful update the previous
    object is deleted, but only when it demonstrably belongs to the
    configured ``food-images`` bucket.
    """
    client = _client()
    existing = _fetch_food(client, food_id)  # 404 before any change

    updates: dict = {}
    if name is not None:
        clean_name = name.strip()
        if not 2 <= len(clean_name) <= MAX_NAME_LENGTH:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=(
                    f"Name must be between 2 and {MAX_NAME_LENGTH} characters."
                ),
            )
        updates["name"] = clean_name
    if category_id is not None:
        _ensure_reference(client, "categories", category_id, "category")
        updates["category_id"] = str(category_id)
    if location_id is not None:
        _ensure_reference(client, "locations", location_id, "location")
        updates["location_id"] = str(location_id)
    if dietary_id is not None:
        _ensure_reference(client, "dietary_options", dietary_id, "dietary option")
        updates["dietary_id"] = str(dietary_id)
    if price is not None:
        updates["price"] = price
    if expiry_date is not None:
        updates["expiry_date"] = expiry_date.isoformat()
    if reminder_enabled is not None:
        updates["reminder_enabled"] = reminder_enabled

    new_object_path: Optional[str] = None
    if image is not None:
        data, extension, content_type = _validate_image(image)
        new_object_path, new_url = _upload_image(
            client, data, extension, content_type
        )
        updates["image_url"] = new_url

    if not updates:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="No update fields were provided.",
        )

    try:
        _run(client.table("food_items").update(updates).eq("id", str(food_id)))
    except HTTPException:
        # Database update failed: remove the NEW image and leave the
        # existing record and image reference untouched.
        if new_object_path is not None:
            _best_effort_remove(client, new_object_path)
        raise

    if new_object_path is not None:
        old_path = _storage_object_path(existing.get("image_url"))
        if old_path is not None:
            _best_effort_remove(client, old_path)  # best effort after success

    return _to_admin(_fetch_food(client, food_id))


@router.delete("/admin/food/{food_id}", response_model=FoodDeleteResponse)
def delete_food(
    food_id: uuid.UUID,
    profile: dict = Depends(require_admin),
) -> FoodDeleteResponse:
    """Delete a listing, then attempt Storage cleanup (admin only).

    The Storage object is only targeted when the stored URL resolves
    inside the configured bucket. Cleanup failures never leak details
    and are reported honestly via ``image_cleanup``.
    """
    client = _client()
    existing = _fetch_food(client, food_id)  # 404 before any deletion

    try:
        removed = _rows(
            _run(client.table("food_items").delete().eq("id", str(food_id)))
        )
    except HTTPException:
        raise  # record kept -> no Storage cleanup attempted
    if not removed:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=FOOD_NOT_FOUND_DETAIL,
        )

    cleanup = "not_applicable"
    object_path = _storage_object_path(existing.get("image_url"))
    if object_path is not None:
        cleanup = (
            "completed" if _best_effort_remove(client, object_path) else "failed"
        )
    return FoodDeleteResponse(status="deleted", image_cleanup=cleanup)