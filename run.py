import subprocess
import sys
import os
import time
import signal

def run_servers():
    # Detect shell for Windows
    is_windows = os.name == 'nt'
    shell = True if is_windows else False

    print("──────────────────────────────────────────────────────────")
    print("  Starting CAD AI Integration...")
    print("──────────────────────────────────────────────────────────")

    # Start Backend
    backend_cmd = [sys.executable, "api.py"]
    print(f"  [API] Starting FastAPI on http://localhost:8000")
    backend_proc = subprocess.Popen(backend_cmd, shell=shell)

    # Start Frontend
    frontend_dir = os.path.join(os.getcwd(), "frontend")
    if os.path.exists(frontend_dir):
        print(f"  [UI] Starting Vite on http://localhost:5173")
        # Check if node_modules exists, if not, try npm install first?
        # For now assume it exists or user runs npm install
        frontend_cmd = ["npm", "run", "dev"]
        try:
            frontend_proc = subprocess.Popen(frontend_cmd, cwd=frontend_dir, shell=shell)
        except FileNotFoundError:
            print("  [UI] Error: 'npm' not found. Please install Node.js.")
            frontend_proc = None
    else:
        print("  [UI] Error: 'frontend' directory not found.")
        frontend_proc = None

    print("──────────────────────────────────────────────────────────")
    print("  API  → http://localhost:8000")
    print("  UI   → http://localhost:5173")
    print("  Docs → http://localhost:8000/docs")
    print("──────────────────────────────────────────────────────────")
    print("Press Ctrl+C to stop both servers.")

    try:
        while True:
            time.sleep(1)
            if backend_proc.poll() is not None:
                print("  [API] Backend stopped.")
                break
            if frontend_proc and frontend_proc.poll() is not None:
                print("  [UI] Frontend stopped.")
                break
    except KeyboardInterrupt:
        print("\n  Stopping servers...")
    finally:
        backend_proc.terminate()
        if frontend_proc:
            frontend_proc.terminate()
        print("  Done.")

if __name__ == "__main__":
    run_servers()
