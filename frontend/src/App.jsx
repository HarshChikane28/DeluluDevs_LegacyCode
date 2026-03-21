import { useState, useEffect, useRef, useCallback } from "react";

// ─── Configuration ───────────────────────────────────────────────────────────
const API_BASE = "http://localhost:8000";
const WS_BASE = "ws://localhost:8000";

// ─── Animated Background Particles ───────────────────────────────────────────
const ParticleField = () => {
  const canvasRef = useRef(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    let animId;
    let particles = [];
    const resize = () => { canvas.width = canvas.offsetWidth; canvas.height = canvas.offsetHeight; };
    resize();
    window.addEventListener("resize", resize);
    const colors = ["#6366f1", "#06d6a0", "#f72585", "#ffd166", "#118ab2"];
    for (let i = 0; i < 60; i++) {
      particles.push({
        x: Math.random() * canvas.width, y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 0.4, vy: (Math.random() - 0.5) * 0.4,
        r: Math.random() * 3 + 1, color: colors[Math.floor(Math.random() * colors.length)],
        alpha: Math.random() * 0.5 + 0.1,
      });
    }
    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      particles.forEach((p, i) => {
        p.x += p.vx; p.y += p.vy;
        if (p.x < 0 || p.x > canvas.width) p.vx *= -1;
        if (p.y < 0 || p.y > canvas.height) p.vy *= -1;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.alpha;
        ctx.fill();
        // Draw connections
        for (let j = i + 1; j < particles.length; j++) {
          const dx = p.x - particles[j].x, dy = p.y - particles[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 120) {
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.strokeStyle = p.color;
            ctx.globalAlpha = (1 - dist / 120) * 0.15;
            ctx.lineWidth = 0.5;
            ctx.stroke();
          }
        }
      });
      ctx.globalAlpha = 1;
      animId = requestAnimationFrame(draw);
    };
    draw();
    return () => { cancelAnimationFrame(animId); window.removeEventListener("resize", resize); };
  }, []);
  return <canvas ref={canvasRef} style={{ position: "fixed", inset: 0, width: "100%", height: "100%", pointerEvents: "none", zIndex: 0 }} />;
};

// ─── Glowing Orb Animation ──────────────────────────────────────────────────
const GlowOrb = ({ color, size, top, left, delay }) => (
  <div style={{
    position: "fixed", width: size, height: size, borderRadius: "50%",
    background: `radial-gradient(circle, ${color}33 0%, transparent 70%)`,
    top, left, filter: "blur(40px)", pointerEvents: "none", zIndex: 0,
    animation: `orbFloat 8s ease-in-out ${delay}s infinite alternate`,
  }} />
);

// ─── Step indicator ─────────────────────────────────────────────────────────
const STAGES = [
  { key: "parsing", label: "Parse", icon: "P", color: "#6366f1" },
  { key: "graph_building", label: "Graph", icon: "G", color: "#06d6a0" },
  { key: "translating", label: "Translate", icon: "→", color: "#f72585" },
  { key: "compiling", label: "Compile", icon: "C", color: "#ffd166" },
  { key: "fixing", label: "Fix", icon: "F", color: "#ff6b6b" },
  { key: "assembling", label: "Package", icon: "Z", color: "#118ab2" },
  { key: "done", label: "Done", icon: "✓", color: "#06d6a0" },
];

const ProgressStepper = ({ currentStage, progress }) => {
  const stageIdx = STAGES.findIndex(s => s.key === currentStage);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 4, padding: "20px 0", overflowX: "auto" }}>
      {STAGES.map((s, i) => {
        const isActive = s.key === currentStage;
        const isDone = i < stageIdx || currentStage === "done";
        const isFuture = i > stageIdx && currentStage !== "done";
        return (
          <div key={s.key} style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <div style={{
              display: "flex", flexDirection: "column", alignItems: "center", gap: 6,
              opacity: isFuture ? 0.3 : 1, transition: "all 0.5s ease",
              transform: isActive ? "scale(1.1)" : "scale(1)",
            }}>
              <div style={{
                width: 48, height: 48, borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center",
                background: isDone ? `${s.color}22` : isActive ? `${s.color}33` : "#f1f5f9",
                border: `2px solid ${isDone ? s.color : isActive ? s.color : "#e2e8f0"}`,
                boxShadow: isActive ? `0 0 20px ${s.color}44` : "none",
                fontSize: 20, position: "relative", overflow: "hidden",
              }}>
                {isDone ? "✓" : s.icon}
                {isActive && (
                  <div style={{
                    position: "absolute", bottom: 0, left: 0, height: 3,
                    width: `${(progress || 0) * 100}%`,
                    background: s.color, transition: "width 0.3s ease",
                  }} />
                )}
              </div>
              <span style={{
                fontSize: 11, fontWeight: isActive ? 700 : 500,
                color: isDone ? s.color : isActive ? s.color : "#94a3b8",
                fontFamily: "'JetBrains Mono', monospace",
              }}>{s.label}</span>
            </div>
            {i < STAGES.length - 1 && (
              <div style={{
                width: 24, height: 2, marginTop: -16,
                background: isDone ? s.color : "#e2e8f0",
                transition: "background 0.5s ease",
              }} />
            )}
          </div>
        );
      })}
    </div>
  );
};

// ─── Interactive File Tree ────────────────────────────────────────────────────
const FILE_ICONS = { java: "JV", cobol: "CB", python: "PY", text: "TX", markdown: "MD" };

