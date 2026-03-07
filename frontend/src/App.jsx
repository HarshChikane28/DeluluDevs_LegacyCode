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
  { key: "parsing", label: "Parse", icon: "📄", color: "#6366f1" },
  { key: "graph_building", label: "Graph", icon: "🕸️", color: "#06d6a0" },
  { key: "translating", label: "Translate", icon: "⚡", color: "#f72585" },
  { key: "compiling", label: "Compile", icon: "🔧", color: "#ffd166" },
  { key: "fixing", label: "Fix", icon: "🩹", color: "#ff6b6b" },
  { key: "assembling", label: "Package", icon: "📦", color: "#118ab2" },
  { key: "done", label: "Done", icon: "✅", color: "#06d6a0" },
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

// ─── Interactive Graph Visualization ─────────────────────────────────────────
const GraphViewer = ({ graphData }) => {
  const canvasRef = useRef(null);
  const nodesRef = useRef([]);
  const edgesRef = useRef([]);

  useEffect(() => {
    if (!graphData?.nodes?.length) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const W = canvas.offsetWidth, H = canvas.offsetHeight;
    canvas.width = W; canvas.height = H;

    const statusColors = {
      untranslated: "#94a3b8", translating: "#6366f1",
      translated: "#06d6a0", verified: "#059669", error: "#ef4444",
    };

    // Initialize node positions in a circle layout
    const nodes = graphData.nodes.map((n, i) => {
      const angle = (2 * Math.PI * i) / graphData.nodes.length;
      const rx = W * 0.35, ry = H * 0.35;
      return {
        ...n, x: W / 2 + rx * Math.cos(angle), y: H / 2 + ry * Math.sin(angle),
        vx: 0, vy: 0, targetX: W / 2 + rx * Math.cos(angle), targetY: H / 2 + ry * Math.sin(angle),
      };
    });
    nodesRef.current = nodes;

    const nodeMap = {};
    nodes.forEach(n => nodeMap[n.id] = n);
    const edges = graphData.edges.map(e => ({
      source: nodeMap[e.source], target: nodeMap[e.target],
    })).filter(e => e.source && e.target);
    edgesRef.current = edges;

    let animId;
    const draw = () => {
      ctx.clearRect(0, 0, W, H);

      // Draw edges
      edges.forEach(e => {
        if (!e.source || !e.target) return;
        ctx.beginPath();
        ctx.moveTo(e.source.x, e.source.y);
        ctx.lineTo(e.target.x, e.target.y);
        ctx.strokeStyle = "#6366f133";
        ctx.lineWidth = 1;
        ctx.stroke();

        // Arrow
        const dx = e.target.x - e.source.x, dy = e.target.y - e.source.y;
        const len = Math.sqrt(dx * dx + dy * dy);
        if (len > 30) {
          const nx = dx / len, ny = dy / len;
          const ax = e.target.x - nx * 14, ay = e.target.y - ny * 14;
          ctx.beginPath();
          ctx.moveTo(ax - ny * 4, ay + nx * 4);
          ctx.lineTo(e.target.x - nx * 10, e.target.y - ny * 10);
          ctx.lineTo(ax + ny * 4, ay - nx * 4);
          ctx.fillStyle = "#6366f144";
          ctx.fill();
        }
      });

      // Draw nodes
      nodes.forEach(n => {
        const color = statusColors[n.status] || "#94a3b8";
        const r = 8;

        // Glow for active nodes
        if (n.status === "translating") {
          ctx.beginPath();
          ctx.arc(n.x, n.y, r + 8, 0, Math.PI * 2);
          ctx.fillStyle = color + "33";
          ctx.fill();
        }

        ctx.beginPath();
        ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();
        ctx.strokeStyle = "#fff";
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Label
        const label = (n.label || n.id).split(".").pop().substring(0, 15);
        ctx.font = "10px 'JetBrains Mono', monospace";
        ctx.fillStyle = "#334155";
        ctx.textAlign = "center";
        ctx.fillText(label, n.x, n.y + r + 14);
      });

      animId = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(animId);
  }, [graphData]);

  if (!graphData?.nodes?.length) {
    return (
      <div style={{ height: 300, display: "flex", alignItems: "center", justifyContent: "center", color: "#94a3b8", fontStyle: "italic" }}>
        Graph will appear after parsing...
      </div>
    );
  }

  return (
    <div style={{ position: "relative", borderRadius: 16, overflow: "hidden", border: "1px solid #e2e8f0" }}>
      <canvas ref={canvasRef} style={{ width: "100%", height: 350, background: "#fafbff" }} />
      <div style={{ position: "absolute", bottom: 8, right: 12, display: "flex", gap: 12, fontSize: 10, color: "#64748b" }}>
        {[["#94a3b8", "Pending"], ["#6366f1", "Translating"], ["#06d6a0", "Done"], ["#ef4444", "Error"]].map(([c, l]) => (
          <span key={l} style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: c, display: "inline-block" }} />{l}
          </span>
        ))}
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
          padding: "4px 0", color: log.includes("✓") ? "#06d6a0" : log.includes("✗") ? "#ef4444" : log.includes("Translating") ? "#818cf8" : "#94a3b8",
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
        {isDragging ? "🎯" : files.length > 0 ? "📁" : "📂"}
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
  const wsRef = useRef(null);

  // Demo mode - simulates the pipeline without a backend
  const [demoMode, setDemoMode] = useState(false);

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

      setLogs(l => [...l, `✓ ${fname}() translated (${Math.floor(100 + Math.random() * 200)} chars)`]);
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
    setLogs(l => [...l, "✓ All files compiled successfully!"]);
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
    setLogs(l => [...l, "🎉 Modernization complete! Download your translated project."]);
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
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700&family=Space+Grotesk:wght@400;500;600;700&family=Outfit:wght@300;400;500;600;700;800&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'Outfit', sans-serif; background: #f8fafc; color: #1e293b; }
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
          0%, 100% { box-shadow: 0 0 0 0 rgba(99,102,241,0.4); }
          50% { box-shadow: 0 0 0 12px rgba(99,102,241,0); }
        }
        @keyframes heroGradient {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 3px; }
        ::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
      `}</style>

      <ParticleField />
      <GlowOrb color="#6366f1" size="400px" top="-100px" left="-100px" delay={0} />
      <GlowOrb color="#06d6a0" size="350px" top="60%" left="80%" delay={2} />
      <GlowOrb color="#f72585" size="300px" top="30%" left="50%" delay={4} />

      <div style={{ position: "relative", zIndex: 1, maxWidth: 960, margin: "0 auto", padding: "24px 20px" }}>
        {/* ── Hero ────────────────────────────────────────────────────── */}
        <header style={{ textAlign: "center", padding: "40px 0 32px" }}>
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 10, marginBottom: 16,
            background: "linear-gradient(135deg, #6366f111, #06d6a011, #f7258511)",
            borderRadius: 40, padding: "6px 20px", fontSize: 13, fontWeight: 600, color: "#6366f1",
            border: "1px solid #6366f122",
          }}>
            <span>⚡</span> AI-Powered Legacy Code Modernization
          </div>
          <h1 style={{
            fontSize: "clamp(32px, 5vw, 56px)", fontWeight: 800, letterSpacing: -1.5,
            lineHeight: 1.1, marginBottom: 12,
            background: "linear-gradient(135deg, #1e293b 0%, #6366f1 40%, #f72585 70%, #06d6a0 100%)",
            backgroundSize: "300% 300%",
            WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
            animation: "heroGradient 6s ease infinite",
          }}>
            Code Modernizer
          </h1>
          <p style={{ color: "#64748b", fontSize: 16, maxWidth: 520, margin: "0 auto", lineHeight: 1.6 }}>
            Transform legacy Java & COBOL codebases into modern Python — function by function, in dependency order, with real-time visualization.
          </p>
        </header>

        {/* ── Input Panel ─────────────────────────────────────────────── */}
        {!stage && (
          <div style={{
            background: "white", borderRadius: 20, padding: 32,
            boxShadow: "0 4px 40px rgba(0,0,0,0.06), 0 1px 3px rgba(0,0,0,0.04)",
            border: "1px solid #f1f5f9",
            animation: "fadeSlideIn 0.5s ease",
          }}>
            {/* Mode Toggle */}
            <div style={{ display: "flex", gap: 0, marginBottom: 24, background: "#f1f5f9", borderRadius: 12, padding: 4 }}>
              {[["upload", "📁 Upload Files"], ["github", "🐙 GitHub URL"]].map(([m, label]) => (
                <button key={m} onClick={() => setMode(m)} style={{
                  flex: 1, padding: "10px 16px", borderRadius: 10, border: "none", cursor: "pointer",
                  background: mode === m ? "white" : "transparent", fontWeight: 600, fontSize: 14,
                  color: mode === m ? "#6366f1" : "#64748b",
                  boxShadow: mode === m ? "0 2px 8px rgba(0,0,0,0.06)" : "none",
                  transition: "all 0.2s ease", fontFamily: "'Outfit', sans-serif",
                }}>
                  {label}
                </button>
              ))}
            </div>

            {/* Mode Content */}
            {mode === "github" ? (
              <div style={{ marginBottom: 24 }}>
                <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#475569", marginBottom: 8 }}>
                  Repository URL
                </label>
                <input
                  type="text" placeholder="https://github.com/user/repo"
                  value={githubUrl} onChange={e => setGithubUrl(e.target.value)}
                  style={{
                    width: "100%", padding: "14px 16px", borderRadius: 12,
                    border: "2px solid #e2e8f0", fontSize: 14, outline: "none",
                    fontFamily: "'JetBrains Mono', monospace",
                    transition: "border-color 0.2s ease",
                  }}
                  onFocus={e => e.target.style.borderColor = "#6366f1"}
                  onBlur={e => e.target.style.borderColor = "#e2e8f0"}
                />
              </div>
            ) : (
              <div style={{ marginBottom: 24 }}>
                <FileUploadZone files={files} onFilesSelected={setFiles} />
              </div>
            )}

            {/* Language Selector */}
            <div style={{ marginBottom: 24 }}>
              <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#475569", marginBottom: 8 }}>
                Source Language
              </label>
              <div style={{ display: "flex", gap: 8 }}>
                {[["auto", "🔍 Auto-detect"], ["java", "☕ Java"], ["cobol", "📟 COBOL"]].map(([v, label]) => (
                  <button key={v} onClick={() => setSourceLang(v)} style={{
                    padding: "10px 20px", borderRadius: 10,
                    border: `2px solid ${sourceLang === v ? "#6366f1" : "#e2e8f0"}`,
                    background: sourceLang === v ? "#6366f108" : "white",
                    color: sourceLang === v ? "#6366f1" : "#64748b",
                    fontWeight: 600, fontSize: 13, cursor: "pointer",
                    transition: "all 0.2s ease", fontFamily: "'Outfit', sans-serif",
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
                  flex: 1, padding: "14px 24px", borderRadius: 12, border: "none",
                  background: canStart ? "linear-gradient(135deg, #6366f1, #8b5cf6)" : "#e2e8f0",
                  color: canStart ? "white" : "#94a3b8",
                  fontWeight: 700, fontSize: 15, cursor: canStart ? "pointer" : "not-allowed",
                  transition: "all 0.2s ease", fontFamily: "'Outfit', sans-serif",
                  boxShadow: canStart ? "0 4px 20px rgba(99,102,241,0.3)" : "none",
                  animation: canStart ? "pulse 2s infinite" : "none",
                }}
              >
                {isStarting ? "⏳ Starting..." : "🚀 Start Modernization"}
              </button>
              <button onClick={runDemo} style={{
                padding: "14px 24px", borderRadius: 12, border: "2px solid #06d6a0",
                background: "transparent", color: "#06d6a0",
                fontWeight: 700, fontSize: 15, cursor: "pointer",
                transition: "all 0.2s ease", fontFamily: "'Outfit', sans-serif",
              }}>
                ▶ Demo
              </button>
            </div>

            {error && (
              <div style={{
                marginTop: 16, padding: "12px 16px", borderRadius: 10,
                background: "#fef2f2", border: "1px solid #fecaca", color: "#dc2626",
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
              background: "white", borderRadius: 20, padding: "16px 24px",
              boxShadow: "0 4px 40px rgba(0,0,0,0.06)",
              border: "1px solid #f1f5f9",
            }}>
              <ProgressStepper currentStage={stage} progress={progress} />
            </div>

            {/* Graph Visualization */}
            <div style={{
              background: "white", borderRadius: 20, padding: 24,
              boxShadow: "0 4px 40px rgba(0,0,0,0.06)",
              border: "1px solid #f1f5f9",
            }}>
              <h3 style={{
                fontSize: 16, fontWeight: 700, marginBottom: 16, display: "flex", alignItems: "center", gap: 8,
                color: "#1e293b",
              }}>
                <span style={{
                  width: 28, height: 28, borderRadius: 8,
                  background: "linear-gradient(135deg, #6366f122, #06d6a022)",
                  display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14,
                }}>🕸️</span>
                Dependency Graph
              </h3>
              <GraphViewer graphData={graphData} />
            </div>

            {/* Translation Log */}
            <div style={{
              background: "white", borderRadius: 20, padding: 24,
              boxShadow: "0 4px 40px rgba(0,0,0,0.06)",
              border: "1px solid #f1f5f9",
            }}>
              <h3 style={{
                fontSize: 16, fontWeight: 700, marginBottom: 16, display: "flex", alignItems: "center", gap: 8,
                color: "#1e293b",
              }}>
                <span style={{
                  width: 28, height: 28, borderRadius: 8,
                  background: "linear-gradient(135deg, #f7258522, #ffd16622)",
                  display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14,
                }}>⚡</span>
                Live Translation Log
              </h3>
              <TranslationLog logs={logs} />
            </div>

            {/* ── Download Panel (when done) ──────────────────────────── */}
            {stage === "done" && metadata && (
              <div style={{
                background: "linear-gradient(135deg, #06d6a008, #6366f108)",
                borderRadius: 20, padding: 32,
                border: "2px solid #06d6a033",
                animation: "fadeSlideIn 0.5s ease",
              }}>
                <div style={{ textAlign: "center", marginBottom: 24 }}>
                  <div style={{ fontSize: 48, marginBottom: 8 }}>🎉</div>
                  <h2 style={{ fontSize: 24, fontWeight: 800, color: "#06d6a0", marginBottom: 4 }}>
                    Modernization Complete!
                  </h2>
                  <p style={{ color: "#64748b" }}>Your translated Python project is ready.</p>
                </div>

                {/* Stats Grid */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12, marginBottom: 24 }}>
                  {[
                    ["Functions", metadata.total_functions, "#6366f1"],
                    ["Translated", metadata.translated_count, "#06d6a0"],
                    ["Compile", metadata.compile_status, metadata.compile_status === "success" ? "#06d6a0" : "#ffd166"],
                    ["Provider", metadata.llm_provider_used, "#8b5cf6"],
                  ].map(([label, value, color]) => (
                    <div key={label} style={{
                      background: "white", borderRadius: 12, padding: "16px 20px",
                      border: "1px solid #f1f5f9", textAlign: "center",
                    }}>
                      <div style={{ fontSize: 24, fontWeight: 800, color }}>{value}</div>
                      <div style={{ fontSize: 11, color: "#94a3b8", fontWeight: 600, marginTop: 2 }}>{label}</div>
                    </div>
                  ))}
                </div>

                {/* Dependencies */}
                {metadata.requirements_generated?.length > 0 && (
                  <div style={{ marginBottom: 20 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "#475569", marginBottom: 8 }}>
                      Generated Dependencies
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                      {metadata.requirements_generated.map(dep => (
                        <span key={dep} style={{
                          background: "#8b5cf611", color: "#8b5cf6", padding: "4px 12px",
                          borderRadius: 20, fontSize: 12, fontFamily: "'JetBrains Mono', monospace",
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
                      padding: "16px 32px", borderRadius: 14, textDecoration: "none",
                      background: "linear-gradient(135deg, #06d6a0, #118ab2)",
                      color: "white", fontWeight: 700, fontSize: 16,
                      boxShadow: "0 4px 20px rgba(6,214,160,0.3)",
                      transition: "transform 0.2s ease",
                    }}>
                      📥 Download translated_repo.zip
                    </a>
                  ) : (
                    <div style={{
                      padding: "16px 32px", borderRadius: 14,
                      background: "linear-gradient(135deg, #06d6a0, #118ab2)",
                      color: "white", fontWeight: 700, fontSize: 16,
                      boxShadow: "0 4px 20px rgba(6,214,160,0.3)",
                    }}>
                      📥 Download translated_repo.zip (demo)
                    </div>
                  )}
                  <button onClick={() => {
                    setStage(null); setJobId(null); setLogs([]); setGraphData(null);
                    setMetadata(null); setProgress(0); setDemoMode(false);
                  }} style={{
                    padding: "16px 24px", borderRadius: 14, border: "2px solid #e2e8f0",
                    background: "white", color: "#64748b", fontWeight: 600, fontSize: 14,
                    cursor: "pointer", fontFamily: "'Outfit', sans-serif",
                  }}>
                    🔄 New Project
                  </button>
                </div>

                {/* Errors */}
                {metadata.errors?.length > 0 && (
                  <div style={{ marginTop: 20, padding: 16, background: "#fef2f2", borderRadius: 12, border: "1px solid #fecaca" }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "#dc2626", marginBottom: 8 }}>
                      ⚠️ {metadata.errors.length} issue(s) reported
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
          textAlign: "center", padding: "40px 0 20px",
          color: "#94a3b8", fontSize: 12,
        }}>
          <div style={{ display: "flex", justifyContent: "center", gap: 24, marginBottom: 12 }}>
            {["Context Optimization", "Dependency-Order Translation", "Groq + Gemini LLMs", "Real-Time Visualization"].map(f => (
              <span key={f} style={{
                background: "#f1f5f9", padding: "4px 12px", borderRadius: 20, fontSize: 11,
                color: "#64748b", fontWeight: 500,
              }}>
                {f}
              </span>
            ))}
          </div>
          Legacy Code Modernizer — Built with FastAPI, React, NetworkX, and AI
        </footer>
      </div>
    </>
  );
}
