"""FastAPI entry point with REST endpoints and WebSocket for real-time progress."""
import os
import sys
import json
import uuid
import shutil
import asyncio
import zipfile
import tempfile
import hashlib
import secrets
from datetime import datetime
from pathlib import Path
from typing import Dict, Any, List

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, UploadFile, File, Form, HTTPException, Header
from fastapi.responses import FileResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from dotenv import load_dotenv

# Add backend dir to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

load_dotenv()

from translate_repo import run_pipeline
from utils.logger import logger

app = FastAPI(title="Legacy Code Modernizer", version="1.0.0")

# CORS for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Job storage (in-memory for hackathon)
jobs: Dict[str, Dict[str, Any]] = {}
# WebSocket connections per job
ws_connections: Dict[str, list] = {}
# Running asyncio tasks per job (for cancellation)
job_tasks: Dict[str, asyncio.Task] = {}

# Auth storage (in-memory)
users_db: Dict[str, Dict[str, Any]] = {}   # email -> user record
auth_tokens: Dict[str, str] = {}            # token -> email
feedback_db: List[Dict[str, Any]] = []

# Working directories
WORK_DIR = Path(tempfile.gettempdir()) / "legacy-modernizer-jobs"
WORK_DIR.mkdir(exist_ok=True)


def _hash_password(password: str) -> str:
    return hashlib.sha256(password.encode("utf-8")).hexdigest()


def _get_user_from_token(authorization: str) -> Dict[str, Any]:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")
    token = authorization[7:]
    email = auth_tokens.get(token)
    if not email or email not in users_db:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    return users_db[email]


@app.get("/api/health")
async def health():
    return {"status": "ok", "timestamp": datetime.utcnow().isoformat()}


# ── Auth endpoints ────────────────────────────────────────────────────────────