const FileTreeNode = ({ node, depth, onFileSelect, selectedFile }) => {
  const [expanded, setExpanded] = useState(depth < 2);
  const isSelected = node.type === "file" && selectedFile?.path === node.path;

  if (node.type === "file") {
    return (
      <div
        onClick={() => onFileSelect(node)}
        style={{
          paddingLeft: depth * 14 + 10, paddingTop: 5, paddingBottom: 5, paddingRight: 8,
          cursor: "pointer", display: "flex", alignItems: "center", gap: 6,
          background: isSelected ? "#6366f115" : "transparent",
          borderLeft: `2px solid ${isSelected ? "#6366f1" : "transparent"}`,
          fontSize: 12, fontFamily: "'JetBrains Mono', monospace",
          color: isSelected ? "#6366f1" : "#334155",
          transition: "all 0.15s ease",
        }}
      >
        <span style={{ fontSize: 9, flexShrink: 0, fontWeight: 700, color: "#64748b" }}>{FILE_ICONS[node.language] || "TX"}</span>
        <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{node.name}</span>
        {node.translated && <span style={{ color: "#06d6a0", fontSize: 9, flexShrink: 0, fontWeight: 700 }}>✓PY</span>}
      </div>
    );
  }

  return (
    <div>
      <div
        onClick={() => setExpanded(e => !e)}
        style={{
          paddingLeft: depth * 14 + 6, paddingTop: 5, paddingBottom: 5, paddingRight: 8,
          cursor: "pointer", display: "flex", alignItems: "center", gap: 6,
          fontSize: 12, fontFamily: "'JetBrains Mono', monospace",
          color: "#475569", userSelect: "none",
        }}
      >
        <span style={{ fontSize: 9, color: "#94a3b8", width: 10 }}>{expanded ? "v" : ">"}</span>
        <span style={{ fontWeight: 600 }}>{node.name}</span>
      </div>
      {expanded && node.children?.map((child, i) => (
        <FileTreeNode key={i} node={child} depth={depth + 1} onFileSelect={onFileSelect} selectedFile={selectedFile} />
      ))}
    </div>
  );
};

const FileTreeViewer = ({ jobId, onFileSelect, selectedFile, stage }) => {
  const [tree, setTree] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!jobId) return;
    if (jobId === "demo") {
      setTree({
        type: "directory", name: "demo-project", path: "", children: [
          {
            type: "directory", name: "src", path: "src", children: [
              { type: "file", name: "PayrollSystem.java", path: "src/PayrollSystem.java", language: "java", translated: stage === "done" },
              { type: "file", name: "TaxCalculator.java", path: "src/TaxCalculator.java", language: "java", translated: stage === "done" },
              { type: "file", name: "EmployeeRecord.java", path: "src/EmployeeRecord.java", language: "java", translated: stage === "done" },
            ]
          },
        ],
      });
      return;
    }
    setLoading(true);
    fetch(`${API_BASE}/api/filetree/${jobId}?tree_type=original`)
      .then(r => r.json())
      .then(data => { setTree(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, [jobId, stage]);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div style={{
        padding: "10px 14px", borderBottom: "1px solid #f1f5f9",
        display: "flex", alignItems: "center", gap: 8, flexShrink: 0,
      }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: "#475569", flex: 1 }}>Project Files</span>
        {stage === "done" && <span style={{ fontSize: 10, color: "#06d6a0", fontWeight: 700 }}>✓ translated</span>}
      </div>
      <div style={{ overflowY: "auto", flex: 1, paddingTop: 4 }}>
        {loading ? (
          <div style={{ padding: 16, color: "#94a3b8", fontSize: 12, fontStyle: "italic" }}>Loading...</div>
        ) : tree ? (
          tree.children?.map((node, i) => (
            <FileTreeNode key={i} node={node} depth={0} onFileSelect={onFileSelect} selectedFile={selectedFile} />
          ))
        ) : (
          <div style={{ padding: 16, color: "#94a3b8", fontSize: 12, fontStyle: "italic" }}>No files loaded</div>
        )}
      </div>
    </div>
  );
};

// ─── Code Comparison Editor ───────────────────────────────────────────────────
const CodePanel = ({ content, title, accentColor }) => {
  const lines = (content || "").split("\n");
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, overflow: "hidden" }}>
      <div style={{
        padding: "6px 14px", background: "#1e293b", borderBottom: "1px solid #0f172a",
        fontSize: 11, fontWeight: 700, color: accentColor || "#94a3b8",
        fontFamily: "'JetBrains Mono', monospace", flexShrink: 0,
      }}>
        {title}
      </div>
      <div style={{ flex: 1, overflowY: "auto", overflowX: "hidden", background: "#0f172a" }}>
        {lines.map((line, i) => (
          <div key={i} style={{ display: "flex", minHeight: 20 }}>
            <div style={{
              width: 44, textAlign: "right", paddingRight: 12, paddingLeft: 4,
              color: "#334155", fontSize: 11, userSelect: "none", flexShrink: 0,
              fontFamily: "'JetBrains Mono', monospace", lineHeight: "20px",
              borderRight: "1px solid #1e293b",
            }}>
              {i + 1}
            </div>
            <pre style={{
              margin: 0, paddingLeft: 12, flex: 1, fontSize: 12, lineHeight: "20px",
              fontFamily: "'JetBrains Mono', monospace", color: "#e2e8f0",
              whiteSpace: "pre", overflowX: "auto",
            }}>
              {line || " "}
            </pre>
          </div>
        ))}
      </div>
    </div>
  );
};

