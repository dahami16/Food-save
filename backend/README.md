# Food Save Backend (Python + FastAPI)

Backend API for the Food Save app: the React frontend in `Food_Save/` will
call this API, which reads and writes the Supabase database. Stage 2A
provides the foundation only (CORS + `GET /health`); auth, products, and
reference-data endpoints arrive in later stages.

Application files live in `backend/app/`:

- `app/main.py` — FastAPI entry point (`Food Save API`, CORS, `/health`)
- `app/config.py` — central `.env` configuration (never logs secrets)
- `app/supabase_client.py` — lazy shared Supabase client
- `app/routers/` — API routers (empty for now)

## 1. Create a virtual environment (Windows PowerShell)

Run these from the `backend/` directory:

```powershell
cd backend
python -m venv venv
.\venv\Scripts\Activate.ps1
```

## 2. Install dependencies

```powershell
pip install -r requirements.txt
```

## 3. Configure `backend/.env`

The file already exists. Fill in (or keep) these values:

```ini
SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_SECRET_KEY=YOUR_SECRET_KEY_HERE
FRONTEND_URL=http://localhost:5173
PORT=8000
```

## 4. Start the development server (from `backend/`)

```powershell
uvicorn app.main:app --reload --port 8000
```

## 5. Test the health endpoint

Open http://localhost:8000/health — it should return:

```json
{ "status": "ok" }
```

Interactive API docs (added value as endpoints grow): http://localhost:8000/docs

## Privacy rules

- The Supabase **SECRET** key stays backend-only in `backend/.env`.
- Never add Supabase keys to `Food_Save/` frontend code.
- Never commit `backend/.env` to Git (protected by the root `.gitignore`).