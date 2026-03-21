import { useState } from "react";
import Navbar from "./Navbar";

const API_BASE = "http://localhost:8000";

// ── Architect.io design tokens ────────────────────────────────────────────────
const C = {
  bg:                   "#131313",
  surfaceLowest:        "#0e0e0e",
  surfaceLow:           "#1c1b1b",
  surface:              "#201f1f",
  surfaceHigh:          "#2a2a2a",
  surfaceHighest:       "#353534",
  primary:              "#c0c1ff",
  primaryContainer:     "#8083ff",
  onPrimary:            "#131313",
  tertiary:             "#ffb783",
  tertiaryContainer:    "#d97721",
  onSurface:            "#e5e2e1",
  muted:                "#c7c4d7",
  outline:              "#908fa0",
  outlineVariant:       "#464554",
  error:                "#ffb4ab",
};

// ── Stat badge ────────────────────────────────────────────────────────────────
const StatBadge = ({ value, label, color }) => (
  <div style={{
    display: "flex", flexDirection: "column", alignItems: "center",
    padding: "18px 24px", borderRadius: 16, minWidth: 140,
    background: "rgba(53,53,52,0.5)", backdropFilter: "blur(12px)",
    border: `1px solid ${C.outlineVariant}55`,
  }}>
    <span style={{ fontSize: 26, fontWeight: 800, color, letterSpacing: "-0.04em", fontFamily: "'Inter', sans-serif" }}>{value}</span>
    <span style={{ fontSize: 11, color: C.muted, marginTop: 4, textAlign: "center", fontWeight: 500, letterSpacing: "0.02em" }}>{label}</span>
  </div>
);

// ── Problem card ──────────────────────────────────────────────────────────────
const ProblemCard = ({ icon, title, desc, accent }) => (
  <div
    style={{
      flex: "1 1 220px", padding: "28px 26px", borderRadius: 20,
      background: C.surface, border: `1px solid ${C.outlineVariant}55`,
      transition: "transform 0.22s ease, box-shadow 0.22s ease, border-color 0.22s ease",
      cursor: "default",
    }}
    onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-5px)"; e.currentTarget.style.boxShadow = `0 12px 40px ${accent}20`; e.currentTarget.style.borderColor = `${accent}55`; }}
    onMouseLeave={e => { e.currentTarget.style.transform = "none"; e.currentTarget.style.boxShadow = "none"; e.currentTarget.style.borderColor = `${C.outlineVariant}55`; }}
  >
    <div style={{ width: 50, height: 50, borderRadius: 14, fontSize: 22, background: `${accent}18`, border: `1px solid ${accent}30`, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 18 }}>{icon}</div>
    <h3 style={{ fontSize: 15, fontWeight: 700, color: C.onSurface, marginBottom: 10, letterSpacing: "-0.02em", fontFamily: "'Inter', sans-serif" }}>{title}</h3>
    <p style={{ fontSize: 13.5, color: C.muted, lineHeight: 1.65, margin: 0, fontFamily: "'Inter', sans-serif" }}>{desc}</p>
  </div>
);