const CodeComparisonEditor = ({ jobId, selectedFile }) => {
  const [origContent, setOrigContent] = useState(null);
  const [pyContent, setPyContent] = useState(null);
  const [view, setView] = useState("split");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!selectedFile) { setOrigContent(null); setPyContent(null); return; }
    if (jobId === "demo") {
      setOrigContent(
        `// Demo: ${selectedFile.name}\npublic class Example {\n    public static void main(String[] args) {\n        System.out.println("Hello, World!");\n    }\n\n    public static int add(int a, int b) {\n        return a + b;\n    }\n}`
      );
      setPyContent(
        `"""Translated from ${selectedFile.name}"""\n\n\ndef main():\n    print("Hello, World!")\n\n\ndef add(a: int, b: int) -> int:\n    return a + b\n\n\nif __name__ == "__main__":\n    main()\n`
      );
      return;
    }
    setLoading(true);
    const origFetch = fetch(
      `${API_BASE}/api/file-content/${jobId}?file_path=${encodeURIComponent(selectedFile.path)}&file_type=original`
    ).then(r => {
      if (r.status === 415) return { content: "// Binary file — cannot display as text." };
      return r.ok ? r.json() : null;
    }).then(d => d?.content ?? null).catch(() => null);

    // Mirror the backend's _convert_path_to_python logic
    let pyPath = selectedFile.path.replace(/\\/g, "/");
    pyPath = pyPath.replace(/^(src\/main\/java\/|src\/main\/|src\/)/, "");
    pyPath = pyPath.replace(/\.(java|cob|cobol|cbl|cpy)$/i, ".py");

    const pyFetch = fetch(
      `${API_BASE}/api/file-content/${jobId}?file_path=${encodeURIComponent(pyPath)}&file_type=translated`
    ).then(r => r.ok ? r.json() : null).then(d => d?.content ?? null).catch(() => null);

    Promise.all([origFetch, pyFetch]).then(([orig, py]) => {
      setOrigContent(orig);
      setPyContent(py);
      setLoading(false);
    });
  }, [jobId, selectedFile]);

  if (!selectedFile) {
    return (
      <div style={{
        height: 460, display: "flex", alignItems: "center", justifyContent: "center",
        background: "#0f172a", borderRadius: 12, border: "1px solid #1e293b",
        color: "#475569", fontSize: 13, fontFamily: "'JetBrains Mono', monospace",
      }}>
        ← Click a file in the tree to compare
      </div>
    );
  }

  const origName = selectedFile.name;
  const pyName = origName.replace(/\.(java|cob|cobol|cbl|cpy)$/i, ".py");
  const langColor = { java: "#f59e0b", cobol: "#8b5cf6", python: "#06d6a0" };

  return (
    <div style={{ display: "flex", flexDirection: "column", borderRadius: 12, overflow: "hidden", border: "1px solid #1e293b" }}>
      {/* Tab bar */}
      <div style={{ display: "flex", background: "#1e293b", alignItems: "center", flexShrink: 0 }}>
        <span style={{
          padding: "8px 14px", fontSize: 11, color: "#64748b",
          fontFamily: "'JetBrains Mono', monospace", flex: 1,
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        }}>
          {selectedFile.path}
        </span>
        {[["split", "Split"], ["original", "Original"], ["python", "Python"]].map(([v, label]) => (
          <button key={v} onClick={() => setView(v)} style={{
            padding: "8px 14px", border: "none", cursor: "pointer", fontSize: 11, fontWeight: 600,
            background: view === v ? "#0f172a" : "transparent",
            color: view === v ? "#6366f1" : "#64748b",
            fontFamily: "'JetBrains Mono', monospace",
            borderBottom: `2px solid ${view === v ? "#6366f1" : "transparent"}`,
            transition: "all 0.15s ease",
          }}>
            {label}
          </button>
        ))}
      </div>
      {/* Panels */}
      <div style={{ height: 460, display: "flex", overflow: "hidden" }}>
        {loading ? (
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", background: "#0f172a", color: "#475569", fontFamily: "'JetBrains Mono', monospace", fontSize: 12 }}>
            Loading file...
          </div>
        ) : (
          <>
            {(view === "split" || view === "original") && (
              <CodePanel
                content={origContent ?? `// ${origName}\n// Content not available`}
                title={`${origName}  (original)`}
                accentColor={langColor[selectedFile.language] || "#94a3b8"}
              />
            )}
            {view === "split" && <div style={{ width: 2, background: "#334155", flexShrink: 0 }} />}
            {(view === "split" || view === "python") && (
              <CodePanel
                content={pyContent ?? `# ${pyName}\n# Translation not yet available`}
                title={`${pyName}  (translated Python)`}
                accentColor="#06d6a0"
              />
            )}
          </>
        )}
      </div>
    </div>
  );
};

// ─── Translation Log ─────────────────────────────────────────────────────────
const TranslationLog = ({ logs }) => {
  const logRef = useRef(null);
  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [logs]);

  return (
    <div ref={logRef} style={{
      maxHeight: 320, overflowY: "auto", background: "#0f172a", borderRadius: 12,
      padding: 16, fontFamily: "'JetBrains Mono', monospace", fontSize: 12,
      border: "1px solid #1e293b",
    }}>
      {logs.length === 0 ? (
        <div style={{ color: "#475569", fontStyle: "italic" }}>Waiting for translation to begin...</div>
      ) : logs.map((log, i) => (
        <div key={i} style={{
          padding: "4px 0", color: log.includes("translated") || log.includes("compiled") || log.includes("complete") ? "#06d6a0" : log.includes("error") || log.includes("terminated") ? "#ef4444" : log.includes("Translating") ? "#818cf8" : "#94a3b8",
          borderBottom: "1px solid #1e293b22",
          animation: "fadeSlideIn 0.3s ease",
        }}>
          <span style={{ color: "#475569", marginRight: 8 }}>{new Date().toLocaleTimeString()}</span>
          {log}
        </div>
      ))}
      <div style={{ height: 1 }}>
        <span style={{ display: "inline-block", width: 8, height: 14, background: "#6366f1", animation: "blink 1s infinite", marginLeft: 2 }} />
      </div>
    </div>
  );
};

