import { useState, useEffect } from "react";
import LandingPage from "./LandingPage";
import LoginPage from "./LoginPage";
import SignupPage from "./SignupPage";
import App from "./App";

const API_BASE = "http://localhost:8000";

export default function Router() {
  const [page, setPage] = useState("landing");
  const [user, setUser] = useState(null);

  useEffect(() => {
    const token = localStorage.getItem("authToken");
    if (!token) return;
    fetch(`${API_BASE}/api/auth/me`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : null)
      .then(u => { if (u) setUser(u); })
      .catch(() => {});
  }, []);

  const navigate = (p) => setPage(p);

  const handleLogin = (userData, token) => {
    localStorage.setItem("authToken", token);
    setUser(userData);
    setPage("app");
  };

  const handleLogout = async () => {
    const token = localStorage.getItem("authToken");
    try { await fetch(`${API_BASE}/api/auth/logout`, { method: "POST", headers: { Authorization: `Bearer ${token}` } }); } catch {}
    localStorage.removeItem("authToken");
    setUser(null);
    setPage("landing");
  };

  const shared = { navigate, user, onLogout: handleLogout };

  if (page === "login")  return <LoginPage  {...shared} onLogin={handleLogin} />;
  if (page === "signup") return <SignupPage {...shared} onLogin={handleLogin} />;
  if (page === "app")    return <AppWrapper  {...shared} />;
  return <LandingPage {...shared} />;
}

// ── App wrapper with Architect.io top bar ─────────────────────────────────────
function AppWrapper({ navigate, user, onLogout }) {
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
        .aw-nav-link { background: none; border: none; cursor: pointer; font-family: 'Inter', sans-serif; font-size: 13px; font-weight: 500; letter-spacing: 0.02em; color: #c7c4d7; padding: 0; transition: color 0.18s; }
        .aw-nav-link:hover { color: #fff; }
        .aw-ghost { background: transparent; color: #c7c4d7; border: 1px solid #464554; padding: 6px 16px; border-radius: 9999px; font-family: 'Inter', sans-serif; font-weight: 500; font-size: 12px; cursor: pointer; transition: all 0.18s; letter-spacing: 0.02em; }
        .aw-ghost:hover { color: #c0c1ff; border-color: #c0c1ff; }
        .aw-cta { background: linear-gradient(135deg, #8083ff, #c0c1ff); color: #131313; border: none; padding: 6px 16px; border-radius: 9999px; font-family: 'Inter', sans-serif; font-weight: 600; font-size: 12px; cursor: pointer; letter-spacing: 0.02em; transition: all 0.2s; }
        .aw-cta:hover { transform: scale(0.97); }
      `}</style>

      {/* Slim top bar matching Architect.io header style */}
      <header style={{
        position: "fixed", top: 0, left: 0, right: 0, zIndex: 1000,
        background: "rgba(19,19,19,0.65)", backdropFilter: "blur(24px)",
        boxShadow: "0 4px 32px rgba(0,0,0,0.4)",
        borderBottom: "1px solid rgba(70,69,84,0.18)",
        fontFamily: "'Inter', sans-serif",
      }}>
        <div style={{ maxWidth: 1600, margin: "0 auto", padding: "0 32px", display: "flex", alignItems: "center", height: 56, gap: 24 }}>
          {/* Logo */}
          <button onClick={() => navigate("landing")} style={{ display: "flex", alignItems: "center", gap: 9, background: "none", border: "none", cursor: "pointer", padding: 0, flexShrink: 0 }}>
            <div style={{ width: 28, height: 28, borderRadius: 8, background: "linear-gradient(135deg, #c0c1ff, #8083ff)", display: "flex", alignItems: "center", justifyContent: "center" }}><span style={{ fontWeight: 900, fontSize: 11, color: "#131313", letterSpacing: "-0.05em" }}>CM</span></div>
            <span style={{ fontWeight: 800, fontSize: 15, color: "#fff", letterSpacing: "-0.04em" }}>CodeModernizer</span>
          </button>

          {/* Nav links */}
          <nav style={{ display: "flex", alignItems: "center", gap: 28 }}>
            <button className="aw-nav-link" onClick={() => navigate("landing")}>Home</button>
            <button className="aw-nav-link" onClick={() => navigate("landing")}>Features</button>
          </nav>

          <div style={{ flex: 1 }} />

          {/* Auth */}
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {user ? (
              <>
                <span style={{ fontSize: 12, color: "#c7c4d7", fontWeight: 500 }}>{user.name}</span>
                <button className="aw-ghost" onClick={onLogout}>Logout</button>
              </>
            ) : (
              <>
                <button className="aw-ghost" onClick={() => navigate("login")}>Login</button>
                <button className="aw-cta" onClick={() => navigate("signup")}>Sign Up</button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Existing App pushed down by the top bar */}
      <div style={{ paddingTop: 56 }}>
        <App />
      </div>
    </>
  );
}
