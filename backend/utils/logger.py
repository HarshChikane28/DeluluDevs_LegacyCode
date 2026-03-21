import logging
import json
import os
from datetime import datetime
from pathlib import Path

LOG_DIR = Path("logs")
LOG_DIR.mkdir(exist_ok=True)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    handlers=[
        logging.FileHandler(LOG_DIR / "app.log"),
        logging.StreamHandler(),
    ],
)

logger = logging.getLogger("legacy-modernizer")


def log_llm_request(provider: str, prompt: str, response: str, tokens: int = 0):
    """Log LLM request/response to JSONL file."""
    entry = {
        "timestamp": datetime.utcnow().isoformat(),
        "provider": provider,
        "prompt_length": len(prompt),
        "response_length": len(response),
        "tokens": tokens,
        "prompt_preview": prompt[:200] + "..." if len(prompt) > 200 else prompt,
        "response_preview": response[:200] + "..." if len(response) > 200 else response,
    }
    with open(LOG_DIR / "requests.jsonl", "a") as f:
        f.write(json.dumps(entry) + "\n")


def log_compiler_error(file_path: str, stderr: str, attempt: int):
    """Log compiler errors."""
    with open(LOG_DIR / "compiler_stderr.log", "a") as f:
        f.write(f"\n{'='*60}\n")
        f.write(f"Timestamp: {datetime.utcnow().isoformat()}\n")
        f.write(f"File: {file_path}\n")
        f.write(f"Attempt: {attempt}\n")
        f.write(f"Stderr:\n{stderr}\n")


