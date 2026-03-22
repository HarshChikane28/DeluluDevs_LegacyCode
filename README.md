# Legacy Code Modernizer

> AI-powered tool that transforms legacy Java & COBOL codebases into modern Python — function by function, in dependency order, with real-time visualization.

## What It Does

Most AI code translation tools dump an entire file into an LLM and hope for the best. This causes hallucinations and broken output. Our approach is different:

1. **Parse** — Extract every function/procedure from Java or COBOL source files
2. **Build Graph** — Construct a call graph of function dependencies using NetworkX
3. **Topological Sort** — Order functions leaf-first (callees before callers)
4. **Context Optimize** — Strip boilerplate comments, keep reasoning comments, remove dead code
5. **Translate** — Send each function + its already-translated dependencies to the LLM
6. **Validate** — Compile translated Python, auto-fix errors up to 3 times
7. **Package** — Generate `requirements.txt`, report, graph PNG, and downloadable ZIP

The key insight: the LLM only sees what it needs. Smaller, cleaner context = fewer hallucinations = better translations.

## Architecture

```
┌──────────────────────┐     WebSocket      ┌────────────────────────┐
│   React Frontend     │◄──────────────────►│   FastAPI Backend      │
│   (Vercel)           │                    │   (Render)             │
│                      │     REST API       │                        │
│  • File Upload       │◄──────────────────►│  • Parser (Java/COBOL) │
│  • GitHub Clone      │                    │  • Graph Builder       │
│  • Progress Tracker  │                    │  • Comment Filter      │
│  • Graph Viz         │                    │  • LLM Translator      │
│  • Translation Log   │                    │  • Compile Validator   │
│  • Download Panel    │                    │  • Requirements Builder│
└──────────────────────┘                    └────────────────────────┘
                                                       │
                                              ┌────────┴────────┐
                                              │   LLM APIs      │
                                              │  Groq (primary) │
                                              │  Gemini (backup)│
                                              └─────────────────┘
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, Vite, Tailwind CSS, Canvas API |
| Backend | Python, FastAPI, uvicorn, WebSockets |
| Parsing | javalang (Java), regex-based (COBOL) |
| Graph | NetworkX, matplotlib |
| LLM | Groq API (Llama 3.3 70B), Google Gemini 2.0 Flash |

## Context Optimization (Comment Filter)

The comment filter is the core differentiator — it reduces LLM hallucinations by pruning noise before sending code to the model:

| Rule | Action | Example |
|------|--------|---------|
| Reasoning language | KEEP | `// because the API returns null for deleted users` |
| Boilerplate | STRIP | `// Created by John on 2023-01-15` |
| Commented-out code | STRIP | `// return calculateOldTax(income);` |
| Trivial comments | STRIP | `// increment` |
| Default | KEEP | Any comment not matching above rules |

## LLM Providers

| Provider | Model | Free Tier | Role |
|----------|-------|-----------|------|
| Groq | Llama 3.3 70B | ~30 req/min | Primary |
| Gemini | Gemini 2.0 Flash | 15 req/min | Automatic fallback |

If Groq hits a rate limit, the system silently switches to Gemini mid-job.

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/upload` | Upload source files or ZIP |
| POST | `/api/clone` | Clone a GitHub repo |
| POST | `/api/start` | Start translation pipeline |
| POST | `/api/cancel/{job_id}` | Cancel a running job |
| GET | `/api/status/{job_id}` | Poll job status |
| GET | `/api/download/{job_id}` | Download translated ZIP |
| GET | `/api/report/{job_id}` | Get markdown report |
| GET | `/api/graph/{job_id}` | Get call graph JSON |
| GET | `/api/filetree/{job_id}` | Browse original or translated files |
| WS | `/ws/{job_id}` | Real-time progress stream |

## Output Files

| File | Description |
|------|-------------|
| `translated_repo/src/` | Translated Python source files |
| `requirements.txt` | Auto-generated Python dependencies |
| `metadata.json` | Run statistics and per-function results |
| `report.md` | Human-readable translation summary |
| `call_graph.png` | Dependency graph visualization |

---

## Running Locally

### Prerequisites
- Python 3.10+
- Node.js 18+
- Groq API key (free at https://console.groq.com)
- Gemini API key (optional fallback, free at https://aistudio.google.com)

### Backend
```bash
cd backend
python -m venv venv
venv\Scripts\activate        # Windows
# source venv/bin/activate   # Mac/Linux
pip install -r requirements.txt
cp .env.example .env
# Edit .env and add your GROQ_API_KEY and GEMINI_API_KEY
python main.py
# Backend runs at http://localhost:8000
```

### Frontend
```bash
cd frontend
npm install
npm run dev
# Frontend runs at http://localhost:5173
```

Open `http://localhost:5173`. The Vite dev server proxies `/api` and `/ws` to the backend automatically.

---

## Deploying for Public Access

The backend requires WebSockets and long-running background tasks, so it cannot run on Vercel. The recommended split is:

| Part | Platform | Why |
|------|----------|-----|
| Backend (FastAPI) | Render | Supports WebSockets, persistent processes, free tier |
| Frontend (React) | Vercel | Optimized for static/React builds, free tier |

### Step 1 — Fix the API URL

In `frontend/src/utils/api.js`, the base URL reads from an environment variable:
```js
const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8000";
```
In `frontend/src/hooks/useWebSocket.js`, the WebSocket URL is derived from the same variable:
```js
const apiBase = import.meta.env.VITE_API_URL || "http://localhost:8000";
const wsUrl = `${apiBase.replace(/^http/, "ws")}/ws/${jobId}`;
```

### Step 2 — Deploy Backend to Render

1. Go to [render.com](https://render.com) → New → Web Service
2. Connect your GitHub repository
3. Configure:
   - **Root directory**: `backend`
   - **Build command**: `pip install -r requirements.txt`
   - **Start command**: `uvicorn main:app --host 0.0.0.0 --port $PORT`
4. Add environment variables: `GROQ_API_KEY`, `GEMINI_API_KEY`
5. Deploy — you get a URL like `https://your-app.onrender.com`

### Step 3 — Deploy Frontend to Vercel

1. Go to [vercel.com](https://vercel.com) → New Project → import your repository
2. Set **Root Directory** to `frontend`
3. Add environment variable: `VITE_API_URL` = `https://your-app.onrender.com`
4. Deploy — you get a public URL anyone can visit

---

## License

MIT
