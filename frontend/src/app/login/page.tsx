"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";

export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(""); 
    setLoading(true);
    const err = await login(email, password);
    setLoading(false);
    if (err) setError(err);
    else router.push("/dashboard");
  };

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-primary)", backgroundSize: "400% 400%", animation: "gradientShift 15s ease infinite", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, position: "relative", overflow: "hidden" }}>
      {/* Animated background elements */}
      <div style={{ position: "absolute", top: "-50%", right: "-50%", width: "100%", height: "100%", background: "radial-gradient(circle, rgba(240, 165, 0, 0.1) 0%, transparent 70%)", animation: "spin-slow 20s linear infinite", pointerEvents: "none" }} />
      <div style={{ position: "absolute", bottom: "-50%", left: "-50%", width: "100%", height: "100%", background: "radial-gradient(circle, rgba(61, 142, 248, 0.1) 0%, transparent 70%)", animation: "spin-slow 25s linear infinite reverse", pointerEvents: "none" }} />

      <div style={{ width: "100%", maxWidth: 420, position: "relative", zIndex: 1 }} className="animate-slide-up">
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <Link href="/" style={{ display: "inline-flex", alignItems: "center", gap: 8, textDecoration: "none", marginBottom: 32, transition: "transform 0.3s ease" }}
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.transform = "scale(1.05)"}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.transform = "scale(1)"}>
            <div style={{ width: 36, height: 36, background: "linear-gradient(135deg, var(--accent) 0%, #ff8c00 100%)", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 18, color: "#000", boxShadow: "0 0 15px rgba(240, 165, 0, 0.4)" }}>D</div>
            <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 20, color: "var(--text-primary)" }}>DataLens AI</span>
          </Link>
          <h1 style={{ fontFamily: "var(--font-display)", fontSize: 28, fontWeight: 800, color: "var(--text-primary)", letterSpacing: "-0.5px", marginBottom: 8 }}>Welcome back</h1>
          <p style={{ color: "var(--text-secondary)", fontSize: 14 }}>Sign in to your account to continue</p>
        </div>

        <div style={{ background: "var(--bg-card)", border: "1px solid var(--bg-border)", borderRadius: 16, padding: 32, backdropFilter: "blur(10px)", boxShadow: "0 8px 32px rgba(0, 0, 0, 0.1)" }}>
          {error && (
            <div style={{ background: "rgba(255,71,87,0.1)", border: "1px solid rgba(255,71,87,0.3)", borderRadius: 8, padding: "10px 14px", marginBottom: 20, fontSize: 14, color: "var(--accent-red)", animation: "slideInDown 0.3s ease" }}>
              ⚠️ {error}
            </div>
          )}
          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 8, fontFamily: "var(--font-body)" }}>Email</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="you@example.com"
                style={{ width: "100%", background: "var(--bg-secondary)", border: "1px solid var(--bg-border)", borderRadius: 8, padding: "10px 14px", color: "var(--text-primary)", fontSize: 14, outline: "none", fontFamily: "var(--font-body)", transition: "all 0.3s ease" }}
                onFocus={e => { e.target.style.borderColor = "var(--accent)"; e.target.style.boxShadow = "0 0 12px rgba(240, 165, 0, 0.3)"; }}
                onBlur={e => { e.target.style.borderColor = "var(--bg-border)"; e.target.style.boxShadow = "none"; }} />
            </div>
            <div style={{ marginBottom: 24 }}>
              <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 8 }}>Password</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} required placeholder="••••••••"
                style={{ width: "100%", background: "var(--bg-secondary)", border: "1px solid var(--bg-border)", borderRadius: 8, padding: "10px 14px", color: "var(--text-primary)", fontSize: 14, outline: "none", fontFamily: "var(--font-body)", transition: "all 0.3s ease" }}
                onFocus={e => { e.target.style.borderColor = "var(--accent)"; e.target.style.boxShadow = "0 0 12px rgba(240, 165, 0, 0.3)"; }}
                onBlur={e => { e.target.style.borderColor = "var(--bg-border)"; e.target.style.boxShadow = "none"; }} />
            </div>
            <button type="submit" disabled={loading}
              style={{ width: "100%", padding: "12px", borderRadius: 8, background: loading ? "rgba(240, 165, 0, 0.5)" : "linear-gradient(135deg, var(--accent) 0%, #ff8c00 100%)", color: "#000", border: "none", cursor: loading ? "not-allowed" : "pointer", fontSize: 15, fontWeight: 700, fontFamily: "var(--font-display)", letterSpacing: "-0.2px", transition: "all 0.3s ease", boxShadow: loading ? "none" : "0 0 15px rgba(240, 165, 0, 0.3)", transform: loading ? "scale(1)" : "scale(1)" }}
              onMouseEnter={e => !loading && ((e.currentTarget as HTMLElement).style.boxShadow = "0 0 25px rgba(240, 165, 0, 0.6)")}
              onMouseLeave={e => !loading && ((e.currentTarget as HTMLElement).style.boxShadow = "0 0 15px rgba(240, 165, 0, 0.3)")}>
              {loading ? "🔄 Signing in..." : "Sign in →"}
            </button>
          </form>
        </div>

        <p style={{ textAlign: "center", marginTop: 20, fontSize: 14, color: "var(--text-secondary)" }}>
          Don&apos;t have an account?{" "}
          <Link href="/register" style={{ color: "var(--accent)", textDecoration: "none", fontWeight: 600, transition: "color 0.3s ease" }}
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = "#ff8c00"}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = "var(--accent)"}>
            Create one
          </Link>
        </p>
      </div>
    </div>
  );
}
