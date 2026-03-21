import { useState } from "react";
import Navbar from "./Navbar";

const API_BASE = "http://localhost:8000";

const C = {
  bg: "#131313", surfaceLowest: "#0e0e0e", surfaceLow: "#1c1b1b",
  surface: "#201f1f", surfaceHigh: "#2a2a2a",
  primary: "#c0c1ff", primaryContainer: "#8083ff",
  tertiary: "#ffb783", onSurface: "#e5e2e1",
  muted: "#c7c4d7", outline: "#908fa0", outlineVariant: "#464554", error: "#ffb4ab",
};

export default function LoginPage({ navigate, onLogin, user, onLogout }) {
  const [form, setForm] = useState({ email: "", password: "" });
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [focused, setFocused] = useState({});

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));
  const fo = (k) => () => setFocused(f => ({ ...f, [k]: true }));
  const bl = (k) => () => setFocused(f => ({ ...f, [k]: false }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.email || !form.password) { setError("Please fill in all fields."); return; }
    setLoading(true); setError("");
    try {
      const fd = new FormData();
      fd.append("email", form.email.trim()); fd.append("password", form.password);
      const res = await fetch(`${API_BASE}/api/auth/login`, { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) { setError(data.detail || "Login failed."); return; }
      onLogin(data.user, data.token);
    } catch { setError("Network error. Is the backend running?"); }
    finally { setLoading(false); }
  };

  const inp = (k) => ({
    width: "100%", padding: "13px 16px", borderRadius: 12,
    border: `1.5px solid ${focused[k] ? C.primary : C.outlineVariant}`,
    fontSize: 14, outline: "none", fontFamily: "'Inter', sans-serif",
    color: C.onSurface, background: C.surfaceLow,
    transition: "border-color 0.18s", boxSizing: "border-box",
  });

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'Inter', sans-serif; background: #131313; }
        @keyframes fadeUp { from { opacity:0; transform:translateY(18px); } to { opacity:1; transform:translateY(0); } }
        .lp-submit:hover:not(:disabled) { transform: scale(0.97); box-shadow: 0 0 28px rgba(128,131,255,0.4) !important; }
        .lp-ghost-btn:hover { color: #c0c1ff !important; border-color: #c0c1ff !important; }
        .lp-link { background: none; border: none; cursor: pointer; font-family: 'Inter', sans-serif; color: #c0c1ff; font-weight: 600; font-size: 14px; padding: 0; transition: opacity 0.15s; }
        .lp-link:hover { opacity: 0.8; }
        .lp-subtle { background: none; border: none; cursor: pointer; font-family: 'Inter', sans-serif; color: #908fa0; font-size: 13px; padding: 0; transition: color 0.15s; }
        .lp-subtle:hover { color: #c7c4d7; }
      `}</style>

      <Navbar navigate={navigate} user={user} onLogout={onLogout} transparent={false} />

      <div style={{ minHeight: "100vh", paddingTop: 64, background: "linear-gradient(160deg, #0a0a14 0%, #0d0b24 50%, #0a1220 100%)", display: "flex", alignItems: "center", justifyContent: "center", padding: "80px 24px" }}>
        {/* Glow orbs */}
        <div style={{ position: "fixed", top: "20%", left: "8%", width: 420, height: 420, borderRadius: "50%", background: `radial-gradient(circle, ${C.primary}14 0%, transparent 70%)`, filter: "blur(60px)", pointerEvents: "none" }} />
        <div style={{ position: "fixed", bottom: "15%", right: "8%", width: 360, height: 360, borderRadius: "50%", background: `radial-gradient(circle, ${C.tertiary}0e 0%, transparent 70%)`, filter: "blur(60px)", pointerEvents: "none" }} />

        <div style={{ position: "relative", width: "100%", maxWidth: 420, animation: "fadeUp 0.45s ease both" }}>
          {/* Card */}
          <div style={{ background: C.surface, borderRadius: 24, padding: "44px 40px", border: `1px solid ${C.outlineVariant}50`, boxShadow: "0 32px 80px rgba(0,0,0,0.5)" }}>
            {/* Header */}
            <div style={{ textAlign: "center", marginBottom: 36 }}>
              <div style={{ width: 52, height: 52, borderRadius: 16, margin: "0 auto 16px", background: "linear-gradient(135deg, #8083ff, #c0c1ff)", display: "flex", alignItems: "center", justifyContent: "center" }}><span style={{ fontWeight: 900, fontSize: 18, color: "#131313", letterSpacing: "-0.06em" }}>CM</span></div>
              <h1 style={{ fontSize: 24, fontWeight: 800, color: C.onSurface, letterSpacing: "-0.04em", marginBottom: 6, fontFamily: "'Inter', sans-serif" }}>Welcome back</h1>
              <p style={{ fontSize: 13.5, color: C.muted, fontFamily: "'Inter', sans-serif" }}>Sign in to your CodeModernizer account</p>
            </div>

            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 18 }}>
              {/* Email */}
              <div>
                <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: C.muted, marginBottom: 7, letterSpacing: "0.08em", textTransform: "uppercase", fontFamily: "'Inter', sans-serif" }}>Email address</label>
                <input type="email" placeholder="you@company.com" value={form.email} onChange={set("email")} style={inp("email")} onFocus={fo("email")} onBlur={bl("email")} autoComplete="email" />
              </div>

              {/* Password */}
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 7, alignItems: "center" }}>
                  <label style={{ fontSize: 11, fontWeight: 700, color: C.muted, letterSpacing: "0.08em", textTransform: "uppercase", fontFamily: "'Inter', sans-serif" }}>Password</label>
                  <button type="button" className="lp-link" style={{ fontSize: 12 }}>Forgot password?</button>
                </div>
                <div style={{ position: "relative" }}>
                  <input type={showPass ? "text" : "password"} placeholder="••••••••" value={form.password} onChange={set("password")} style={{ ...inp("password"), paddingRight: 46 }} onFocus={fo("password")} onBlur={bl("password")} autoComplete="current-password" />
                  <button type="button" onClick={() => setShowPass(s => !s)} style={{ position: "absolute", right: 13, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", fontSize: 15, color: C.outline, padding: 2 }}>
                    {showPass ? "Hide" : "Show"}
                  </button>
                </div>
              </div>

              {/* Error */}
              {error && <div style={{ padding: "11px 14px", borderRadius: 10, background: "#93000a30", border: `1px solid ${C.error}40`, color: C.error, fontSize: 13, fontFamily: "'Inter', sans-serif" }}>{error}</div>}

              {/* Submit */}
              <button type="submit" className="lp-submit" disabled={loading} style={{
                width: "100%", padding: "13px", borderRadius: 9999, border: "none",
                background: loading ? C.surfaceHigh : "linear-gradient(135deg, #8083ff, #c0c1ff)",
                color: loading ? C.outline : "#131313",
                fontWeight: 700, fontSize: 14, cursor: loading ? "not-allowed" : "pointer",
                fontFamily: "'Inter', sans-serif", transition: "all 0.22s",
                boxShadow: loading ? "none" : "0 0 20px rgba(128,131,255,0.3)",
                letterSpacing: "0.01em", marginTop: 4,
              }}>
                {loading ? "Signing in…" : "Sign In"}
              </button>
            </form>

            {/* Divider */}
            <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "22px 0" }}>
              <div style={{ flex: 1, height: 1, background: C.outlineVariant + "50" }} />
              <span style={{ fontSize: 11, color: C.outline, fontWeight: 500, letterSpacing: "0.06em", fontFamily: "'Inter', sans-serif" }}>OR</span>
              <div style={{ flex: 1, height: 1, background: C.outlineVariant + "50" }} />
            </div>

            {/* Guest */}
            <button onClick={() => navigate("app")} className="lp-ghost-btn" style={{
              width: "100%", padding: "12px", borderRadius: 9999,
              border: `1.5px solid ${C.outlineVariant}`, background: "transparent",
              color: C.muted, fontWeight: 600, fontSize: 13, cursor: "pointer",
              fontFamily: "'Inter', sans-serif", transition: "all 0.18s", letterSpacing: "0.01em",
            }}>
              Continue as Guest (Demo)
            </button>

            {/* Sign up link */}
            <p style={{ textAlign: "center", marginTop: 24, fontSize: 13.5, color: C.muted, fontFamily: "'Inter', sans-serif" }}>
              Don&apos;t have an account?{" "}
              <button className="lp-link" onClick={() => navigate("signup")}>Sign up free</button>
            </p>
          </div>

          {/* Back */}
          <p style={{ textAlign: "center", marginTop: 18 }}>
            <button className="lp-subtle" onClick={() => navigate("landing")}>← Back to home</button>
          </p>
        </div>
      </div>
    </>
  );
}
