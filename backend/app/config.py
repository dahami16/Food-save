"""Central environment configuration for the Food Save backend.

The backend/.env file is resolved relative to THIS file (not the
current working directory), so the server loads the correct file
no matter which directory it is started from.

Supabase credentials may be empty: the application must still
start (endpoints needing Supabase raise a clear error at call
time instead). Secret values are never printed or logged.
"""

import os
from pathlib import Path

from dotenv import load_dotenv

_BACKEND_DIR = Path(__file__).resolve().parent.parent
load_dotenv(_BACKEND_DIR / ".env")

SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_SECRET_KEY = os.environ.get("SUPABASE_SECRET_KEY", "")

# Public/anonymous key for Supabase Auth operations (signup, login,
# token validation). Read from the environment only — never invent
# or fall back to the secret key. Endpoints needing it fail with a
# clear 503 naming this setting when it is empty.
SUPABASE_ANON_KEY = os.environ.get("SUPABASE_ANON_KEY", "")
FRONTEND_URL = (
    os.environ.get("FRONTEND_URL", "") or "http://localhost:5173"
)

try:
    PORT = int(os.environ.get("PORT", "") or "8000")
except ValueError:
    PORT = 8000