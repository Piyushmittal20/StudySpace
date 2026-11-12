"""
Application configuration for StudySpace.
Reads settings from environment variables and local .env file.
"""
from pathlib import Path
import os

BASE_DIR = Path(__file__).resolve().parent.parent

# In serverless environments (Vercel, AWS Lambda), root filesystem is read-only; use /tmp
if os.getenv("VERCEL") or os.getenv("AWS_LAMBDA_FUNCTION_NAME"):
    DATA_DIR = Path("/tmp/studyspace_data")
else:
    DATA_DIR = BASE_DIR / "data"

UPLOADS_DIR = DATA_DIR / "uploads"
BACKUPS_DIR = DATA_DIR / "backups"
DB_PATH = DATA_DIR / "studyspace.db"
STATIC_DIR = BASE_DIR / "frontend"

# Ensure runtime directories exist
DATA_DIR.mkdir(parents=True, exist_ok=True)
UPLOADS_DIR.mkdir(parents=True, exist_ok=True)
BACKUPS_DIR.mkdir(parents=True, exist_ok=True)

def load_env_file(env_path: Path):
    """Simple parser for .env file if present."""
    if not env_path.is_file():
        return
    with open(env_path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, val = line.split("=", 1)
            key = key.strip()
            val = val.strip().strip("'\"")
            if key not in os.environ:
                os.environ[key] = val

load_env_file(BASE_DIR / ".env")

class Settings:
    APP_NAME: str = "StudySpace"
    VERSION: str = "1.0.0"
    APP_HOST: str = os.getenv("APP_HOST", "127.0.0.1")
    APP_PORT: int = int(os.getenv("APP_PORT", "8000"))
    DEBUG: bool = os.getenv("DEBUG", "false").lower() in ("1", "true", "yes")

    # AI Configuration
    AI_API_KEY: str = os.getenv("AI_API_KEY", "").strip()
    AI_BASE_URL: str = os.getenv("AI_BASE_URL", "https://api.openai.com/v1").rstrip("/")
    AI_MODEL: str = os.getenv("AI_MODEL", "gpt-4o-mini").strip()

    # Uploads & Limits
    MAX_UPLOAD_SIZE_BYTES: int = 50 * 1024 * 1024  # 50 MB
    ALLOWED_EXTENSIONS: set = {".pdf", ".docx", ".pptx", ".txt", ".md", ".xlsx"}

    # Security limits for Web Importer
    MAX_URL_RESPONSE_SIZE: int = 15 * 1024 * 1024  # 15 MB
    URL_REQUEST_TIMEOUT_SECONDS: int = 12

    @property
    def is_ai_configured(self) -> bool:
        return bool(self.AI_API_KEY)

settings = Settings()
