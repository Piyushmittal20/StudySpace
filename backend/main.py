"""
Main entry point for StudySpace application.
Configures FastAPI, mounts routers, manages database lifespan, and serves static frontend assets.
"""
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from contextlib import asynccontextmanager
import logging

from backend.config import settings, STATIC_DIR
from backend.database import init_db, get_connection
from backend.routers import (
    health, subjects, materials, notes, flashcards,
    quizzes, progress, search, ai, system, calendar
)

# Configure logging
logging.basicConfig(
    level=logging.INFO if not settings.DEBUG else logging.DEBUG,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("studyspace.main")

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initializes SQLite tables and loads persisted runtime configurations."""
    logger.info("Initializing StudySpace database...")
    init_db()

    # Load runtime AI overrides from settings_kv if present
    conn = get_connection()
    try:
        rows = conn.execute("SELECT key, value FROM settings_kv").fetchall()
        for r in rows:
            if r["key"] == "AI_API_KEY" and r["value"]:
                settings.AI_API_KEY = r["value"]
            elif r["key"] == "AI_BASE_URL" and r["value"]:
                settings.AI_BASE_URL = r["value"]
            elif r["key"] == "AI_MODEL" and r["value"]:
                settings.AI_MODEL = r["value"]
        logger.info(f"AI configured: {settings.is_ai_configured} (Model: {settings.AI_MODEL})")
    finally:
        conn.close()

    logger.info("StudySpace startup complete.")
    yield
    logger.info("StudySpace shutting down.")

app = FastAPI(
    title=settings.APP_NAME,
    version=settings.VERSION,
    description="StudySpace — Personal AI Learning Platform",
    lifespan=lifespan
)

# CORS setup
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Prevent aggressive browser caching during local development
@app.middleware("http")
async def add_no_cache_headers(request: Request, call_next):
    response = await call_next(request)
    if request.url.path.endswith((".html", ".js", ".css")) or request.url.path == "/":
        response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
        response.headers["Pragma"] = "no-cache"
        response.headers["Expires"] = "0"
    return response

# Include all API Routers
app.include_router(health.router)
app.include_router(subjects.router)
app.include_router(materials.router)
app.include_router(notes.router)
app.include_router(flashcards.router)
app.include_router(quizzes.router)
app.include_router(progress.router)
app.include_router(search.router)
app.include_router(ai.router)
app.include_router(system.router)
app.include_router(calendar.router)

# Mount frontend static directories
if (STATIC_DIR / "css").is_dir():
    app.mount("/css", StaticFiles(directory=str(STATIC_DIR / "css")), name="css")
if (STATIC_DIR / "js").is_dir():
    app.mount("/js", StaticFiles(directory=str(STATIC_DIR / "js")), name="js")

@app.get("/")
async def serve_index():
    """Serves the single-page frontend application."""
    index_file = STATIC_DIR / "index.html"
    if index_file.is_file():
        return FileResponse(index_file)
    return {"message": "StudySpace API is operational. Frontend files are being initialized."}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.main:app", host=settings.APP_HOST, port=settings.APP_PORT, reload=settings.DEBUG)
