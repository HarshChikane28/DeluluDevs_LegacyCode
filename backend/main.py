"""FastAPI entry point with REST endpoints and WebSocket for real-time progress."""
import os
import sys
import json
import uuid
import shutil
import asyncio
import zipfile
import tempfile
from datetime import datetime
from pathlib import Path
from typing import Dict, Any

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, UploadFile, File, Form, HTTPException
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

# Working directories
WORK_DIR = Path(tempfile.gettempdir()) / "legacy-modernizer-jobs"
WORK_DIR.mkdir(exist_ok=True)


@app.get("/api/health")
async def health():
    return {"status": "ok", "timestamp": datetime.utcnow().isoformat()}


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

    # Run pipeline in background
    asyncio.create_task(_run_job(job_id, source_lang))

    return {"job_id": job_id, "status": "running"}


async def _run_job(job_id: str, source_lang: str):
    """Background task to run the translation pipeline."""
    job = jobs[job_id]

    safe_output_dir = str(Path(job["output_dir"]).resolve().absolute())

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
            output_dir=safe_output_dir,
            progress_callback=progress_callback,
        )
        job["status"] = "completed"
        job["metadata"] = metadata
    except Exception as e:
        job["status"] = "error"
        job["error"] = str(e)
        logger.error(f"Job {job_id} failed: {e}")
        await progress_callback("error", 0, f"Pipeline failed: {str(e)}", {"error": str(e)})


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
