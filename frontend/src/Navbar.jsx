import { useState, useEffect } from "react";

const API_BASE = "http://localhost:8000";

// Architect.io design tokens
const C = {
  bg: "#131313",
  surfaceLow: "#1c1b1b",
  surfaceHigh: "#2a2a2a",
  surfaceHighest: "#353534",
  primary: "#c0c1ff",
  primaryContainer: "#8083ff",
  tertiary: "#ffb783",
  onSurface: "#e5e2e1",
  muted: "#c7c4d7",
  outline: "#908fa0",
  outlineVariant: "#464554",
};

export default function Navbar({ navigate, user, onLogout, transparent = false }) {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    const onResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("scroll", onScroll);
    window.addEventListener("resize", onResize);
    return () => { window.removeEventListener("scroll", onScroll); window.removeEventListener("resize", onResize); };
  }, []);

  const isDark = transparent && !scrolled;

  const handleLogout = async () => {
    const token = localStorage.getItem("authToken");
    try { await fetch(`${API_BASE}/api/auth/logout`, { method: "POST", headers: { Authorization: `Bearer ${token}` } }); } catch {}
    onLogout(); setMenuOpen(false);
  };

  const scrollTo = (id) => {
    setMenuOpen(false); navigate("landing");
    setTimeout(() => document.getElementById(id)?.scrollIntoView({ behavior: "smooth" }), 100);
  };

  const navLinks = [
    { label: "Features", action: () => scrollTo("features") },
    { label: "Feedback", action: () => scrollTo("feedback") },
    ...(user ? [{ label: "Dashboard", action: () => { navigate("app"); setMenuOpen(false); } }] : []),
  ];

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
        .nb-link { background: none; border: none; font-family: 'Inter', sans-serif; font-size: 14px; font-weight: 500; letter-spacing: 0.02em; color: #c7c4d7; cursor: pointer; padding: 0; transition: color 0.18s; }
        .nb-link:hover { color: #fff; }
        .nb-cta { background: linear-gradient(135deg, #8083ff, #c0c1ff); color: #131313; border: none; padding: 9px 24px; border-radius: 9999px; font-family: 'Inter', sans-serif; font-weight: 600; font-size: 13px; letter-spacing: 0.02em; cursor: pointer; transition: all 0.2s; transform: scale(1); }
        .nb-cta:hover { transform: scale(0.97); box-shadow: 0 0 20px rgba(192,193,255,0.35); }
        .nb-ghost { background: transparent; color: #c7c4d7; border: 1px solid #464554; padding: 8px 20px; border-radius: 9999px; font-family: 'Inter', sans-serif; font-weight: 500; font-size: 13px; letter-spacing: 0.02em; cursor: pointer; transition: all 0.18s; }
        .nb-ghost:hover { color: #c0c1ff; border-color: #c0c1ff; }
        .hb-line { width: 20px; height: 1.5px; background: #c7c4d7; transition: all 0.28s ease; }
      `}</style>

      <nav style={{
        position: "fixed", top: 0, left: 0, right: 0, zIndex: 1000,
        background: isDark ? "transparent" : "rgba(19,19,19,0.65)",
        backdropFilter: isDark ? "none" : "blur(24px)",
        boxShadow: isDark ? "none" : "0 8px 40px rgba(0,0,0,0.45)",
        borderBottom: isDark ? "none" : `1px solid ${C.outlineVariant}22`,
        transition: "all 0.3s ease",
        fontFamily: "'Inter', sans-serif",
      }}>
        <div style={{ maxWidth: 1280, margin: "0 auto", padding: "0 32px", display: "flex", alignItems: "center", height: 64 }}>
          {/* Logo */}
          <div onClick={() => navigate("landing")} style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: 10, flexShrink: 0, marginRight: 40 }}>
            <div style={{ width: 32, height: 32, borderRadius: 9, background: "linear-gradient(135deg, #c0c1ff, #8083ff)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><span style={{ fontWeight: 900, fontSize: 13, color: "#131313", letterSpacing: "-0.05em" }}>CM</span></div>
            <span style={{ fontWeight: 800, fontSize: 16, color: "#fff", letterSpacing: "-0.04em" }}>CodeModernizer</span>
          </div>

          {/* Desktop links */}
          {!isMobile && (
            <div style={{ display: "flex", alignItems: "center", gap: 32, flex: 1 }}>
              {navLinks.map(l => <button key={l.label} className="nb-link" onClick={l.action}>{l.label}</button>)}
            </div>
          )}

          {isMobile && <div style={{ flex: 1 }} />}

          {/* Desktop auth */}
          {!isMobile && (
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              {user ? (
                <>
                  <span style={{ color: C.muted, fontSize: 13 }}>{user.name.split(" ")[0]}</span>
                  <button className="nb-ghost" onClick={handleLogout}>Logout</button>
                </>
              ) : (
                <>
                  <button className="nb-ghost" onClick={() => navigate("login")}>Login</button>
                  <button className="nb-cta" onClick={() => navigate("signup")}>Sign Up Free</button>
                </>
              )}
            </div>
          )}

          {/* Hamburger */}
          {isMobile && (
            <button onClick={() => setMenuOpen(o => !o)} style={{ background: "none", border: "none", cursor: "pointer", padding: 8, display: "flex", flexDirection: "column", gap: 5, flexShrink: 0 }}>
              <div className="hb-line" style={{ transform: menuOpen ? "rotate(45deg) translateY(6.5px)" : "none" }} />
              <div className="hb-line" style={{ opacity: menuOpen ? 0 : 1 }} />
              <div className="hb-line" style={{ transform: menuOpen ? "rotate(-45deg) translateY(-6.5px)" : "none" }} />
            </button>
          )}
        </div>

        {/* Mobile dropdown */}
        {isMobile && menuOpen && (
          <div style={{ background: "rgba(19,19,19,0.98)", backdropFilter: "blur(24px)", borderTop: `1px solid ${C.outlineVariant}30`, padding: "16px 32px 28px" }}>
            {navLinks.map((l, i) => (
              <div key={l.label} onClick={l.action} style={{ color: C.muted, fontSize: 15, fontWeight: 500, cursor: "pointer", padding: "13px 0", borderBottom: i < navLinks.length - 1 ? `1px solid ${C.outlineVariant}30` : "none" }}>{l.label}</div>
            ))}
            <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
              {user ? (
                <><span style={{ color: C.muted, fontSize: 13, alignSelf: "center" }}>{user.name.split(" ")[0]}</span><button className="nb-ghost" onClick={handleLogout} style={{ flex: 1 }}>Logout</button></>
              ) : (
                <><button className="nb-ghost" onClick={() => { navigate("login"); setMenuOpen(false); }} style={{ flex: 1 }}>Login</button><button className="nb-cta" onClick={() => { navigate("signup"); setMenuOpen(false); }} style={{ flex: 1 }}>Sign Up</button></>
              )}
            </div>
          </div>
        )}
      </nav>
    </>
  );
}
