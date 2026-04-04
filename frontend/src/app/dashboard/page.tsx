"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";
import { datasetsAPI, Dataset } from "@/lib/api";
import Sidebar from "@/components/layout/sidebar";

function ScoreBadge({ score }: { score: number }) {
  const color = score >= 80 ? "var(--accent-green)" : score >= 60 ? "var(--accent)" : "var(--accent-red)";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <div style={{ width: 36, height: 36, borderRadius: "50%", border: `2px solid ${color}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color, fontFamily: "var(--font-mono)" }}>
        {score}
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { user, token, loading } = useAuth();
  const router = useRouter();
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState("");
  const [deleting, setDeleting] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !token) router.push("/login");
  }, [loading, token, router]);

  useEffect(() => {
    if (!token) return;
    datasetsAPI.list(token).then(r => {
      setFetching(false);
      if (r.error) setError(r.error);
      else setDatasets(r.data || []);
    });
  }, [token]);

  const handleDelete = async (id: string) => {
    if (!token || !confirm("Delete this dataset and all its analyses?")) return;
    setDeleting(id);
    await datasetsAPI.delete(id, token);
    setDatasets(d => d.filter(x => x.id !== id));
    setDeleting(null);
  };

  const avgScore = datasets.length ? Math.round(datasets.reduce((a, d) => a + d.health_score, 0) / datasets.length) : 0;
  const readyCount = datasets.filter(d => d.status === "ready").length;
  const processingCount = datasets.filter(d => d.status === "processing").length;

  if (loading) return null;

  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      <Sidebar />
      <main style={{ flex: 1, background: "var(--bg-primary)", overflow: "auto" }}>
        {/* Header */}
        <div style={{ borderBottom: "1px solid var(--bg-border)", padding: "24px 32px", background: "var(--bg-secondary)" }}>
          <h1 style={{ fontFamily: "var(--font-display)", fontSize: 24, fontWeight: 800, color: "var(--text-primary)", letterSpacing: "-0.5px", marginBottom: 4 }}>
            Dashboard
          </h1>
          <p style={{ color: "var(--text-secondary)", fontSize: 14 }}>
            Welcome back, {user?.name?.split(" ")[0]}. Here are your datasets.
          </p>
        </div>

        <div style={{ padding: 32 }}>
          {/* Stats */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 16, marginBottom: 32 }}>
            {[
              { label: "Total Datasets", value: datasets.length, color: "var(--accent-blue)" },
              { label: "Ready", value: readyCount, color: "var(--accent-green)" },
              { label: "Processing", value: processingCount, color: "var(--accent)" },
              { label: "Avg Health Score", value: `${avgScore}/100`, color: avgScore >= 80 ? "var(--accent-green)" : avgScore >= 60 ? "var(--accent)" : "var(--accent-red)" },
            ].map(stat => (
              <div key={stat.label} style={{ background: "var(--bg-card)", border: "1px solid var(--bg-border)", borderRadius: 12, padding: "20px 24px" }}>
                <p style={{ fontSize: 12, color: "var(--text-muted)", fontFamily: "var(--font-mono)", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.5px" }}>{stat.label}</p>
                <p style={{ fontSize: 28, fontWeight: 800, fontFamily: "var(--font-display)", color: stat.color, letterSpacing: "-1px" }}>{stat.value}</p>
              </div>
            ))}
          </div>

          {/* Action */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
            <h2 style={{ fontFamily: "var(--font-display)", fontSize: 18, fontWeight: 700, color: "var(--text-primary)" }}>Your Datasets</h2>
            <Link href="/upload" style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "9px 18px", borderRadius: 8, background: "var(--accent)", color: "#000", textDecoration: "none", fontSize: 14, fontWeight: 700, fontFamily: "var(--font-display)" }}>
              + Upload Dataset
            </Link>
          </div>

          {/* Table */}
          {fetching ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {[1,2,3].map(i => <div key={i} className="skeleton" style={{ height: 60 }} />)}
            </div>
          ) : error ? (
            <div style={{ background: "rgba(255,71,87,0.1)", border: "1px solid rgba(255,71,87,0.2)", borderRadius: 12, padding: 24, color: "var(--accent-red)", fontSize: 14 }}>
              Failed to load datasets: {error}. Make sure the backend is running at {process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000"}.
            </div>
          ) : datasets.length === 0 ? (
            <div style={{ background: "var(--bg-card)", border: "2px dashed var(--bg-border)", borderRadius: 16, padding: 60, textAlign: "center" }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>📂</div>
              <h3 style={{ fontFamily: "var(--font-display)", fontSize: 18, fontWeight: 700, marginBottom: 8 }}>No datasets yet</h3>
              <p style={{ color: "var(--text-secondary)", fontSize: 14, marginBottom: 24 }}>Upload your first CSV or Excel file to get started.</p>
              <Link href="/upload" style={{ padding: "10px 24px", borderRadius: 8, background: "var(--accent)", color: "#000", textDecoration: "none", fontSize: 14, fontWeight: 700 }}>
                Upload now
              </Link>
            </div>
          ) : (
            <div style={{ background: "var(--bg-card)", border: "1px solid var(--bg-border)", borderRadius: 16, overflow: "hidden" }}>
              {/* Header row */}
              <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr 80px 100px", padding: "12px 20px", borderBottom: "1px solid var(--bg-border)", background: "var(--bg-secondary)" }}>
                {["Name", "Rows", "Columns", "Health Score", "Status", "Actions"].map(h => (
                  <span key={h} style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.5px", fontFamily: "var(--font-mono)" }}>{h}</span>
                ))}
              </div>
              {datasets.map((ds, i) => (
                <div key={ds.id} style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr 80px 100px", padding: "16px 20px", borderBottom: i < datasets.length - 1 ? "1px solid var(--bg-border)" : "none", alignItems: "center", transition: "background 0.15s" }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = "var(--bg-card-hover)"}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = "transparent"}>
                  <div>
                    <Link href={`/analysis/${ds.id}`} style={{ fontWeight: 600, color: "var(--text-primary)", textDecoration: "none", fontSize: 14, fontFamily: "var(--font-body)" }}
                      onMouseEnter={e => (e.target as HTMLElement).style.color = "var(--accent)"}
                      onMouseLeave={e => (e.target as HTMLElement).style.color = "var(--text-primary)"}>
                      {ds.name}
                    </Link>
                    <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2, fontFamily: "var(--font-mono)" }}>
                      {new Date(ds.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <span style={{ fontSize: 14, fontFamily: "var(--font-mono)", color: "var(--text-secondary)" }}>{ds.rows?.toLocaleString()}</span>
                  <span style={{ fontSize: 14, fontFamily: "var(--font-mono)", color: "var(--text-secondary)" }}>{ds.columns}</span>
                  <ScoreBadge score={ds.health_score} />
                  <span style={{ fontSize: 12, padding: "3px 10px", borderRadius: 100, display: "inline-block", width: "fit-content",
                    background: ds.status === "ready" ? "rgba(0,208,132,0.12)" : ds.status === "processing" ? "rgba(240,165,0,0.12)" : "rgba(255,71,87,0.12)",
                    color: ds.status === "ready" ? "var(--accent-green)" : ds.status === "processing" ? "var(--accent)" : "var(--accent-red)",
                    border: `1px solid ${ds.status === "ready" ? "rgba(0,208,132,0.3)" : ds.status === "processing" ? "rgba(240,165,0,0.3)" : "rgba(255,71,87,0.3)"}`,
                    fontFamily: "var(--font-mono)" }}>
                    {ds.status}
                  </span>
                  <div style={{ display: "flex", gap: 8 }}>
                    {ds.status === "ready" && (
                      <Link href={`/analysis/${ds.id}`} style={{ padding: "5px 12px", borderRadius: 6, background: "rgba(240,165,0,0.12)", color: "var(--accent)", textDecoration: "none", fontSize: 12, fontWeight: 600, border: "1px solid rgba(240,165,0,0.25)" }}>View</Link>
                    )}
                    <button onClick={() => handleDelete(ds.id)} disabled={deleting === ds.id}
                      style={{ padding: "5px 10px", borderRadius: 6, background: "transparent", border: "1px solid var(--bg-border)", color: "var(--text-muted)", cursor: "pointer", fontSize: 12 }}>
                      {deleting === ds.id ? "..." : "✕"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
