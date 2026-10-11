"""Food Save API — FastAPI application entry point.

Routers: /health (liveness), /api/auth (Supabase Auth), /api/catalog +
/api/food (public catalog) and /api/admin/food (admin food management
with Storage image uploads — Stage 3B). The app starts with or without
Supabase credentials configured; endpoints that need Supabase raise a
safe 503/502 at call time instead.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import FRONTEND_URL
from app.routers.auth import router as auth_router
from app.routers.food import router as food_router

app = FastAPI(title="Food Save API")

# Restrict cross-origin access to the configured frontend origin.
# Never a wildcard: the browser should only accept responses for
# our own frontend.
app.add_middleware(
    CORSMiddleware,
    allow_origins=[FRONTEND_URL],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


app.include_router(auth_router)
app.include_router(food_router)


@app.get("/health")
def health():
    """Liveness probe. Returns no secrets or environment values."""
    return {"status": "ok"}