@app.post("/api/auth/register")
async def register(name: str = Form(...), email: str = Form(...), password: str = Form(...)):
    """Register a new user."""
    email = email.strip().lower()
    if email in users_db:
        raise HTTPException(status_code=400, detail="Email already registered")
    if len(password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")
    users_db[email] = {
        "name": name.strip(),
        "email": email,
        "password_hash": _hash_password(password),
        "created_at": datetime.utcnow().isoformat(),
    }
    token = secrets.token_urlsafe(32)
    auth_tokens[token] = email
    return {"token": token, "user": {"name": users_db[email]["name"], "email": email}}


@app.post("/api/auth/login")
async def login(email: str = Form(...), password: str = Form(...)):
    """Authenticate and return a session token."""
    email = email.strip().lower()
    user = users_db.get(email)
    if not user or user["password_hash"] != _hash_password(password):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    token = secrets.token_urlsafe(32)
    auth_tokens[token] = email
    return {"token": token, "user": {"name": user["name"], "email": email}}


@app.post("/api/auth/logout")
async def logout(authorization: str = Header(default=None)):
    """Invalidate the session token."""
    if authorization and authorization.startswith("Bearer "):
        auth_tokens.pop(authorization[7:], None)
    return {"status": "ok"}


@app.get("/api/auth/me")
async def get_me(authorization: str = Header(default=None)):
    """Return current user info from Bearer token."""
    user = _get_user_from_token(authorization)
    return {"name": user["name"], "email": user["email"]}


# ── Feedback endpoint ─────────────────────────────────────────────────────────

@app.post("/api/feedback")
async def submit_feedback(
    name: str = Form(...),
    email: str = Form(...),
    message: str = Form(...),
    rating: int = Form(5),
):
    """Store a feedback/suggestion submission."""
    feedback_db.append({
        "name": name.strip(),
        "email": email.strip().lower(),
        "message": message.strip(),
        "rating": max(1, min(5, rating)),
        "created_at": datetime.utcnow().isoformat(),
    })
    return {"status": "ok", "message": "Thank you for your feedback!"}


@app.post("/api/upload")
async def upload_files(files: list[UploadFile] = File(...)):
    """Upload files (ZIP or individual source files) for translation."""
    job_id = str(uuid.uuid4())[:8]
    job_dir = WORK_DIR / job_id
    repo_dir = job_dir / "repo"
    repo_dir.mkdir(parents=True, exist_ok=True)

    for upload_file in files:
        filename = upload_file.filename or "unknown"
        content = await upload_file.read()

        if filename.endswith(".zip"):
            # Extract ZIP
            zip_path = job_dir / filename
            zip_path.write_bytes(content)
            with zipfile.ZipFile(str(zip_path), "r") as zf:
                zf.extractall(str(repo_dir))
        else:
            # Save individual file
            dest = repo_dir / filename
            dest.parent.mkdir(parents=True, exist_ok=True)
            dest.write_bytes(content)

    jobs[job_id] = {
        "id": job_id,
        "status": "uploaded",
        "repo_path": str(repo_dir),
        "output_dir": str(job_dir / "output"),
        "created_at": datetime.utcnow().isoformat(),
        "metadata": None,
    }

    return {"job_id": job_id, "status": "uploaded", "message": f"Uploaded {len(files)} file(s)"}


@app.post("/api/clone")
async def clone_repo(url: str = Form(...)):
    """Clone a GitHub repository for translation."""
    job_id = str(uuid.uuid4())[:8]
    job_dir = WORK_DIR / job_id
    repo_dir = job_dir / "repo"

    try:
        import git
        git.Repo.clone_from(url, str(repo_dir), depth=1)
    except ImportError:
        # Fallback to git CLI
        import subprocess
        result = subprocess.run(
            ["git", "clone", "--depth", "1", url, str(repo_dir)],
            capture_output=True, text=True, timeout=120,
        )
        if result.returncode != 0:
            raise HTTPException(status_code=400, detail=f"Git clone failed: {result.stderr[:200]}")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Clone failed: {str(e)[:200]}")

    jobs[job_id] = {
        "id": job_id,
        "status": "cloned",
        "repo_path": str(repo_dir),
        "output_dir": str(job_dir / "output"),
        "created_at": datetime.utcnow().isoformat(),
        "repo_url": url,
        "metadata": None,
    }

    return {"job_id": job_id, "status": "cloned", "message": f"Cloned {url}"}


@app.post("/api/start")
async def start_pipeline(job_id: str = Form(...), source_lang: str = Form("auto")):
    """Start the translation pipeline for a job."""
    if job_id not in jobs:
        raise HTTPException(status_code=404, detail="Job not found")

    job = jobs[job_id]
    if job["status"] in ("running",):
        raise HTTPException(status_code=400, detail="Job already running")

    job["status"] = "running"

    # Run pipeline in background, store task for cancellation
    task = asyncio.create_task(_run_job(job_id, source_lang))
    job_tasks[job_id] = task

    return {"job_id": job_id, "status": "running"}


@app.post("/api/cancel/{job_id}")
async def cancel_pipeline(job_id: str):
    """Cancel a running pipeline job."""
    if job_id not in jobs:
        raise HTTPException(status_code=404, detail="Job not found")
    job = jobs[job_id]
    if job["status"] != "running":
        raise HTTPException(status_code=400, detail=f"Job is not running (status: {job['status']})")
    task = job_tasks.get(job_id)
    if task and not task.done():
        task.cancel()
    job["status"] = "cancelled"
    return {"job_id": job_id, "status": "cancelled"}


async def _run_job(job_id: str, source_lang: str):
    """Background task to run the translation pipeline."""
    job = jobs[job_id]

    async def progress_callback(stage, progress, message, data):
        """Send progress to all connected WebSocket clients."""
        msg = {
            "stage": stage,
            "progress": progress,
            "message": message,
            "data": data or {},
        }
        job["last_progress"] = msg
        for ws in ws_connections.get(job_id, []):
            try:
                await ws.send_json(msg)
            except Exception:
                pass

    try:
        metadata = await run_pipeline(
            repo_path=job["repo_path"],
            source_lang=source_lang,
            output_dir=job["output_dir"],
            progress_callback=progress_callback,
        )
        job["status"] = "completed"
        job["metadata"] = metadata
    except asyncio.CancelledError:
        job["status"] = "cancelled"
        await progress_callback("cancelled", 0, "Pipeline terminated by user.", {})
    except Exception as e:
        job["status"] = "error"
        job["error"] = str(e)
        logger.error(f"Job {job_id} failed: {e}")
        await progress_callback("error", 0, f"Pipeline failed: {str(e)}", {"error": str(e)})
    finally:
        job_tasks.pop(job_id, None)


@app.get("/api/status/{job_id}")
async def get_status(job_id: str):
    """Get current job status."""
    if job_id not in jobs:
        raise HTTPException(status_code=404, detail="Job not found")
    job = jobs[job_id]
    return {
        "job_id": job_id,
        "status": job["status"],
        "metadata": job.get("metadata"),
        "last_progress": job.get("last_progress"),
    }


@app.get("/api/download/{job_id}")
async def download_zip(job_id: str):
    """Download the translated_repo.zip."""
    if job_id not in jobs:
        raise HTTPException(status_code=404, detail="Job not found")

    job = jobs[job_id]
    zip_path = Path(job["output_dir"]).parent / "translated_repo.zip"

    if not zip_path.exists():
        raise HTTPException(status_code=404, detail="ZIP not ready yet")

    return FileResponse(
        str(zip_path),
        media_type="application/zip",
        filename="translated_repo.zip",
    )


@app.get("/api/report/{job_id}")
async def get_report(job_id: str):
    """Get report.md content."""
    if job_id not in jobs:
        raise HTTPException(status_code=404, detail="Job not found")

    report_path = Path(jobs[job_id]["output_dir"]) / "report.md"
    if report_path.exists():
        return {"content": report_path.read_text()}
    return {"content": "Report not yet generated."}


@app.get("/api/graph/{job_id}")
async def get_graph(job_id: str):
    """Get call_graph.json or PNG."""
    if job_id not in jobs:
        raise HTTPException(status_code=404, detail="Job not found")

    json_path = Path(jobs[job_id]["output_dir"]) / "call_graph.json"
    if json_path.exists():
        return json.loads(json_path.read_text())

    return {"nodes": [], "edges": []}


# ── File Tree & Content endpoints ─────────────────────────────────────────────

def _detect_language(filename: str) -> str:
    ext = Path(filename).suffix.lower()
    return {
        ".java": "java", ".cob": "cobol", ".cobol": "cobol",
        ".cbl": "cobol", ".cpy": "cobol", ".py": "python",
        ".txt": "text", ".md": "markdown",
    }.get(ext, "text")


_SKIP_DIRS = {"__pycache__", "venv", ".venv", "node_modules", ".git", "target", "build", "dist", ".gradle", ".idea"}
_SKIP_EXTS = {".class", ".jar", ".war", ".ear", ".pyc", ".pyo", ".o", ".obj", ".exe", ".dll", ".so"}


def _build_file_tree(root: Path, base: Path) -> dict:
    rel = str(root.relative_to(base)).replace("\\", "/")
    if rel == ".":
        rel = ""
    if root.is_file():
        if root.suffix.lower() in _SKIP_EXTS:
            return None
        return {"type": "file", "name": root.name, "path": rel, "language": _detect_language(root.name)}
    children = []
    for child in sorted(root.iterdir(), key=lambda p: (p.is_file(), p.name.lower())):
        if child.name.startswith(".") or child.name in _SKIP_DIRS:
            continue
        node = _build_file_tree(child, base)
        if node is not None:
            children.append(node)
    return {"type": "directory", "name": root.name, "path": rel, "children": children}


@app.get("/api/filetree/{job_id}")
async def get_file_tree_endpoint(job_id: str, tree_type: str = "original"):
    """Return a JSON file tree for the original repo or translated output."""
    if job_id not in jobs:
        raise HTTPException(status_code=404, detail="Job not found")
    job = jobs[job_id]
    root = Path(job["repo_path"] if tree_type == "original" else job["output_dir"])
    if not root.exists():
        return {"type": "directory", "name": "empty", "path": "", "children": []}
    return _build_file_tree(root, root)


@app.get("/api/file-content/{job_id}")
async def get_file_content_endpoint(job_id: str, file_path: str, file_type: str = "original"):
    """Return the text content of a specific file (original or translated)."""
    if job_id not in jobs:
        raise HTTPException(status_code=404, detail="Job not found")
    job = jobs[job_id]
    if file_type == "original":
        base = Path(job["repo_path"]).resolve()
    else:
        base = (Path(job["output_dir"]) / "src").resolve()
    full = (base / file_path).resolve()
    try:
        full.relative_to(base)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid path")
    if not full.exists() or not full.is_file():
        raise HTTPException(status_code=404, detail="File not found")
    # Reject binary files (e.g. .class bytecode) before trying to read as text
    if full.suffix.lower() in _SKIP_EXTS:
        raise HTTPException(status_code=415, detail=f"Binary file type '{full.suffix}' cannot be displayed as text")
    try:
        raw = full.read_bytes()
        # Heuristic: if >10% of the first 512 bytes are null or non-printable, treat as binary
        sample = raw[:512]
        non_text = sum(1 for b in sample if b < 9 or (13 < b < 32))
        if sample and non_text / len(sample) > 0.10:
            raise HTTPException(status_code=415, detail="File appears to be binary and cannot be displayed as text")
        content = raw.decode("utf-8", errors="replace")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    return {"content": content, "path": file_path, "language": _detect_language(full.name)}


@app.get("/api/graph-png/{job_id}")
async def get_graph_png(job_id: str):
    """Get call_graph.png."""
    if job_id not in jobs:
        raise HTTPException(status_code=404, detail="Job not found")

    png_path = Path(jobs[job_id]["output_dir"]) / "call_graph.png"
    if png_path.exists():
        return FileResponse(str(png_path), media_type="image/png")

    raise HTTPException(status_code=404, detail="Graph PNG not ready")


@app.websocket("/ws/{job_id}")
async def websocket_endpoint(websocket: WebSocket, job_id: str):
    """WebSocket endpoint for real-time progress updates."""
    await websocket.accept()

    if job_id not in ws_connections:
        ws_connections[job_id] = []
    ws_connections[job_id].append(websocket)

    try:
        # Send current status immediately
        if job_id in jobs:
            job = jobs[job_id]
            await websocket.send_json({
                "stage": "connected",
                "progress": 0,
                "message": f"Connected to job {job_id} (status: {job['status']})",
                "data": {"status": job["status"]},
            })
            # Send last progress if available
            if "last_progress" in job:
                await websocket.send_json(job["last_progress"])

        # Keep connection alive
        while True:
            try:
                data = await asyncio.wait_for(websocket.receive_text(), timeout=30)
                # Handle ping/pong
                if data == "ping":
                    await websocket.send_text("pong")
            except asyncio.TimeoutError:
                # Send keepalive
                try:
                    await websocket.send_json({"stage": "keepalive", "progress": -1, "message": "", "data": {}})
                except Exception:
                    break

    except WebSocketDisconnect:
        pass
    finally:
        if job_id in ws_connections:
            ws_connections[job_id] = [ws for ws in ws_connections[job_id] if ws != websocket]


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
