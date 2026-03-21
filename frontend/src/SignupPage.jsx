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

export default function SignupPage({ navigate, onLogin, user, onLogout }) {
  const [form, setForm] = useState({ name: "", email: "", password: "", confirm: "" });
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [focused, setFocused] = useState({});

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));
  const fo = (k) => () => setFocused(f => ({ ...f, [k]: true }));
  const bl = (k) => () => setFocused(f => ({ ...f, [k]: false }));

  const validate = () => {
    if (!form.name.trim()) return "Please enter your name.";
    if (!form.email.trim()) return "Please enter your email.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) return "Please enter a valid email.";
    if (form.password.length < 6) return "Password must be at least 6 characters.";
    if (form.password !== form.confirm) return "Passwords do not match.";
    return null;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const err = validate(); if (err) { setError(err); return; }
    setLoading(true); setError("");
    try {
      const fd = new FormData();
      fd.append("name", form.name.trim()); fd.append("email", form.email.trim()); fd.append("password", form.password);
      const res = await fetch(`${API_BASE}/api/auth/register`, { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) { setError(data.detail || "Registration failed."); return; }
      onLogin(data.user, data.token);
    } catch { setError("Network error. Is the backend running?"); }
    finally { setLoading(false); }
  };

  const inp = (k, extra = {}) => ({
    width: "100%", padding: "13px 16px", borderRadius: 12,
    border: `1.5px solid ${focused[k] ? C.primary : C.outlineVariant}`,
    fontSize: 14, outline: "none", fontFamily: "'Inter', sans-serif",
    color: C.onSurface, background: C.surfaceLow,
    transition: "border-color 0.18s", boxSizing: "border-box", ...extra,
  });

  // Password strength
  const strength = (() => {
    const p = form.password; if (!p) return 0;
    let s = 0;
    if (p.length >= 6) s++; if (p.length >= 10) s++;
    if (/[A-Z]/.test(p)) s++; if (/[0-9]/.test(p)) s++;
    if (/[^A-Za-z0-9]/.test(p)) s++;
    return s;
  })();
  const strengthColors = ["", C.error, "#f59e0b", "#eab308", "#22c55e", C.primary];
  const strengthLabels = ["", "Weak", "Fair", "Good", "Strong", "Excellent"];

  const confirmMatch = form.confirm && form.confirm === form.password;
  const confirmMismatch = form.confirm && form.confirm !== form.password;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'Inter', sans-serif; background: #131313; }
        @keyframes fadeUp { from { opacity:0; transform:translateY(18px); } to { opacity:1; transform:translateY(0); } }
        .sp-submit:hover:not(:disabled) { transform: scale(0.97); box-shadow: 0 0 28px rgba(128,131,255,0.4) !important; }
        .sp-ghost:hover { color: #c0c1ff !important; border-color: #c0c1ff !important; }
        .sp-link { background: none; border: none; cursor: pointer; font-family: 'Inter', sans-serif; color: #c0c1ff; font-weight: 600; font-size: 14px; padding: 0; }
        .sp-subtle { background: none; border: none; cursor: pointer; font-family: 'Inter', sans-serif; color: #908fa0; font-size: 13px; padding: 0; transition: color 0.15s; }
        .sp-subtle:hover { color: #c7c4d7; }
      `}</style>

      <Navbar navigate={navigate} user={user} onLogout={onLogout} transparent={false} />

      <div style={{ minHeight: "100vh", paddingTop: 64, background: "linear-gradient(160deg, #0a0a14 0%, #0d0b24 50%, #0a1220 100%)", display: "flex", alignItems: "center", justifyContent: "center", padding: "80px 24px" }}>
        {/* Glow orbs */}
        <div style={{ position: "fixed", top: "15%", right: "8%", width: 400, height: 400, borderRadius: "50%", background: `radial-gradient(circle, ${C.tertiary}0e 0%, transparent 70%)`, filter: "blur(60px)", pointerEvents: "none" }} />
        <div style={{ position: "fixed", bottom: "18%", left: "5%", width: 360, height: 360, borderRadius: "50%", background: `radial-gradient(circle, ${C.primary}12 0%, transparent 70%)`, filter: "blur(60px)", pointerEvents: "none" }} />

        <div style={{ position: "relative", width: "100%", maxWidth: 440, animation: "fadeUp 0.45s ease both" }}>
          {/* Card */}
          <div style={{ background: C.surface, borderRadius: 24, padding: "44px 40px", border: `1px solid ${C.outlineVariant}50`, boxShadow: "0 32px 80px rgba(0,0,0,0.5)" }}>
            {/* Header */}
            <div style={{ textAlign: "center", marginBottom: 36 }}>
              <div style={{ width: 52, height: 52, borderRadius: 16, margin: "0 auto 16px", background: "linear-gradient(135deg, #ffb783, #8083ff)", display: "flex", alignItems: "center", justifyContent: "center" }}><span style={{ fontWeight: 900, fontSize: 18, color: "#131313", letterSpacing: "-0.06em" }}>CM</span></div>
              <h1 style={{ fontSize: 24, fontWeight: 800, color: C.onSurface, letterSpacing: "-0.04em", marginBottom: 6, fontFamily: "'Inter', sans-serif" }}>Create your account</h1>
              <p style={{ fontSize: 13.5, color: C.muted, fontFamily: "'Inter', sans-serif" }}>Start modernizing your legacy code — it&apos;s free</p>
            </div>

            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 18 }}>
              {/* Name */}
              <div>
                <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: C.muted, marginBottom: 7, letterSpacing: "0.08em", textTransform: "uppercase", fontFamily: "'Inter', sans-serif" }}>Full name</label>
                <input type="text" placeholder="Jane Smith" value={form.name} onChange={set("name")} style={inp("name")} onFocus={fo("name")} onBlur={bl("name")} autoComplete="name" />
              </div>

              {/* Email */}
              <div>
                <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: C.muted, marginBottom: 7, letterSpacing: "0.08em", textTransform: "uppercase", fontFamily: "'Inter', sans-serif" }}>Email address</label>
                <input type="email" placeholder="you@company.com" value={form.email} onChange={set("email")} style={inp("email")} onFocus={fo("email")} onBlur={bl("email")} autoComplete="email" />
              </div>

              {/* Password */}
              <div>
                <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: C.muted, marginBottom: 7, letterSpacing: "0.08em", textTransform: "uppercase", fontFamily: "'Inter', sans-serif" }}>Password</label>
                <div style={{ position: "relative" }}>
                  <input type={showPass ? "text" : "password"} placeholder="Min. 6 characters" value={form.password} onChange={set("password")} style={{ ...inp("password"), paddingRight: 46 }} onFocus={fo("password")} onBlur={bl("password")} autoComplete="new-password" />
                  <button type="button" onClick={() => setShowPass(s => !s)} style={{ position: "absolute", right: 13, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", fontSize: 15, color: C.outline, padding: 2 }}>
                    {showPass ? "Hide" : "Show"}
                  </button>
                </div>
                {form.password && (
                  <div style={{ marginTop: 8 }}>
                    <div style={{ display: "flex", gap: 4, marginBottom: 4 }}>
                      {[1, 2, 3, 4, 5].map(i => (
                        <div key={i} style={{ flex: 1, height: 3, borderRadius: 2, background: i <= strength ? strengthColors[strength] : C.outlineVariant, transition: "background 0.3s" }} />
                      ))}
                    </div>
                    <span style={{ fontSize: 11, color: strengthColors[strength], fontWeight: 600, letterSpacing: "0.04em", fontFamily: "'Inter', sans-serif" }}>{strengthLabels[strength]}</span>
                  </div>
                )}
              </div>

              {/* Confirm password */}
              <div>
                <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: C.muted, marginBottom: 7, letterSpacing: "0.08em", textTransform: "uppercase", fontFamily: "'Inter', sans-serif" }}>Confirm password</label>
                <input type={showPass ? "text" : "password"} placeholder="Re-enter password" value={form.confirm} onChange={set("confirm")} autoComplete="new-password"
                  style={{ ...inp("confirm"), borderColor: confirmMismatch ? C.error : confirmMatch ? "#22c55e" : focused["confirm"] ? C.primary : C.outlineVariant }}
                  onFocus={fo("confirm")} onBlur={bl("confirm")} />
                {confirmMismatch && <p style={{ fontSize: 11, color: C.error, marginTop: 5, fontFamily: "'Inter', sans-serif" }}>Passwords don&apos;t match</p>}
                {confirmMatch && <p style={{ fontSize: 11, color: "#22c55e", marginTop: 5, fontFamily: "'Inter', sans-serif" }}>Passwords match</p>}
              </div>

              {/* Error */}
              {error && <div style={{ padding: "11px 14px", borderRadius: 10, background: "#93000a30", border: `1px solid ${C.error}40`, color: C.error, fontSize: 13, fontFamily: "'Inter', sans-serif" }}>{error}</div>}

              {/* Submit */}
              <button type="submit" className="sp-submit" disabled={loading} style={{
                width: "100%", padding: "13px", borderRadius: 9999, border: "none",
                background: loading ? C.surfaceHigh : "linear-gradient(135deg, #8083ff, #c0c1ff)",
                color: loading ? C.outline : "#131313",
                fontWeight: 700, fontSize: 14, cursor: loading ? "not-allowed" : "pointer",
                fontFamily: "'Inter', sans-serif", transition: "all 0.22s",
                boxShadow: loading ? "none" : "0 0 20px rgba(128,131,255,0.3)",
                letterSpacing: "0.01em", marginTop: 4,
              }}>
                {loading ? "Creating account…" : "Create Account →"}
              </button>

              <p style={{ fontSize: 11, color: C.outline, textAlign: "center", lineHeight: 1.5, fontFamily: "'Inter', sans-serif" }}>
                By signing up you agree to our terms of service and privacy policy.
              </p>
            </form>

            {/* Login link */}
            <p style={{ textAlign: "center", marginTop: 24, fontSize: 13.5, color: C.muted, fontFamily: "'Inter', sans-serif" }}>
              Already have an account?{" "}
              <button className="sp-link" onClick={() => navigate("login")}>Sign in</button>
            </p>
          </div>

          {/* Back */}
          <p style={{ textAlign: "center", marginTop: 18 }}>
            <button className="sp-subtle" onClick={() => navigate("landing")}>← Back to home</button>
          </p>
        </div>
      </div>
    </>
  );
}
