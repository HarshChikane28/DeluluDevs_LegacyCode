# Legacy Code Modernizer 🚀

> AI-powered tool that transforms legacy Java & COBOL codebases into modern Python — function by function, in dependency order, with real-time visualization.

## Key Technique: Context Optimization

The core innovation is **Context Optimization** — feeding only relevant function dependencies to the LLM while stripping noisy comments and dead code. This dramatically reduces hallucinations and improves translation accuracy.

### How It Works

1. **Parse** → Extract functions/procedures from Java (javalang) or COBOL (regex-based) source files
2. **Build Graph** → Construct a NetworkX call graph of function dependencies
3. **Topological Sort** → Order functions leaf-first (callees before callers)
4. **Context Optimize** → Filter comments (keep reasoning, strip boilerplate/dead code)
5. **Translate** → Send each function + its already-translated dependencies to the LLM
6. **Validate** → Compile translated Python code, auto-fix errors up to 3 times
7. **Package** → Generate requirements.txt, report, graph PNG, and downloadable ZIP

## Architecture

```
┌──────────────────────┐     WebSocket      ┌────────────────────────┐
│   React Frontend     │◄──────────────────►│   FastAPI Backend       │
│                      │                     │                        │
│  • File Upload       │     REST API        │  • Parser (Java/COBOL) │
│  • GitHub Clone      │◄──────────────────►│  • Graph Builder        │
│  • Progress Tracker  │                     │  • Comment Filter       │
│  • Graph Viz         │                     │  • LLM Translator       │
│  • Translation Log   │                     │  • Compile Validator    │
│  • Download Panel    │                     │  • Requirements Builder │
└──────────────────────┘                     └────────────────────────┘
                                                       │
                                              ┌────────┴────────┐
                                              │   LLM APIs      │
                                              │  Groq (primary)  │
                                              │  Gemini (backup)  │
                                              └─────────────────┘
```

## Quick Start

### Prerequisites
- Python 3.10+
- Node.js 18+
- Groq API key (free at https://console.groq.com)
- Optional: Gemini API key (free at https://aistudio.google.com)

### Backend Setup
```bash
cd backend
pip install -r requirements.txt
cp .env.example .env
# Edit .env with your API keys
python main.py
```

### Frontend Setup
```bash
cd frontend
npm install
npm run dev
```

### Usage
1. Open http://localhost:5173 in your browser
2. Upload Java/COBOL files OR paste a GitHub URL
3. Select source language (or auto-detect)
4. Click "Start Modernization"
5. Watch the real-time translation progress
6. Download the translated Python project as a ZIP

## Context Optimization (Comment Filter)

The comment filter is the **key differentiator** — it reduces LLM hallucinations by:

| Rule | Action | Example |
|------|--------|---------|
| Reasoning language | **KEEP** | `// because the API returns null for deleted users` |
| Boilerplate | **STRIP** | `// Created by John on 2023-01-15` |
| Commented-out code | **STRIP** | `// return calculateOldTax(income);` |
| Trivial comments | **STRIP** | `// increment` |
| Default | **KEEP** | Any comment not matching above rules |

## LLM Providers

| Provider | Model | Free Tier | Use |
|----------|-------|-----------|-----|
| **Groq** | Llama 3.3 70B | ~30 req/min | Primary |
| **Gemini** | Gemini 2.0 Flash | 15 req/min | Fallback |

Automatic failover: if Groq is rate-limited, the system silently switches to Gemini.

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/upload` | Upload source files |
| POST | `/api/clone` | Clone GitHub repo |
| POST | `/api/start` | Start translation pipeline |
| GET | `/api/status/{job_id}` | Get job status |
| GET | `/api/download/{job_id}` | Download translated ZIP |
| GET | `/api/report/{job_id}` | Get report content |
| WS | `/ws/{job_id}` | Real-time progress stream |

## Output Files

| File | Description |
|------|-------------|
| `translated_repo/src/` | Translated Python source files |
| `requirements.txt` | Auto-generated dependencies |
| `metadata.json` | Run statistics and results |
| `report.md` | Human-readable summary |
| `call_graph.png` | Dependency graph visualization |
| `functions.json` | Parsed function metadata |
| `call_graph.json` | Graph structure (JSON) |

## Tech Stack

- **Backend**: Python, FastAPI, NetworkX, javalang, matplotlib
- **Frontend**: React, Canvas API (graph viz), WebSocket
- **LLM**: Groq API, Google Gemini API
- **Styling**: Custom CSS with animations

## License

MIT
