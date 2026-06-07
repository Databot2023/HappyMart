"""
Ubuntu production server runner (waitress).
Usage: python run_ubuntu.py
"""
import sys
import os

HOST = "0.0.0.0"
PORT = int(os.environ.get("PORT", 8080))

try:
    from app import app
except ImportError as e:
    print(f"[ERROR] Could not import app from app.py: {e}")
    print("[HINT] Make sure app.py exists in the same directory with a Flask instance named 'app'.")
    sys.exit(1)

try:
    from waitress import serve
except ImportError:
    print("[ERROR] waitress is not installed.")
    print("[HINT] Run: pip install waitress")
    sys.exit(1)

if __name__ == "__main__":
    print(f"[*] Starting waitress production server at http://{HOST}:{PORT}")
    print("[*] Press Ctrl+C to stop")
    serve(app, host=HOST, port=PORT)
