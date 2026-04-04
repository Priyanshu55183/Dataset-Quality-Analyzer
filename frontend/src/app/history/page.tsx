"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";
import { datasetsAPI, Dataset } from "@/lib/api";
import Sidebar from "@/components/layout/sidebar";

export default function HistoryPage() {
  const { token, loading } = useAuth();
  const router = useRouter();
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [fetching, setFetching] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => { if (!loading && !token) router.push("/login"); }, [loading, token, router]);

  useEffect(() => {
    if (!token) return;
    datasetsAPI.list(token).then(r => { setFetching(false); if (!r.error) setDatasets(r.data || []); });
  }, [token]);

  const filtered = datasets.filter(d => d.name.toLowerCase().includes(search.toLowerCase()));
  const scoreColor = (s: number) => s >= 80 ? "var(--accent-green)" : s >= 60 ? "var(--accent)" : "var(--accent-red)";

  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      <Sidebar />
      <main style={{ flex: 1, background: "var(--bg-primary)", overflow: "auto" }}>
        <div style={{ borderBottom: "1px solid var(--bg-border)", padding: "24px 32px", background: "var(--bg-secondary)" }}>
          <h1 style={{ fontFamily: "var(--font-display)", fontSize: 24, fontWeight: 800, color: "var(--text-primary)", letterSpacing: "-0.5px", marginBottom: 4 }}>Analysis History</h1>
          <p style={{ color: "var(--text-secondary)", fontSize: 14 }}>All past dataset analyses — click any to revisit.</p>
        </div>

        <div style={{ padding: 32 }}>
          <div style={{ display: "flex", gap: 12, marginBottom: 24, alignItems: "center" }}>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search datasets…"
              style={{ flex: 1, maxWidth: 340, padding: "9px 14px", borderRadius: 8, background: "var(--bg-card)", border: "1px solid var(--bg-border)", color: "var(--text-primary)", fontSize: 14, outline: "none", fontFamily: "var(--font-body)" }}
              onFocus={e => e.target.style.borderColor = "var(--accent)"}
              onBlur={e => e.target.style.borderColor = "var(--bg-border)"} />
            <span style={{ color: "var(--text-muted)", fontSize: 13, fontFamily: "var(--font-mono)" }}>{filtered.length} result{filtered.length !== 1 ? "s" : ""}</span>
          </div>

          {fetching ? (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
              {[1,2,3,4].map(i => <div key={i} className="skeleton" style={{ height: 140 }} />)}
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ textAlign: "center", padding: "80px 24px", color: "var(--text-secondary)" }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>🔍</div>
              <p style={{ fontSize: 16, fontFamily: "var(--font-display)", fontWeight: 700, marginBottom: 8 }}>{search ? "No matches found" : "No analyses yet"}</p>
              <p style={{ fontSize: 14, marginBottom: 24 }}>{search ? "Try a different search term." : "Upload your first dataset to get started."}</p>
              {!search && <Link href="/upload" style={{ padding: "10px 24px", borderRadius: 8, background: "var(--accent)", color: "#000", textDecoration: "none", fontSize: 14, fontWeight: 700 }}>Upload Dataset</Link>}
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
              {filtered.map(ds => (
                <Link key={ds.id} href={`/analysis/${ds.id}`} style={{ textDecoration: "none", display: "block" }}>
                  <div style={{ background: "var(--bg-card)", border: "1px solid var(--bg-border)", borderRadius: 14, padding: 22, transition: "all 0.2s", cursor: "pointer" }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(240,165,0,0.3)"; (e.currentTarget as HTMLElement).style.transform = "translateY(-3px)"; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = "var(--bg-border)"; (e.currentTarget as HTMLElement).style.transform = "translateY(0)"; }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                      <h3 style={{ fontFamily: "var(--font-display)", fontSize: 15, fontWeight: 700, color: "var(--text-primary)", lineHeight: 1.3, flex: 1, marginRight: 12 }}>{ds.name}</h3>
                      <div style={{ fontSize: 20, fontWeight: 800, fontFamily: "var(--font-display)", color: scoreColor(ds.health_score), flexShrink: 0 }}>{ds.health_score}</div>
                    </div>
                    <div style={{ display: "flex", gap: 16, marginBottom: 12 }}>
                      <span style={{ fontSize: 12, color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>{ds.rows?.toLocaleString()} rows</span>
                      <span style={{ fontSize: 12, color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>{ds.columns} cols</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
                        {new Date(ds.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                      </span>
                      <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 100, background: ds.status === "ready" ? "rgba(0,208,132,0.1)" : "rgba(240,165,0,0.1)", color: ds.status === "ready" ? "var(--accent-green)" : "var(--accent)", border: `1px solid ${ds.status === "ready" ? "rgba(0,208,132,0.2)" : "rgba(240,165,0,0.2)"}`, fontFamily: "var(--font-mono)" }}>{ds.status}</span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
