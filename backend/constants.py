from pathlib import Path

UPLOAD_DIR = Path(__file__).resolve().parent / "uploads"
ALLOWED_UPLOAD_EXTENSIONS = {".pdf", ".docx", ".txt", ".jpg", ".jpeg", ".png"}
MAX_UPLOAD_SIZE_BYTES = 10 * 1024 * 1024
