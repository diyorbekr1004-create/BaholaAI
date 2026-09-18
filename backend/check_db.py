from pathlib import Path
import sqlite3
import sys

ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from backend.database import DB_PATH, init_db

print(f"DB_PATH={DB_PATH}")
init_db()
conn = sqlite3.connect(str(DB_PATH))
print(conn.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").fetchall())
conn.close()
