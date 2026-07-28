import sys
import os

# Add root folder to sys.path so python can resolve backend.main imports
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.main import app