// ── How it works step ─────────────────────────────────────────────────────────
const StepCard = ({ num, icon, title, desc, color }) => (
  <div style={{ flex: "1 1 200px", display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", padding: "28px 20px" }}>
    <div style={{ width: 68, height: 68, borderRadius: "50%", fontSize: 26, background: `${color}18`, border: `1px solid ${color}40`, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 18, position: "relative" }}>
      {icon}
      <span style={{ position: "absolute", top: -8, right: -8, width: 22, height: 22, borderRadius: "50%", background: color, color: "#131313", fontSize: 10, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Inter', sans-serif" }}>{num}</span>
    </div>
    <h3 style={{ fontSize: 15, fontWeight: 700, color: C.onSurface, marginBottom: 8, letterSpacing: "-0.02em", fontFamily: "'Inter', sans-serif" }}>{title}</h3>
    <p style={{ fontSize: 13.5, color: C.muted, lineHeight: 1.6, margin: 0, fontFamily: "'Inter', sans-serif" }}>{desc}</p>
  </div>
);

// ── Star Rating ───────────────────────────────────────────────────────────────
const StarRating = ({ value, onChange }) => (
  <div style={{ display: "flex", gap: 6 }}>
    {[1, 2, 3, 4, 5].map(n => (
      <span key={n} onClick={() => onChange(n)} style={{ fontSize: 26, cursor: "pointer", color: n <= value ? "#fbbf24" : C.outlineVariant, transition: "color 0.15s, transform 0.15s" }}
        onMouseEnter={e => e.target.style.transform = "scale(1.25)"}
        onMouseLeave={e => e.target.style.transform = "scale(1)"}
      >★</span>
    ))}
  </div>
);

// ── Feedback Form ─────────────────────────────────────────────────────────────
const FeedbackForm = () => {
  const [form, setForm] = useState({ name: "", email: "", message: "", rating: 5 });
  const [status, setStatus] = useState(null);
  const [errMsg, setErrMsg] = useState("");
  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    if (!form.name || !form.email || !form.message) { setErrMsg("Please fill in all fields."); return; }
    setStatus("loading"); setErrMsg("");
    try {
      const fd = new FormData();
      Object.entries(form).forEach(([k, v]) => fd.append(k, v));
      const res = await fetch(`${API_BASE}/api/feedback`, { method: "POST", body: fd });
      if (!res.ok) throw new Error();
      setStatus("success"); setForm({ name: "", email: "", message: "", rating: 5 });
    } catch { setStatus("error"); setErrMsg("Failed to send. Please try again."); }
  };

  const inputSt = {
    width: "100%", padding: "13px 16px", borderRadius: 12,
    border: `1.5px solid ${C.outlineVariant}`, fontSize: 14, outline: "none",
    fontFamily: "'Inter', sans-serif", color: C.onSurface,
    background: C.surfaceLow, transition: "border-color 0.18s", boxSizing: "border-box",
  };

  return (
    <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
        <input placeholder="Your name" value={form.name} onChange={set("name")} style={{ ...inputSt, flex: "1 1 180px" }}
          onFocus={e => e.target.style.borderColor = C.primary} onBlur={e => e.target.style.borderColor = C.outlineVariant} />
        <input type="email" placeholder="Your email" value={form.email} onChange={set("email")} style={{ ...inputSt, flex: "1 1 180px" }}
          onFocus={e => e.target.style.borderColor = C.primary} onBlur={e => e.target.style.borderColor = C.outlineVariant} />
      </div>
      <textarea placeholder="Share your thoughts, suggestions, or feature requests..." value={form.message} onChange={set("message")} rows={4}
        style={{ ...inputSt, resize: "vertical", minHeight: 110 }}
        onFocus={e => e.target.style.borderColor = C.primary} onBlur={e => e.target.style.borderColor = C.outlineVariant} />
      <div>
        <p style={{ fontSize: 12, fontWeight: 600, color: C.muted, marginBottom: 8, letterSpacing: "0.08em", textTransform: "uppercase", fontFamily: "'Inter', sans-serif" }}>Rate this tool</p>
        <StarRating value={form.rating} onChange={r => setForm(f => ({ ...f, rating: r }))} />
      </div>
      {errMsg && <div style={{ padding: "11px 14px", borderRadius: 10, background: "#93000a30", border: `1px solid ${C.error}40`, color: C.error, fontSize: 13, fontFamily: "'Inter', sans-serif" }}>{errMsg}</div>}
      {status === "success" ? (
        <div style={{ padding: "18px 20px", borderRadius: 16, background: `${C.primary}12`, border: `1px solid ${C.primary}30`, textAlign: "center" }}>
          <p style={{ fontWeight: 700, color: C.primary, fontFamily: "'Inter', sans-serif" }}>Thank you for your feedback!</p>
        </div>
      ) : (
        <button type="submit" disabled={status === "loading"} style={{
          padding: "13px 24px", borderRadius: 9999, border: "none",
          background: status === "loading" ? C.surfaceHigh : "linear-gradient(135deg, #8083ff, #c0c1ff)",
          color: status === "loading" ? C.outline : "#131313",
          fontWeight: 700, fontSize: 14, cursor: status === "loading" ? "not-allowed" : "pointer",
          fontFamily: "'Inter', sans-serif", transition: "all 0.2s", letterSpacing: "0.01em",
        }}>
          {status === "loading" ? "Sending..." : "Send Feedback"}
        </button>
      )}
    </form>
  );
};

// ── Main Landing Page ─────────────────────────────────────────────────────────
export default function LandingPage({ navigate, user, onLogout }) {
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'Inter', sans-serif; background: #131313; color: #e5e2e1; }
        @keyframes fadeUp { from { opacity:0; transform:translateY(22px); } to { opacity:1; transform:translateY(0); } }
        @keyframes arrowBounce { 0%,100%{transform:translateX(0)} 50%{transform:translateX(5px)} }
        @keyframes pulseDot { 0%,100%{opacity:1} 50%{opacity:0.4} }
        .lp-cta-primary { transition: transform 0.2s; }
        .lp-cta-primary:hover { transform: translateY(-2px); }
        .lp-cta-ghost:hover { background: rgba(70,69,84,0.6) !important; }
        .arrow-anim { animation: arrowBounce 1.2s ease-in-out infinite; display: inline-block; }
        pre { margin: 0; white-space: pre-wrap; word-break: break-word; }
        ::-webkit-scrollbar { width: 5px; } ::-webkit-scrollbar-track { background: transparent; } ::-webkit-scrollbar-thumb { background: #464554; border-radius: 3px; }
      `}</style>

      <Navbar navigate={navigate} user={user} onLogout={onLogout} transparent={true} />

      {/* ── SECTION 1: HERO ──────────────────────────────────────────────── */}
      <section style={{ position: "relative", overflow: "hidden", background: C.bg, paddingTop: 64 }}>
        {/* Background blooms — Architect.io style */}
        <div style={{ position: "absolute", top: -160, right: -80, width: 600, height: 600, borderRadius: "50%", background: "rgba(192,193,255,0.1)", filter: "blur(120px)", pointerEvents: "none", zIndex: 0 }} />
        <div style={{ position: "absolute", top: 320, left: -160, width: 400, height: 400, borderRadius: "50%", background: "rgba(255,183,131,0.05)", filter: "blur(100px)", pointerEvents: "none", zIndex: 0 }} />

        <div style={{ position: "relative", zIndex: 1, maxWidth: 1100, margin: "0 auto", padding: "80px 32px 48px" }}>
          {/* Badge */}
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: C.surfaceHigh, border: "1px solid rgba(70,69,84,0.15)", borderRadius: 9999, padding: "4px 12px", marginBottom: 32, animation: "fadeUp 0.55s ease both" }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: C.primary, display: "inline-block", animation: "pulseDot 2s ease-in-out infinite" }} />
            <span style={{ fontSize: 11, fontWeight: 500, color: C.muted, letterSpacing: "0.12em", textTransform: "uppercase", fontFamily: "'Inter', sans-serif" }}>AI-Powered Legacy Code Modernization</span>
          </div>

          {/* Headline */}
          <h1 style={{ fontSize: "clamp(40px,7vw,80px)", fontWeight: 800, lineHeight: 0.95, letterSpacing: "-0.04em", marginBottom: 24, animation: "fadeUp 0.65s ease 0.08s both", fontFamily: "'Inter', sans-serif", color: "#fff", maxWidth: 820 }}>
            Legacy Code is<br />a Liability.<br />
            <span style={{ color: C.primary }}>We Fix That.</span>
          </h1>

          <p style={{ fontSize: "clamp(16px,2vw,20px)", color: C.muted, maxWidth: 600, lineHeight: 1.75, marginBottom: 48, animation: "fadeUp 0.65s ease 0.16s both", fontFamily: "'Inter', sans-serif" }}>
            Transform your COBOL &amp; Java codebases into modern Python — function by function,
            in dependency order, with AI translation and real-time call-graph visualization.
          </p>

          {/* CTAs */}
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "center", animation: "fadeUp 0.65s ease 0.24s both" }}>
            <button className="lp-cta-primary" onClick={() => navigate(user ? "app" : "signup")} style={{
              padding: "16px 40px", borderRadius: 9999, border: "none",
              background: "linear-gradient(135deg, #8083ff, #c0c1ff)",
              color: "#131313", fontWeight: 700, fontSize: 16, cursor: "pointer",
              fontFamily: "'Inter', sans-serif", letterSpacing: "0.01em",
              boxShadow: "0 0 40px rgba(128,131,255,0.2)",
            }}>
              Get Started Free
            </button>
            <button className="lp-cta-ghost" onClick={() => navigate("app")} style={{
              padding: "16px 40px", borderRadius: 9999,
              border: "1px solid rgba(70,69,84,0.15)",
              background: "rgba(53,53,52,0.6)", backdropFilter: "blur(20px)",
              color: "#fff", fontWeight: 700, fontSize: 16, cursor: "pointer",
              fontFamily: "'Inter', sans-serif", transition: "background 0.2s",
            }}>
              View Demo
            </button>
          </div>

          {/* Stats */}
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 56, animation: "fadeUp 0.65s ease 0.32s both" }}>
            <StatBadge value="220B+" label="Lines of COBOL in production" color={C.error} />
            <StatBadge value="43%" label="Banking systems run on COBOL" color="#fbbf24" />
            <StatBadge value="95%" label="COBOL devs retiring by 2030" color={C.tertiary} />
            <StatBadge value="$300B" label="Annual legacy maintenance cost" color={C.primary} />
          </div>
        </div>

        {/* Code preview — Architect.io IDE workspace style */}
        <div style={{ position: "relative", zIndex: 1, maxWidth: 1100, margin: "0 auto", padding: "0 32px 96px", animation: "fadeUp 0.7s ease 0.4s both" }}>
          {/* Outer: surface-container-high rounded-xl p-1 shadow-2xl */}
          <div style={{ background: C.surfaceHigh, borderRadius: 16, padding: 4, boxShadow: "0 24px 80px rgba(0,0,0,0.7)", maxWidth: 860 }}>
            {/* Inner: surface-container-lowest rounded-lg border border-outline-variant/10 */}
            <div style={{ background: C.surfaceLowest, borderRadius: 12, overflow: "hidden", border: "1px solid rgba(70,69,84,0.1)" }}>
              {/* IDE Header */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", background: C.surface, borderBottom: "1px solid rgba(70,69,84,0.1)" }}>
                <div style={{ display: "flex", gap: 6 }}>
                  <div style={{ width: 12, height: 12, borderRadius: "50%", background: "rgba(255,180,171,0.4)" }} />
                  <div style={{ width: 12, height: 12, borderRadius: "50%", background: "rgba(255,183,131,0.4)" }} />
                  <div style={{ width: 12, height: 12, borderRadius: "50%", background: "rgba(192,193,255,0.4)" }} />
                </div>
                <span style={{ fontSize: 10, color: C.outline, fontFamily: "'JetBrains Mono', monospace", textTransform: "uppercase", letterSpacing: "0.1em" }}>legacy_code_modernizer.ark</span>
                <div style={{ width: 40 }} />
              </div>
              {/* Code panels grid */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr" }}>
                {/* COBOL panel */}
                <div style={{ padding: "24px", fontFamily: "'JetBrains Mono', monospace", fontSize: 11, lineHeight: 1.75, borderRight: "1px solid rgba(70,69,84,0.1)", boxShadow: "inset 0 2px 10px rgba(0,0,0,0.5)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16, opacity: 0.5 }}>
                    <span style={{ fontSize: 10, color: C.muted, letterSpacing: "0.06em" }}>LEGACY_COBOL.COB</span>
                  </div>
                  <pre style={{ color: C.muted }}>
                    <span style={{ color: C.error }}>IDENTIFICATION DIVISION.{"\n"}PROGRAM-ID. CALC-TAX.{"\n"}</span>
                    <span style={{ color: C.outline }}>WORKING-STORAGE SECTION.{"\n"}  01 WS-INCOME PIC 9(7)V99.{"\n"}  01 WS-TAX    PIC 9(7)V99.{"\n"}</span>
                    <span style={{ color: C.muted }}>PROCEDURE DIVISION.{"\n"}  COMPUTE WS-TAX = WS-INCOME * 0.25{"\n"}  IF WS-TAX {">"} 10000{"\n"}    MOVE 10000 TO WS-TAX{"\n"}  END-IF{"\n"}  STOP RUN.</span>
                  </pre>
                </div>
                {/* Python panel */}
                <div style={{ padding: "24px", fontFamily: "'JetBrains Mono', monospace", fontSize: 11, lineHeight: 1.75, background: "rgba(28,27,27,0.5)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16, color: C.primary }}>
                    <span style={{ fontSize: 10, letterSpacing: "0.06em" }}>MODERN_PYTHON.PY</span>
                  </div>
                  <pre>
                    <span style={{ color: C.primary }}>def </span><span style={{ color: C.tertiary }}>calculate_tax</span><span style={{ color: C.onSurface }}>(income: </span><span style={{ color: "#fbbf24" }}>float</span><span style={{ color: C.onSurface }}>) -&gt; </span><span style={{ color: "#fbbf24" }}>float</span><span style={{ color: C.onSurface }}>:{"\n"}</span>
                    <span style={{ color: C.outline }}>    """Translated from COBOL CALC-TAX."""{"\n"}</span>
                    <span style={{ color: C.onSurface }}>    tax = income * </span><span style={{ color: "#fbbf24" }}>0.25{"\n"}</span>
                    <span style={{ color: C.primary }}>    return </span><span style={{ color: C.tertiary }}>min</span><span style={{ color: C.onSurface }}>(tax, </span><span style={{ color: "#fbbf24" }}>10000.0</span><span style={{ color: C.onSurface }}>)</span>
                  </pre>
                </div>
              </div>
            </div>
          </div>
          <p style={{ fontSize: 11, color: C.outline, marginTop: 12, fontFamily: "'JetBrains Mono', monospace" }}>↑ Real output — same logic, modern idiomatic Python</p>
        </div>
      </section>

      {/* ── SECTION 2: PROBLEM CARDS (horizontal) ────────────────────────── */}
      <section id="features" style={{ background: C.bg, padding: "96px 32px", borderTop: `1px solid ${C.outlineVariant}30` }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 56 }}>
            <span style={{ display: "inline-block", fontSize: 10, fontWeight: 700, color: C.primary, letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 14, fontFamily: "'Inter', sans-serif" }}>The Problem</span>
            <h2 style={{ fontSize: "clamp(26px,4vw,42px)", fontWeight: 800, color: C.onSurface, letterSpacing: "-0.04em", lineHeight: 1.15, marginBottom: 16, fontFamily: "'Inter', sans-serif" }}>
              Why Legacy Code is<br />Holding You Back
            </h2>
            <p style={{ fontSize: 15, color: C.muted, maxWidth: 500, margin: "0 auto", lineHeight: 1.7, fontFamily: "'Inter', sans-serif" }}>
              Organizations running COBOL and legacy Java face compounding risks that grow more expensive every year they wait.
            </p>
          </div>

          <div style={{ display: "flex", gap: 18, flexWrap: "wrap" }}>
            <ProblemCard icon="T" title="Dying Talent Pool" accent={C.error} desc="The average COBOL developer is 55+. Over 1 million will retire by 2025, taking decades of institutional knowledge with them." />
            <ProblemCard icon="$" title="Spiraling Costs" accent="#fbbf24" desc="Legacy maintenance costs 3–4× more than modern systems. Mainframe licenses and specialized consultants drain budgets endlessly." />
            <ProblemCard icon="S" title="Security Debt" accent={C.tertiary} desc="Unsupported languages mean unpatched CVEs. Legacy systems are prime ransomware targets that are expensive to harden." />
            <ProblemCard icon="!" title="Innovation Blocked" accent={C.primary} desc="You can't attach AI, cloud microservices, or DevOps pipelines to 1960s architecture. It blocks every modernization initiative." />
          </div>

          {/* Timeline bar */}
          <div style={{ marginTop: 56, background: C.surface, borderRadius: 20, padding: "36px 32px", border: `1px solid ${C.outlineVariant}40` }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: C.onSurface, marginBottom: 28, textTransform: "uppercase", letterSpacing: "0.08em", fontFamily: "'Inter', sans-serif" }}>Language Support Status</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {[
                { lang: "COBOL", year: 1959, status: "Zombie", color: C.error, pct: 100 },
                { lang: "Java EE", year: 1999, status: "Legacy", color: "#fbbf24", pct: 68 },
                { lang: "Python 3", year: 2008, status: "Modern", color: C.primary, pct: 36 },
              ].map(item => (
                <div key={item.lang} style={{ display: "flex", alignItems: "center", gap: 16 }}>
                  <div style={{ width: 88, flexShrink: 0 }}>
                    <span style={{ fontWeight: 700, fontSize: 13, color: C.onSurface, fontFamily: "'Inter', sans-serif" }}>{item.lang}</span>
                    <div style={{ fontSize: 10, color: C.outline, marginTop: 1, fontFamily: "'Inter', sans-serif" }}>{item.year}</div>
                  </div>
                  <div style={{ flex: 1, background: C.surfaceLow, borderRadius: 6, height: 8, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${item.pct}%`, borderRadius: 6, background: item.color }} />
                  </div>
                  <span style={{ fontSize: 10, fontWeight: 700, padding: "3px 10px", borderRadius: 9999, background: `${item.color}18`, color: item.color, fontFamily: "'Inter', sans-serif", letterSpacing: "0.04em", flexShrink: 0 }}>{item.status}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── SECTION 3: HOW IT WORKS ──────────────────────────────────────── */}
      <section style={{ background: C.surfaceLow, padding: "96px 32px", borderTop: `1px solid ${C.outlineVariant}30` }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 56 }}>
            <span style={{ display: "inline-block", fontSize: 10, fontWeight: 700, color: C.tertiary, letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 14, fontFamily: "'Inter', sans-serif" }}>How It Works</span>
            <h2 style={{ fontSize: "clamp(26px,4vw,42px)", fontWeight: 800, color: C.onSurface, letterSpacing: "-0.04em", fontFamily: "'Inter', sans-serif" }}>Modernization in 4 Steps</h2>
          </div>
          <div style={{ display: "flex", gap: 0, flexWrap: "wrap" }}>
            <StepCard num={1} icon="↑" title="Upload Code" color={C.primary} desc="Drop your Java or COBOL files, paste a GitHub URL, or upload a ZIP archive." />
            <StepCard num={2} icon="#" title="Parse & Graph" color="#f72585" desc="We build a dependency call-graph of all functions to determine the correct translation order." />
            <StepCard num={3} icon="AI" title="AI Translation" color={C.tertiary} desc="Each function is translated leaf-first with full context of already-translated dependencies." />
            <StepCard num={4} icon="✓" title="Validate & Download" color={C.primary} desc="Compiled, syntax-checked Python output. Download a ready ZIP with requirements.txt." />
          </div>
        </div>
      </section>

      {/* ── SECTION 4: LOGIN / SIGNUP CTA ────────────────────────────────── */}
      <section style={{ background: "linear-gradient(160deg, #0a0a14 0%, #0d0b24 50%, #0a1220 100%)", padding: "96px 32px", borderTop: `1px solid ${C.outlineVariant}30` }}>
        <div style={{ maxWidth: 860, margin: "0 auto", textAlign: "center" }}>
          <h2 style={{ fontSize: "clamp(26px,4vw,46px)", fontWeight: 900, letterSpacing: "-0.04em", marginBottom: 16, background: "linear-gradient(135deg, #fff 30%, #c0c1ff 70%, #ffb783 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", fontFamily: "'Inter', sans-serif" }}>
            Ready to Modernize?
          </h2>
          <p style={{ fontSize: 15, color: C.muted, maxWidth: 460, margin: "0 auto 48px", lineHeight: 1.7, fontFamily: "'Inter', sans-serif" }}>
            Join teams already escaping their legacy stack. Free to get started — no credit card required.
          </p>

          <div style={{ display: "flex", gap: 20, justifyContent: "center", flexWrap: "wrap" }}>
            {/* Login card */}
            <div style={{ background: `${C.outlineVariant}20`, border: `1px solid ${C.outlineVariant}50`, borderRadius: 20, padding: "32px 36px", flex: "1 1 240px", maxWidth: 320, backdropFilter: "blur(12px)" }}>
              <div style={{ fontSize: 32, marginBottom: 14 }}></div>
              <h3 style={{ fontSize: 18, fontWeight: 700, color: C.onSurface, marginBottom: 10, letterSpacing: "-0.03em", fontFamily: "'Inter', sans-serif" }}>Have an account?</h3>
              <p style={{ fontSize: 13.5, color: C.muted, marginBottom: 22, lineHeight: 1.65, fontFamily: "'Inter', sans-serif" }}>Sign back in and pick up where you left off.</p>
              <button onClick={() => navigate("login")} style={{
                width: "100%", padding: "12px", borderRadius: 9999, border: `1.5px solid ${C.primary}60`,
                background: "transparent", color: C.primary, fontWeight: 600, fontSize: 13,
                cursor: "pointer", fontFamily: "'Inter', sans-serif", transition: "all 0.2s",
              }}
                onMouseEnter={e => e.target.style.background = `${C.primary}14`}
                onMouseLeave={e => e.target.style.background = "transparent"}
              >Login →</button>
            </div>

            {/* Sign up card */}
            <div style={{ background: `${C.primary}12`, border: `1px solid ${C.primary}30`, borderRadius: 20, padding: "32px 36px", flex: "1 1 240px", maxWidth: 320, backdropFilter: "blur(12px)", boxShadow: `0 0 50px ${C.primary}18` }}>
              <div style={{ fontSize: 32, marginBottom: 14 }}></div>
              <h3 style={{ fontSize: 18, fontWeight: 700, color: C.onSurface, marginBottom: 10, letterSpacing: "-0.03em", fontFamily: "'Inter', sans-serif" }}>New here? Start free.</h3>
              <p style={{ fontSize: 13.5, color: C.muted, marginBottom: 22, lineHeight: 1.65, fontFamily: "'Inter', sans-serif" }}>Create your account and modernize your first project today.</p>
              <button onClick={() => navigate("signup")} style={{
                width: "100%", padding: "12px", borderRadius: 9999, border: "none",
                background: "linear-gradient(135deg, #8083ff, #c0c1ff)",
                color: "#131313", fontWeight: 700, fontSize: 13, cursor: "pointer",
                fontFamily: "'Inter', sans-serif", transition: "all 0.2s",
                boxShadow: "0 4px 18px rgba(128,131,255,0.3)",
              }}
                onMouseEnter={e => e.target.style.transform = "translateY(-2px)"}
                onMouseLeave={e => e.target.style.transform = "none"}
              >Create Free Account →</button>
            </div>
          </div>
        </div>
      </section>

      {/* ── SECTION 5: FEEDBACK ──────────────────────────────────────────── */}
      <section id="feedback" style={{ background: C.bg, padding: "96px 32px", borderTop: `1px solid ${C.outlineVariant}30` }}>
        <div style={{ maxWidth: 720, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 48 }}>
            <span style={{ display: "inline-block", fontSize: 10, fontWeight: 700, color: C.tertiary, letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 14, fontFamily: "'Inter', sans-serif" }}>Suggestions</span>
            <h2 style={{ fontSize: "clamp(24px,4vw,38px)", fontWeight: 800, color: C.onSurface, letterSpacing: "-0.04em", lineHeight: 1.2, marginBottom: 14, fontFamily: "'Inter', sans-serif" }}>Feedback &amp; Suggestions</h2>
            <p style={{ fontSize: 14, color: C.muted, maxWidth: 440, margin: "0 auto", lineHeight: 1.7, fontFamily: "'Inter', sans-serif" }}>We read every message. Tell us what works, what's broken, or what would make CodeModernizer even better.</p>
          </div>
          <div style={{ background: C.surface, borderRadius: 24, padding: "36px", border: `1px solid ${C.outlineVariant}40` }}>
            <FeedbackForm />
          </div>
        </div>
      </section>

      {/* ── FOOTER ───────────────────────────────────────────────────────── */}
      <footer style={{ background: C.surfaceLowest, borderTop: `1px solid ${C.outlineVariant}20`, padding: "40px 32px" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 24 }}>
          <div style={{ gridColumn: "1 / span 2" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 10 }}>
              <div style={{ width: 26, height: 26, borderRadius: 7, background: "linear-gradient(135deg, #c0c1ff, #8083ff)", display: "flex", alignItems: "center", justifyContent: "center" }}><span style={{ fontWeight: 900, fontSize: 10, color: "#131313", letterSpacing: "-0.05em" }}>CM</span></div>
              <span style={{ fontWeight: 800, fontSize: 14, color: "#fff", letterSpacing: "-0.04em", fontFamily: "'Inter', sans-serif" }}>CodeModernizer</span>
            </div>
            <p style={{ fontSize: 12, color: C.outline, fontFamily: "'Inter', sans-serif" }}>© 2024 — AI-Powered Legacy Code Modernization</p>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {["Privacy Policy", "Terms of Service"].map(l => <a key={l} href="#" style={{ fontSize: 12, color: C.muted, textDecoration: "none", fontFamily: "'Inter', sans-serif", transition: "color 0.2s" }} onMouseEnter={e => e.target.style.color = "#fff"} onMouseLeave={e => e.target.style.color = C.muted}>{l}</a>)}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {["GitHub", "Status", "Docs"].map(l => <a key={l} href="#" style={{ fontSize: 12, color: C.muted, textDecoration: "none", fontFamily: "'Inter', sans-serif", transition: "color 0.2s" }} onMouseEnter={e => e.target.style.color = "#fff"} onMouseLeave={e => e.target.style.color = C.muted}>{l}</a>)}
          </div>
        </div>
      </footer>
    </>
  );
}