// ─── File Upload Zone ────────────────────────────────────────────────────────
const FileUploadZone = ({ onFilesSelected, files }) => {
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef(null);

  const handleDrop = (e) => {
    e.preventDefault(); setIsDragging(false);
    const droppedFiles = Array.from(e.dataTransfer.files);
    onFilesSelected(droppedFiles);
  };

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
      onClick={() => inputRef.current?.click()}
      style={{
        border: `2px dashed ${isDragging ? "#6366f1" : "#cbd5e1"}`,
        borderRadius: 16, padding: 32, textAlign: "center", cursor: "pointer",
        background: isDragging ? "#6366f108" : "#fafbff",
        transition: "all 0.3s ease",
        transform: isDragging ? "scale(1.01)" : "scale(1)",
      }}
    >
      <input ref={inputRef} type="file" multiple accept=".java,.cob,.cobol,.cbl,.cpy,.zip"
        style={{ display: "none" }} onChange={(e) => onFilesSelected(Array.from(e.target.files))} />
      <div style={{ fontSize: 40, marginBottom: 8 }}>
        {isDragging ? "+" : files.length > 0 ? "+" : "↑"}
      </div>
      <p style={{ color: "#6366f1", fontWeight: 600, fontSize: 15, margin: 0 }}>
        {files.length > 0 ? `${files.length} file(s) selected` : "Drop files here or click to browse"}
      </p>
      <p style={{ color: "#94a3b8", fontSize: 12, marginTop: 4 }}>
        .java, .cob, .cobol, .zip supported
      </p>
      {files.length > 0 && (
        <div style={{ marginTop: 12, display: "flex", flexWrap: "wrap", gap: 6, justifyContent: "center" }}>
          {files.slice(0, 8).map((f, i) => (
            <span key={i} style={{
              background: "#6366f111", color: "#6366f1", padding: "4px 10px",
              borderRadius: 20, fontSize: 11, fontFamily: "'JetBrains Mono', monospace",
            }}>
              {f.name}
            </span>
          ))}
          {files.length > 8 && <span style={{ color: "#94a3b8", fontSize: 11 }}>+{files.length - 8} more</span>}
        </div>
      )}
    </div>
  );
};

