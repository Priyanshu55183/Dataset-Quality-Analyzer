"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";

const navItems = [
  { href: "/dashboard", icon: "⬡", label: "Dashboard" },
  { href: "/upload", icon: "↑", label: "Upload Dataset" },
  { href: "/history", icon: "◷", label: "History" },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();

  return (
    <aside style={{ width: 220, background: "var(--bg-secondary)", borderRight: "1px solid var(--bg-border)", display: "flex", flexDirection: "column", minHeight: "100vh", padding: "20px 12px", flexShrink: 0 }}>
      {/* Logo */}
      <Link href="/dashboard" style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none", padding: "8px 12px", marginBottom: 32 }}>
        <div style={{ width: 32, height: 32, background: "var(--accent)", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 16, color: "#000", flexShrink: 0 }}>D</div>
        <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 16, color: "var(--text-primary)" }}>DataLens</span>
      </Link>

      {/* Nav */}
      <nav style={{ flex: 1, display: "flex", flexDirection: "column", gap: 4 }}>
        {navItems.map(item => {
          const active = pathname.startsWith(item.href);
          return (
            <Link key={item.href} href={item.href} style={{
              display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 8,
              background: active ? "rgba(240,165,0,0.12)" : "transparent",
              border: active ? "1px solid rgba(240,165,0,0.25)" : "1px solid transparent",
              color: active ? "var(--accent)" : "var(--text-secondary)",
              textDecoration: "none", fontSize: 14, fontWeight: active ? 600 : 400,
              fontFamily: "var(--font-body)", transition: "all 0.15s",
            }}
              onMouseEnter={e => { if (!active) (e.currentTarget as HTMLElement).style.background = "var(--bg-card)"; }}
              onMouseLeave={e => { if (!active) (e.currentTarget as HTMLElement).style.background = "transparent"; }}>
              <span style={{ fontSize: 16, width: 20, textAlign: "center" }}>{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* User */}
      <div style={{ borderTop: "1px solid var(--bg-border)", paddingTop: 16, marginTop: 16 }}>
        <div style={{ padding: "8px 12px", marginBottom: 8 }}>
          <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", marginBottom: 2, fontFamily: "var(--font-body)" }}>{user?.name || "User"}</p>
          <p style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>{user?.email}</p>
        </div>
        <button onClick={logout} style={{ width: "100%", padding: "8px 12px", borderRadius: 8, background: "transparent", border: "1px solid var(--bg-border)", color: "var(--text-secondary)", cursor: "pointer", fontSize: 13, fontFamily: "var(--font-body)", textAlign: "left", transition: "all 0.15s" }}
          onMouseEnter={e => { (e.target as HTMLElement).style.background = "rgba(255,71,87,0.1)"; (e.target as HTMLElement).style.color = "var(--accent-red)"; (e.target as HTMLElement).style.borderColor = "rgba(255,71,87,0.3)"; }}
          onMouseLeave={e => { (e.target as HTMLElement).style.background = "transparent"; (e.target as HTMLElement).style.color = "var(--text-secondary)"; (e.target as HTMLElement).style.borderColor = "var(--bg-border)"; }}>
          Sign out
        </button>
      </div>
    </aside>
  );
}
