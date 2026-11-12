"""
Pytest configuration and fixtures.
Ensures an isolated test database is used so tests NEVER touch the user's live database.
"""
import pytest
import tempfile
from pathlib import Path
from backend import config as cfg
from backend import database as db

@pytest.fixture(scope="session", autouse=True)
def isolated_test_database():
    """Sets up an isolated SQLite database file for testing and cleans it up afterward."""
    with tempfile.NamedTemporaryFile(suffix=".db", delete=False) as tmp:
        test_db_path = Path(tmp.name)

    orig_db_path = cfg.DB_PATH
    cfg.DB_PATH = test_db_path

    # Initialize the test schema
    db.init_db()

    yield test_db_path

    # Restore original path and unlink test database file
    cfg.DB_PATH = orig_db_path
    try:
        if test_db_path.is_file():
            test_db_path.unlink()
    except Exception:
        pass
