import sys
from pathlib import Path

# make `import engine`, `import main` work when running `pytest` from backend/
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
