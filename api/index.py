import sys
from pathlib import Path

# Ensure the project root directory is in sys.path so backend modules can be imported
root_dir = Path(__file__).resolve().parent.parent
if str(root_dir) not in sys.path:
    sys.path.insert(0, str(root_dir))

from backend.main import app