// ─── Main App ────────────────────────────────────────────────────────────────
export default function App() {
  const [mode, setMode] = useState("upload"); // "upload" or "github"
  const [githubUrl, setGithubUrl] = useState("");
  const [files, setFiles] = useState([]);
  const [sourceLang, setSourceLang] = useState("auto");
  const [jobId, setJobId] = useState(null);
  const [stage, setStage] = useState(null);
  const [progress, setProgress] = useState(0);
  const [logs, setLogs] = useState([]);
  const [graphData, setGraphData] = useState(null);
  const [metadata, setMetadata] = useState(null);
  const [isStarting, setIsStarting] = useState(false);
  const [error, setError] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const wsRef = useRef(null);

  // Demo mode - simulates the pipeline without a backend
  const [demoMode, setDemoMode] = useState(false);

  // ── Persist / restore job state across page reloads ──────────────────────────
  const PERSIST_KEY = "legacyModernizer_job";
  useEffect(() => {
    const saved = localStorage.getItem(PERSIST_KEY);
    if (!saved) return;
    try {
      const { jobId: jid, stage: s, metadata: m } = JSON.parse(saved);
      if (jid && s) { setJobId(jid); setStage(s); if (m) setMetadata(m); }
    } catch {}
  }, []);
  useEffect(() => {
    if (jobId) {
      localStorage.setItem(PERSIST_KEY, JSON.stringify({ jobId, stage, metadata }));
    }
  }, [jobId, stage, metadata]);

  const runDemo = useCallback(async () => {
    setDemoMode(true);
    setJobId("demo");
    setStage("parsing");
    setProgress(0);
    setLogs([]);
    setError(null);

    const demoFuncs = [
      "getTaxRate", "getIncome", "calculateDeductions", "calculateTax",
      "getEmployee", "processPayroll", "generateReport", "validateInput",
      "formatOutput", "main",
    ];

    const demoGraph = {
      nodes: demoFuncs.map(f => ({ id: `App.java::App.${f}`, label: `App.${f}`, status: "untranslated", file: "App.java", params: [], return_type: "void" })),
      edges: [
        { source: "App.java::App.calculateTax", target: "App.java::App.getTaxRate" },
        { source: "App.java::App.calculateTax", target: "App.java::App.getIncome" },
        { source: "App.java::App.calculateTax", target: "App.java::App.calculateDeductions" },
        { source: "App.java::App.processPayroll", target: "App.java::App.calculateTax" },
        { source: "App.java::App.processPayroll", target: "App.java::App.getEmployee" },
        { source: "App.java::App.generateReport", target: "App.java::App.processPayroll" },
        { source: "App.java::App.generateReport", target: "App.java::App.formatOutput" },
        { source: "App.java::App.main", target: "App.java::App.validateInput" },
        { source: "App.java::App.main", target: "App.java::App.generateReport" },
      ],
    };

    // Stage 1: Parsing
    await new Promise(r => setTimeout(r, 600));
    setLogs(l => [...l, "Scanning repository files..."]);
    setProgress(0.2);
    await new Promise(r => setTimeout(r, 400));
    setLogs(l => [...l, "Found 3 Java files"]);
    setProgress(0.5);
    await new Promise(r => setTimeout(r, 500));
    setLogs(l => [...l, `Parsed App.java (${demoFuncs.length} functions)`]);
    setProgress(1);

    // Stage 2: Graph
    await new Promise(r => setTimeout(r, 300));
    setStage("graph_building"); setProgress(0);
    setLogs(l => [...l, "Building function call graph..."]);
    await new Promise(r => setTimeout(r, 500));
    setGraphData(demoGraph);
    setLogs(l => [...l, `Graph built: ${demoFuncs.length} nodes, ${demoGraph.edges.length} edges`]);
    setProgress(0.6);
    await new Promise(r => setTimeout(r, 300));
    setLogs(l => [...l, "Translation order: 7 groups (leaf-first)"]);
    setProgress(1);

    // Stage 3: Translating
    await new Promise(r => setTimeout(r, 300));
    setStage("translating"); setProgress(0);
    const order = ["getTaxRate", "getIncome", "calculateDeductions", "getEmployee", "validateInput", "formatOutput", "calculateTax", "processPayroll", "generateReport", "main"];

    for (let i = 0; i < order.length; i++) {
      const fname = order[i];
      const deps = demoGraph.edges.filter(e => e.source.includes(fname)).map(e => e.target.split(".").pop());

      setLogs(l => [...l, `Translating ${fname}()${deps.length ? ` — depends on: ${deps.join(", ")}` : " — leaf function"}`]);
      setGraphData(prev => ({
        ...prev,
        nodes: prev.nodes.map(n => n.label.includes(fname) ? { ...n, status: "translating" } : n),
      }));

      await new Promise(r => setTimeout(r, 400 + Math.random() * 300));

      setLogs(l => [...l, `${fname}() translated (${Math.floor(100 + Math.random() * 200)} chars)`]);
      setGraphData(prev => ({
        ...prev,
        nodes: prev.nodes.map(n => n.label.includes(fname) ? { ...n, status: "translated" } : n),
      }));
      setProgress((i + 1) / order.length);
    }

    // Stage 4: Compiling
    await new Promise(r => setTimeout(r, 300));
    setStage("compiling"); setProgress(0.5);
    setLogs(l => [...l, "Running compilation validation..."]);
    await new Promise(r => setTimeout(r, 600));
    setLogs(l => [...l, "All files compiled successfully!"]);
    setProgress(1);

    // Stage 5: Packaging
    await new Promise(r => setTimeout(r, 300));
    setStage("assembling"); setProgress(0.5);
    setLogs(l => [...l, "Generating requirements.txt..."]);
    await new Promise(r => setTimeout(r, 300));
    setLogs(l => [...l, "Packaging final ZIP..."]);
    setProgress(0.9);
    await new Promise(r => setTimeout(r, 400));

    setStage("done"); setProgress(1);
    setLogs(l => [...l, "Modernization complete! Download your translated project."]);
    setMetadata({
      repo: "demo-java-project",
      source: "java", target: "python",
      total_functions: 10, translated_count: 10,
      compile_status: "success", llm_provider_used: "groq",
      requirements_generated: ["pytest"],
      errors: [],
    });
  }, []);

  const startPipeline = async () => {
    setIsStarting(true); setError(null); setLogs([]); setGraphData(null); setMetadata(null);
    try {
      let jid;
      if (mode === "github") {
        const formData = new FormData();
        formData.append("url", githubUrl);
        const resp = await fetch(`${API_BASE}/api/clone`, { method: "POST", body: formData });
        if (!resp.ok) throw new Error(await resp.text());
        const data = await resp.json();
        jid = data.job_id;
      } else {
        const formData = new FormData();
        files.forEach(f => formData.append("files", f));
        const resp = await fetch(`${API_BASE}/api/upload`, { method: "POST", body: formData });
        if (!resp.ok) throw new Error(await resp.text());
        const data = await resp.json();
        jid = data.job_id;
      }

      setJobId(jid);

      // Connect WebSocket
      const ws = new WebSocket(`${WS_BASE}/ws/${jid}`);
      wsRef.current = ws;
      ws.onmessage = (event) => {
        const msg = JSON.parse(event.data);
        if (msg.stage === "keepalive") return;
        setStage(msg.stage);
        if (msg.progress >= 0) setProgress(msg.progress);
        if (msg.message) setLogs(l => [...l, msg.message]);
        if (msg.data?.graph) setGraphData(msg.data.graph);
        if (msg.data?.graph_update && msg.data.graph_update.node_id) {
          setGraphData(prev => {
            if (!prev) return prev;
            return {
              ...prev,
              nodes: prev.nodes.map(n =>
                n.id === msg.data.graph_update.node_id
                  ? { ...n, status: msg.data.graph_update.new_status }
                  : n
              ),
            };
          });
        }
        if (msg.data?.metadata) setMetadata(msg.data.metadata);
      };
      ws.onerror = () => setError("WebSocket connection error");
      ws.onclose = () => {};

      // Start pipeline
      const startForm = new FormData();
      startForm.append("job_id", jid);
      startForm.append("source_lang", sourceLang);
      await fetch(`${API_BASE}/api/start`, { method: "POST", body: startForm });

    } catch (e) {
      setError(e.message);
    } finally {
      setIsStarting(false);
    }
  };

  const canStart = mode === "github" ? githubUrl.trim().length > 0 : files.length > 0;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600;700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'Inter', sans-serif; background: #131313; color: #e5e2e1; }
        @keyframes orbFloat {
          0% { transform: translateY(0) scale(1); }
          100% { transform: translateY(-30px) scale(1.1); }
        }
        @keyframes fadeSlideIn {
          from { opacity: 0; transform: translateX(-8px); }
          to { opacity: 1; transform: translateX(0); }
        }
        @keyframes blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }
        @keyframes shimmer {
          0% { background-position: -200% center; }
          100% { background-position: 200% center; }
        }
        @keyframes pulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(192,193,255,0.35); }
          50% { box-shadow: 0 0 0 12px rgba(192,193,255,0); }
        }
        @keyframes heroGradient {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        ::-webkit-scrollbar { width: 5px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #464554; border-radius: 3px; }
        ::-webkit-scrollbar-thumb:hover { background: #908fa0; }
      `}</style>

      <ParticleField />
      <GlowOrb color="#8083ff" size="400px" top="-100px" left="-100px" delay={0} />
      <GlowOrb color="#ffb783" size="350px" top="60%" left="80%" delay={2} />
      <GlowOrb color="#c0c1ff" size="300px" top="30%" left="50%" delay={4} />

      <div style={{ position: "relative", zIndex: 1, maxWidth: 1000, margin: "0 auto", padding: "24px 28px" }}>
        {/* ── Hero ────────────────────────────────────────────────────── */}
        <header style={{ textAlign: "center", padding: "40px 0 32px" }}>
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 8, marginBottom: 18,
            background: "rgba(192,193,255,0.1)",
            borderRadius: 9999, padding: "5px 18px", fontSize: 12, fontWeight: 600, color: "#c0c1ff",
            border: "1px solid rgba(192,193,255,0.22)", letterSpacing: "0.04em",
          }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#c0c1ff", display: "inline-block" }} /> AI-Powered Legacy Code Modernization
          </div>
          <h1 style={{
            fontSize: "clamp(30px, 5vw, 52px)", fontWeight: 900, letterSpacing: "-0.04em",
            lineHeight: 1.08, marginBottom: 14,
            background: "linear-gradient(135deg, #fff 0%, #c0c1ff 50%, #ffb783 100%)",
            backgroundSize: "300% 300%",
            WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
            animation: "heroGradient 6s ease infinite",
            fontFamily: "'Inter', sans-serif",
          }}>
            Code Modernizer
          </h1>
          <p style={{ color: "#c7c4d7", fontSize: 15, maxWidth: 520, margin: "0 auto", lineHeight: 1.7, fontFamily: "'Inter', sans-serif" }}>
            Transform legacy Java &amp; COBOL codebases into modern Python — function by function, in dependency order, with real-time visualization.
          </p>
        </header>

        {/* ── Input Panel ─────────────────────────────────────────────── */}
        {!stage && (
          <div style={{
            background: "#201f1f", borderRadius: 20, padding: 32,
            boxShadow: "0 8px 40px rgba(0,0,0,0.4)",
            border: "1px solid rgba(70,69,84,0.5)",
            animation: "fadeSlideIn 0.5s ease",
          }}>
            {/* Mode Toggle */}
            <div style={{ display: "flex", gap: 0, marginBottom: 24, background: "#1c1b1b", borderRadius: 12, padding: 4 }}>
              {[["upload", "Upload Files"], ["github", "GitHub URL"]].map(([m, label]) => (
                <button key={m} onClick={() => setMode(m)} style={{
                  flex: 1, padding: "10px 16px", borderRadius: 10, border: "none", cursor: "pointer",
                  background: mode === m ? "#2a2a2a" : "transparent", fontWeight: 600, fontSize: 14,
                  color: mode === m ? "#c0c1ff" : "#908fa0",
                  boxShadow: mode === m ? "0 2px 8px rgba(0,0,0,0.3)" : "none",
                  transition: "all 0.2s ease", fontFamily: "'Inter', sans-serif",
                }}>
                  {label}
                </button>
              ))}
            </div>

            {/* Mode Content */}
            {mode === "github" ? (
              <div style={{ marginBottom: 24 }}>
                <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#908fa0", marginBottom: 8, letterSpacing: "0.08em", textTransform: "uppercase", fontFamily: "'Inter', sans-serif" }}>
                  Repository URL
                </label>
                <input
                  type="text" placeholder="https://github.com/user/repo"
                  value={githubUrl} onChange={e => setGithubUrl(e.target.value)}
                  style={{
                    width: "100%", padding: "13px 16px", borderRadius: 12,
                    border: "1.5px solid #464554", fontSize: 14, outline: "none",
                    fontFamily: "'JetBrains Mono', monospace",
                    background: "#1c1b1b", color: "#e5e2e1",
                    transition: "border-color 0.2s ease",
                  }}
                  onFocus={e => e.target.style.borderColor = "#c0c1ff"}
                  onBlur={e => e.target.style.borderColor = "#464554"}
                />
              </div>
            ) : (
              <div style={{ marginBottom: 24 }}>
                <FileUploadZone files={files} onFilesSelected={setFiles} />
              </div>
            )}

            {/* Language Selector */}
            <div style={{ marginBottom: 24 }}>
              <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#908fa0", marginBottom: 8, letterSpacing: "0.08em", textTransform: "uppercase", fontFamily: "'Inter', sans-serif" }}>
                Source Language
              </label>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {[["auto", "Auto-detect"], ["java", "Java"], ["cobol", "COBOL"]].map(([v, label]) => (
                  <button key={v} onClick={() => setSourceLang(v)} style={{
                    padding: "9px 20px", borderRadius: 9999,
                    border: `1.5px solid ${sourceLang === v ? "#c0c1ff" : "#464554"}`,
                    background: sourceLang === v ? "rgba(192,193,255,0.1)" : "transparent",
                    color: sourceLang === v ? "#c0c1ff" : "#908fa0",
                    fontWeight: 600, fontSize: 13, cursor: "pointer",
                    transition: "all 0.2s ease", fontFamily: "'Inter', sans-serif",
                    letterSpacing: "0.01em",
                  }}>
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Action Buttons */}
            <div style={{ display: "flex", gap: 12 }}>
              <button
                onClick={startPipeline}
                disabled={!canStart || isStarting}
                style={{
                  flex: 1, padding: "13px 24px", borderRadius: 9999, border: "none",
                  background: canStart ? "linear-gradient(135deg, #8083ff, #c0c1ff)" : "#2a2a2a",
                  color: canStart ? "#131313" : "#464554",
                  fontWeight: 700, fontSize: 14, cursor: canStart ? "pointer" : "not-allowed",
                  transition: "all 0.2s ease", fontFamily: "'Inter', sans-serif",
                  boxShadow: canStart ? "0 0 20px rgba(128,131,255,0.3)" : "none",
                  animation: canStart ? "pulse 2s infinite" : "none",
                  letterSpacing: "0.01em",
                }}
              >
                {isStarting ? "Starting…" : "Start Modernization"}
              </button>
              <button onClick={runDemo} style={{
                padding: "13px 24px", borderRadius: 9999,
                border: "1.5px solid #ffb783",
                background: "transparent", color: "#ffb783",
                fontWeight: 700, fontSize: 14, cursor: "pointer",
                transition: "all 0.2s ease", fontFamily: "'Inter', sans-serif",
                letterSpacing: "0.01em",
              }}>
                ▶ Demo
              </button>
            </div>

            {error && (
              <div style={{
                marginTop: 16, padding: "12px 16px", borderRadius: 10,
                background: "#93000a30", border: "1px solid rgba(255,180,171,0.3)", color: "#ffb4ab",
                fontSize: 13, fontFamily: "'JetBrains Mono', monospace",
              }}>
                {error}
              </div>
            )}
          </div>
        )}

        {/* ── Progress Area ───────────────────────────────────────────── */}
        {stage && (
          <div style={{ display: "flex", flexDirection: "column", gap: 20, animation: "fadeSlideIn 0.4s ease" }}>
            {/* Progress Stepper */}
            <div style={{
              background: "#201f1f", borderRadius: 20, padding: "16px 24px",
              boxShadow: "0 8px 40px rgba(0,0,0,0.4)",
              border: "1px solid rgba(70,69,84,0.5)",
              display: "flex", alignItems: "center", gap: 16,
            }}>
              <div style={{ flex: 1 }}>
                <ProgressStepper currentStage={stage} progress={progress} />
              </div>
              {!demoMode && !["done", "error", "cancelled"].includes(stage) && (
                <button
                  onClick={async () => {
                    try {
                      await fetch(`${API_BASE}/api/cancel/${jobId}`, { method: "POST" });
                    } catch {}
                    if (wsRef.current) wsRef.current.close();
                    setStage("cancelled");
                    setLogs(l => [...l, "Pipeline terminated by user."]);
                  }}
                  style={{
                    padding: "9px 20px", borderRadius: 9999, border: "1.5px solid #ffb4ab",
                    background: "transparent", color: "#ffb4ab",
                    fontWeight: 600, fontSize: 13, cursor: "pointer",
                    fontFamily: "'Inter', sans-serif", flexShrink: 0,
                    transition: "all 0.2s ease",
                  }}
                  onMouseEnter={e => { e.target.style.background = "#ef44440f"; }}
                  onMouseLeave={e => { e.target.style.background = "transparent"; }}
                >
                  Terminate
                </button>
              )}
              {["done", "error", "cancelled"].includes(stage) && (
                <button
                  onClick={() => {
                    setStage(null); setJobId(null); setLogs([]); setGraphData(null);
                    setMetadata(null); setProgress(0); setDemoMode(false);
                    setSelectedFile(null);
                    localStorage.removeItem("legacyModernizer_job");
                  }}
                  style={{
                    padding: "9px 20px", borderRadius: 9999, border: "1.5px solid #c0c1ff",
                    background: "transparent", color: "#c0c1ff",
                    fontWeight: 600, fontSize: 13, cursor: "pointer",
                    fontFamily: "'Inter', sans-serif", flexShrink: 0,
                    transition: "all 0.2s ease",
                  }}
                  onMouseEnter={e => { e.target.style.background = "#6366f10f"; }}
                  onMouseLeave={e => { e.target.style.background = "transparent"; }}
                >
                  New Project
                </button>
              )}
            </div>

            {/* File Tree + Code Comparison — only after completion */}
            {stage === "done" && (
              <div style={{ display: "grid", gridTemplateColumns: "260px 1fr", gap: 16, alignItems: "start" }}>
                {/* File Tree */}
                <div style={{
                  background: "#201f1f", borderRadius: 20, overflow: "hidden",
                  boxShadow: "0 8px 40px rgba(0,0,0,0.4)", border: "1px solid rgba(70,69,84,0.5)",
                  minHeight: 460,
                }}>
                  <FileTreeViewer
                    jobId={jobId}
                    onFileSelect={setSelectedFile}
                    selectedFile={selectedFile}
                    stage={stage}
                  />
                </div>
                {/* Code Editor */}
                <div style={{ minWidth: 0 }}>
                  <CodeComparisonEditor jobId={jobId} selectedFile={selectedFile} />
                </div>
              </div>
            )}

            {/* Translation Log */}
            <div style={{
              background: "#201f1f", borderRadius: 20, padding: 24,
              boxShadow: "0 8px 40px rgba(0,0,0,0.4)",
              border: "1px solid rgba(70,69,84,0.5)",
            }}>
              <h3 style={{
                fontSize: 14, fontWeight: 700, marginBottom: 16, display: "flex", alignItems: "center", gap: 8,
                color: "#e5e2e1", letterSpacing: "0.06em", textTransform: "uppercase", fontFamily: "'Inter', sans-serif",
              }}>
                <span style={{
                  width: 26, height: 26, borderRadius: 7,
                  background: "rgba(192,193,255,0.12)",
                  display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13,
                }}>→</span>
                Live Translation Log
              </h3>
              <TranslationLog logs={logs} />
            </div>

            {/* ── Cancelled Banner ────────────────────────────────────── */}
            {stage === "cancelled" && (
              <div style={{
                background: "#93000a25", borderRadius: 20, padding: 28,
                border: "1px solid rgba(255,180,171,0.25)", textAlign: "center",
                animation: "fadeSlideIn 0.4s ease",
              }}>
                <div style={{ fontSize: 36, marginBottom: 8 }}></div>
                <h2 style={{ fontSize: 18, fontWeight: 800, color: "#ffb4ab", marginBottom: 6, fontFamily: "'Inter', sans-serif", letterSpacing: "-0.03em" }}>
                  Pipeline Terminated
                </h2>
                <p style={{ color: "#908fa0", marginBottom: 20, fontFamily: "'Inter', sans-serif" }}>The translation process was stopped.</p>
                <button onClick={() => {
                  setStage(null); setJobId(null); setLogs([]); setGraphData(null);
                  setMetadata(null); setProgress(0); setDemoMode(false);
                  setSelectedFile(null);
                  localStorage.removeItem("legacyModernizer_job");
                }} style={{
                  padding: "10px 24px", borderRadius: 9999, border: "1.5px solid #464554",
                  background: "transparent", color: "#c7c4d7", fontWeight: 600, fontSize: 13,
                  cursor: "pointer", fontFamily: "'Inter', sans-serif",
                }}>
                  New Project
                </button>
              </div>
            )}

            {/* ── Download Panel (when done) ──────────────────────────── */}
            {stage === "done" && metadata && (
              <div style={{
                background: "rgba(192,193,255,0.06)",
                borderRadius: 20, padding: 32,
                border: "1px solid rgba(192,193,255,0.2)",
                animation: "fadeSlideIn 0.5s ease",
              }}>
                <div style={{ textAlign: "center", marginBottom: 24 }}>
                  <div style={{ fontSize: 44, marginBottom: 8 }}></div>
                  <h2 style={{ fontSize: 22, fontWeight: 800, color: "#c0c1ff", marginBottom: 4, fontFamily: "'Inter', sans-serif", letterSpacing: "-0.04em" }}>
                    Modernization Complete!
                  </h2>
                  <p style={{ color: "#908fa0", fontFamily: "'Inter', sans-serif" }}>Your translated Python project is ready.</p>
                </div>

                {/* Stats Grid */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12, marginBottom: 24 }}>
                  {[
                    ["Functions", metadata.total_functions, "#c0c1ff"],
                    ["Translated", metadata.translated_count, "#ffb783"],
                    ["Compile", metadata.compile_status, metadata.compile_status === "success" ? "#c0c1ff" : "#fbbf24"],
                    ["Provider", metadata.llm_provider_used, "#c0c1ff"],
                  ].map(([label, value, color]) => (
                    <div key={label} style={{
                      background: "#1c1b1b", borderRadius: 12, padding: "16px 20px",
                      border: "1px solid rgba(70,69,84,0.5)", textAlign: "center",
                    }}>
                      <div style={{ fontSize: 20, fontWeight: 800, color, fontFamily: "'Inter', sans-serif", letterSpacing: "-0.04em" }}>{value}</div>
                      <div style={{ fontSize: 10, color: "#908fa0", fontWeight: 600, marginTop: 4, letterSpacing: "0.08em", textTransform: "uppercase", fontFamily: "'Inter', sans-serif" }}>{label}</div>
                    </div>
                  ))}
                </div>

                {/* Dependencies */}
                {metadata.requirements_generated?.length > 0 && (
                  <div style={{ marginBottom: 20 }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: "#908fa0", marginBottom: 10, letterSpacing: "0.08em", textTransform: "uppercase", fontFamily: "'Inter', sans-serif" }}>
                      Generated Dependencies
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                      {metadata.requirements_generated.map(dep => (
                        <span key={dep} style={{
                          background: "rgba(192,193,255,0.1)", color: "#c0c1ff", padding: "4px 12px",
                          borderRadius: 9999, fontSize: 11, fontFamily: "'JetBrains Mono', monospace",
                          border: "1px solid rgba(192,193,255,0.2)",
                        }}>
                          {dep}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Download Button */}
                <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
                  {!demoMode ? (
                    <a href={`${API_BASE}/api/download/${jobId}`} style={{
                      display: "inline-flex", alignItems: "center", gap: 8,
                      padding: "13px 28px", borderRadius: 9999, textDecoration: "none",
                      background: "linear-gradient(135deg, #8083ff, #c0c1ff)",
                      color: "#131313", fontWeight: 700, fontSize: 14,
                      boxShadow: "0 0 22px rgba(128,131,255,0.3)",
                      transition: "all 0.2s", fontFamily: "'Inter', sans-serif",
                      letterSpacing: "0.01em",
                    }}>
                      Download translated_repo.zip
                    </a>
                  ) : (
                    <div style={{
                      padding: "13px 28px", borderRadius: 9999,
                      background: "linear-gradient(135deg, #8083ff, #c0c1ff)",
                      color: "#131313", fontWeight: 700, fontSize: 14,
                      boxShadow: "0 0 22px rgba(128,131,255,0.3)",
                      fontFamily: "'Inter', sans-serif",
                    }}>
                      Download translated_repo.zip (demo)
                    </div>
                  )}
                  <button onClick={() => {
                    setStage(null); setJobId(null); setLogs([]); setGraphData(null);
                    setMetadata(null); setProgress(0); setDemoMode(false);
                    setSelectedFile(null);
                    localStorage.removeItem("legacyModernizer_job");
                  }} style={{
                    padding: "13px 24px", borderRadius: 9999, border: "1.5px solid #464554",
                    background: "transparent", color: "#c7c4d7", fontWeight: 600, fontSize: 13,
                    cursor: "pointer", fontFamily: "'Inter', sans-serif",
                  }}>
                    New Project
                  </button>
                </div>

                {/* Errors */}
                {metadata.errors?.length > 0 && (
                  <div style={{ marginTop: 20, padding: 16, background: "#fef2f2", borderRadius: 12, border: "1px solid #fecaca" }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "#dc2626", marginBottom: 8 }}>
                      {metadata.errors.length} issue(s) reported
                    </div>
                    {metadata.errors.slice(0, 5).map((e, i) => (
                      <div key={i} style={{ fontSize: 12, color: "#991b1b", fontFamily: "'JetBrains Mono', monospace", marginBottom: 4 }}>
                        • {e.function}: {e.error?.substring(0, 100)}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── Footer ──────────────────────────────────────────────────── */}
        <footer style={{
          textAlign: "center", padding: "40px 0 24px",
          color: "#908fa0", fontSize: 12, borderTop: "1px solid rgba(70,69,84,0.3)", marginTop: 8,
        }}>
          <div style={{ display: "flex", justifyContent: "center", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
            {["Context-Aware Translation", "Dependency-Order Execution", "Groq + Gemini LLMs", "Real-Time Visualization"].map(f => (
              <span key={f} style={{
                background: "rgba(53,53,52,0.6)", padding: "4px 12px", borderRadius: 9999, fontSize: 10,
                color: "#c7c4d7", fontWeight: 500, border: "1px solid rgba(70,69,84,0.4)",
                fontFamily: "'Inter', sans-serif", letterSpacing: "0.02em",
              }}>
                {f}
              </span>
            ))}
          </div>
          <span style={{ fontFamily: "'Inter', sans-serif", fontSize: 12, color: "#464554" }}>
            CodeModernizer — Built with FastAPI · React · NetworkX · AI
          </span>
        </footer>
      </div>
    </>
  );
}
