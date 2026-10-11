"""Explicit request/response models for the Food Save auth API.

Validation messages mirror the frontend's inline-error voice.
Passwords and tokens never appear in any response model.
"""

from datetime import date, datetime
from typing import Literal, Optional

from pydantic import BaseModel, Field

MIN_PASSWORD_LENGTH = 8

EMAIL_PATTERN = r"^[^\s@]+@[^\s@]+\.[^\s@]+$"


class SignupRequest(BaseModel):
    full_name: str = Field(min_length=2)
    email: str = Field(pattern=EMAIL_PATTERN)
    password: str = Field(min_length=MIN_PASSWORD_LENGTH)


class LoginRequest(BaseModel):
    email: str = Field(pattern=EMAIL_PATTERN)
    password: str = Field(min_length=1)


class UserPublic(BaseModel):
    id: str
    email: Optional[str] = None
    full_name: Optional[str] = None
    role: str


class SessionTokens(BaseModel):
    access_token: str
    refresh_token: str


class AuthSuccessResponse(BaseModel):
    user: UserPublic
    session: Optional[SessionTokens] = None


class ProfileResponse(UserPublic):
    pass


class ErrorResponse(BaseModel):
    detail: str


# ==================== Stage 3B: catalog & food management ====================
# Response shapes follow supabase/migrations/20261009000000_initial_schema.sql:
# categories(id, name, slug, display_order), dietary_options(id, name,
# display_order), locations(id, address), price_options(id, label, min_price,
# max_price, sort_order), and food_items (price numeric(10,2) >= 0, expiry
# date, image_url = Supabase Storage public URL).


class CatalogCategory(BaseModel):
    id: str
    name: str
    slug: str
    display_order: int


class CatalogDietaryOption(BaseModel):
    id: str
    name: str
    display_order: int


class CatalogLocation(BaseModel):
    id: str
    address: str


class CatalogPriceOption(BaseModel):
    id: str
    label: str
    min_price: float
    max_price: Optional[float] = None
    sort_order: int


class CatalogOptionsResponse(BaseModel):
    categories: list[CatalogCategory]
    dietary_options: list[CatalogDietaryOption]
    locations: list[CatalogLocation]
    price_options: list[CatalogPriceOption]


class FoodCategoryRef(BaseModel):
    id: str
    name: str
    slug: str


class FoodLocationRef(BaseModel):
    id: str
    address: str


class FoodDietaryRef(BaseModel):
    id: str
    name: str


class FoodItemPublic(BaseModel):
    """One publicly visible food listing (never exposes created_by)."""

    id: str
    name: str
    image_url: str
    price: float
    expiry_date: date
    category: FoodCategoryRef
    location: FoodLocationRef
    dietary: FoodDietaryRef


class FoodItemAdmin(FoodItemPublic):
    """Admin view: adds reminder and ownership fields."""

    reminder_enabled: bool = True
    created_by: str
    created_at: Optional[datetime] = None


class FoodListResponse(BaseModel):
    items: list[FoodItemPublic]


class AdminFoodListResponse(BaseModel):
    items: list[FoodItemAdmin]


class FoodDeleteResponse(BaseModel):
    status: Literal["deleted"]
    image_cleanup: Literal["completed", "failed", "not_applicable"]