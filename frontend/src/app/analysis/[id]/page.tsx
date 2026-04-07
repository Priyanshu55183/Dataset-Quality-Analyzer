"use client";
import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { datasetsAPI, Report, ChatMessage, AlgoRecommendation } from "@/lib/api";
import Sidebar from "@/components/layout/sidebar";
import { RadialBarChart, RadialBar, PolarAngleAxis, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell } from "recharts";

const API_BASE = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

function StatCard({ label, value, sub, color = "var(--accent)" }: { label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <div style={{ background: "var(--bg-card)", border: "1px solid var(--bg-border)", borderRadius: 12, padding: "20px 22px" }}>
      <p style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "var(--font-mono)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 8 }}>{label}</p>
      <p style={{ fontSize: 26, fontWeight: 800, fontFamily: "var(--font-display)", color, letterSpacing: "-1px", marginBottom: sub ? 4 : 0 }}>{value}</p>
      {sub && <p style={{ fontSize: 12, color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>{sub}</p>}
    </div>
  );
}

function ProgressBar({ value, max = 100, color = "var(--accent)" }: { value: number; max?: number; color?: string }) {
  const pct = Math.min(100, (value / max) * 100);
  return (
    <div style={{ height: 6, background: "var(--bg-border)", borderRadius: 3, overflow: "hidden" }}>
      <div style={{ height: "100%", width: `${pct}%`, background: color, borderRadius: 3, transition: "width 1s ease" }} />
    </div>
  );
}

const TABS = ["Overview", "Columns", "Correlations", "AI Assistant", "Algo Advisor"];

export default function AnalysisPage() {
  const { id } = useParams<{ id: string }>();
  const { token, loading } = useAuth();
  const router = useRouter();

  const [report, setReport] = useState<Report | null>(null);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState("");
  const [tab, setTab] = useState(0);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const [algos, setAlgos] = useState<AlgoRecommendation[]>([]);
  const [algoLoading, setAlgoLoading] = useState(false);
  const [algoFetched, setAlgoFetched] = useState(false);

  const [exporting, setExporting] = useState(false);
  const [exportUrl, setExportUrl] = useState("");

  useEffect(() => {
    if (!loading && !token) router.push("/login");
  }, [loading, token, router]);

  useEffect(() => {
    if (!token || !id) return;
    datasetsAPI.getReport(id, token).then((r) => {
      setFetching(false);
      if (r.error) setError(r.error);
      else setReport(r.data);
    });
    datasetsAPI.getChatHistory(id, token).then((r) => {
      if (!r.error) setMessages(r.data || []);
    });
  }, [token, id]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const askQuestion = async (override?: string) => {
    const question = (override ?? chatInput).trim();
    if (!question || !token || chatLoading) return;

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: "user",
      content: question,
      created_at: new Date().toISOString(),
    };

    setMessages((m: ChatMessage[]) => [...m, userMsg]);
    setChatInput("");
    setChatLoading(true);

    try {
      const res = await fetch(`${API_BASE}/api/datasets/${id}/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ question }),
      });

      const data = await res.json();
      if (!res.ok) {
        const errText = data?.detail || `Request failed (${res.status})`;
        setMessages((m: ChatMessage[]) => [
          ...m,
          {
            id: (Date.now() + 1).toString(),
            role: "assistant",
            content: String(errText),
            created_at: new Date().toISOString(),
          },
        ]);
      } else {
        setMessages((m: ChatMessage[]) => [
          ...m,
          {
            id: (Date.now() + 1).toString(),
            role: "assistant",
            content: data?.answer || "No answer returned",
            created_at: new Date().toISOString(),
            sources: data?.sources || [],
          },
        ]);
      }
    } catch (e) {
      setMessages((m: ChatMessage[]) => [
        ...m,
        {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: (e as Error).message || "Failed to reach chat service",
          created_at: new Date().toISOString(),
        },
      ]);
    } finally {
      setChatLoading(false);
    }
  };

  const fetchAlgos = async () => {
    if (!token || algoFetched) return;
    setAlgoLoading(true);
    const res = await datasetsAPI.getAlgoRecommendations(id, token);
    setAlgoLoading(false);
    setAlgoFetched(true);
    if (!res.error) setAlgos(res.data || []);
  };

  useEffect(() => {
    if (tab === 4) fetchAlgos();
  }, [tab]);

  const handleExport = async () => {
    if (!token || exporting) return;
    setExporting(true);
    const res = await datasetsAPI.exportPdf(id, token);
    setExporting(false);
    if (!res.error && res.data) {
      const url = datasetsAPI.downloadUrl(res.data.file_id, token);
      setExportUrl(url);
      window.open(url, "_blank");
    }
  };

  const scoreColor = (s: number) => (s >= 80 ? "var(--accent-green)" : s >= 60 ? "var(--accent)" : "var(--accent-red)");

  if (loading || fetching) {
    return (
      <div style={{ display: "flex", minHeight: "100vh" }}>
        <Sidebar />
        <main style={{ flex: 1, background: "var(--bg-primary)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ textAlign: "center" }}>
            <div style={{ width: 40, height: 40, border: "3px solid var(--bg-border)", borderTopColor: "var(--accent)", borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "0 auto 16px" }} />
            <p style={{ color: "var(--text-secondary)", fontSize: 14 }}>Loading analysis...</p>
          </div>
        </main>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ display: "flex", minHeight: "100vh" }}>
        <Sidebar />
        <main style={{ flex: 1, background: "var(--bg-primary)", display: "flex", alignItems: "center", justifyContent: "center", padding: 32 }}>
          <div style={{ textAlign: "center", maxWidth: 480 }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>⚠️</div>
            <h2 style={{ fontFamily: "var(--font-display)", fontSize: 20, fontWeight: 700, marginBottom: 8 }}>Analysis not ready</h2>
            <p style={{ color: "var(--text-secondary)", fontSize: 14, marginBottom: 24 }}>{error}</p>
            <button onClick={() => router.push("/dashboard")} style={{ padding: "10px 24px", borderRadius: 8, background: "var(--accent)", color: "#000", border: "none", cursor: "pointer", fontWeight: 700, fontSize: 14, fontFamily: "var(--font-display)" }}>
              Back to Dashboard
            </button>
          </div>
        </main>
      </div>
    );
  }

  if (!report) return null;
  const sc = report.health_score;

  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      <Sidebar />
      <main style={{ flex: 1, background: "var(--bg-primary)", overflow: "auto", display: "flex", flexDirection: "column" }}>
        <div style={{ borderBottom: "1px solid var(--bg-border)", padding: "20px 32px", background: "var(--bg-secondary)", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
              <button onClick={() => router.push("/dashboard")} style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: 13, padding: 0, fontFamily: "var(--font-body)" }}>← Dashboard</button>
              <span style={{ color: "var(--text-muted)" }}>/</span>
              <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>{report.dataset_name}</span>
            </div>
            <h1 style={{ fontFamily: "var(--font-display)", fontSize: 22, fontWeight: 800, color: "var(--text-primary)", letterSpacing: "-0.5px" }}>{report.dataset_name}</h1>
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <div style={{ padding: "6px 16px", borderRadius: 100, background: `${scoreColor(sc)}20`, border: `1px solid ${scoreColor(sc)}40`, color: scoreColor(sc), fontSize: 13, fontWeight: 700, fontFamily: "var(--font-mono)" }}>
              Health: {sc}/100
            </div>
            <button onClick={handleExport} disabled={exporting} style={{ padding: "8px 18px", borderRadius: 8, background: "var(--bg-card)", border: "1px solid var(--bg-border)", color: "var(--text-primary)", cursor: exporting ? "not-allowed" : "pointer", fontSize: 13, fontWeight: 600, fontFamily: "var(--font-body)", display: "flex", alignItems: "center", gap: 6 }}>
              {exporting ? "Generating..." : "Export PDF"}
            </button>
            {exportUrl && (
              <a href={exportUrl} target="_blank" rel="noreferrer" style={{ padding: "8px 18px", borderRadius: 8, background: "rgba(0,208,132,0.1)", border: "1px solid rgba(0,208,132,0.3)", color: "var(--accent-green)", fontSize: 13, fontWeight: 600, textDecoration: "none" }}>
                Download PDF
              </a>
            )}
          </div>
        </div>

        <div style={{ borderBottom: "1px solid var(--bg-border)", padding: "0 32px", background: "var(--bg-secondary)", display: "flex", gap: 4 }}>
          {TABS.map((t, i) => (
            <button key={t} onClick={() => setTab(i)} style={{ padding: "12px 18px", background: "none", border: "none", cursor: "pointer", fontSize: 14, fontFamily: "var(--font-body)", fontWeight: tab === i ? 600 : 400, color: tab === i ? "var(--accent)" : "var(--text-secondary)", borderBottom: `2px solid ${tab === i ? "var(--accent)" : "transparent"}`, marginBottom: -1, transition: "all 0.15s" }}>
              {t}
            </button>
          ))}
        </div>

        <div style={{ flex: 1, padding: 32, overflow: "auto" }}>
          {tab === 0 && (
            <div>
              <div style={{ background: "var(--bg-card)", border: "1px solid var(--bg-border)", borderRadius: 16, padding: 32, marginBottom: 24, display: "flex", alignItems: "center", gap: 32, flexWrap: "wrap" }}>
                <div style={{ textAlign: "center", width: 140 }}>
                  <ResponsiveContainer width={140} height={140}>
                    <RadialBarChart
                      cx="50%" cy="50%" innerRadius="70%" outerRadius="100%"
                      barSize={10} data={[{ value: sc, fill: scoreColor(sc) }]}
                      startAngle={90} endAngle={-270}
                    >
                      <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
                      <RadialBar dataKey="value" cornerRadius={6} background={{ fill: "var(--bg-border)" }} />
                    </RadialBarChart>
                  </ResponsiveContainer>
                  <p style={{ fontSize: 28, fontWeight: 800, fontFamily: "var(--font-display)", color: scoreColor(sc), marginTop: -56, letterSpacing: "-1px" }}>{sc}</p>
                  <p style={{ fontSize: 10, color: "var(--text-muted)", fontFamily: "var(--font-mono)", marginTop: 40 }}>/ 100</p>
                  <p style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 4, fontFamily: "var(--font-mono)" }}>Health Score</p>
                </div>
                <div style={{ flex: 1, minWidth: 200 }}>
                  <h2 style={{ fontFamily: "var(--font-display)", fontSize: 20, fontWeight: 700, marginBottom: 6 }}>
                    {sc >= 80 ? "High Quality" : sc >= 60 ? "Moderate Quality" : "Poor Quality"}
                  </h2>
                  <p style={{ color: "var(--text-secondary)", fontSize: 14, lineHeight: 1.6 }}>
                    {sc >= 80
                      ? "This dataset is in good shape. Minor issues may still warrant attention before modeling."
                      : sc >= 60
                      ? "Several quality issues detected. Review column details and recommendations before modeling."
                      : "Significant quality issues detected. Address missing values, duplicates, and bias before use."}
                  </p>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 12, minWidth: 200 }}>
                  {[
                    { label: "Completeness", val: report.completeness_score ?? 100 - report.missing_pct },
                    { label: "Consistency", val: report.consistency_score ?? Math.max(0, 100 - report.duplicate_rows) },
                    { label: "Noise-free", val: report.noise_score ?? Math.max(0, 100 - ((report.outlier_count / Math.max(report.total_rows, 1)) * 100)) },
                  ].map((m) => (
                    <div key={m.label}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                        <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>{m.label}</span>
                        <span style={{ fontSize: 12, fontFamily: "var(--font-mono)", color: scoreColor(m.val) }}>{Math.round(m.val)}%</span>
                      </div>
                      <ProgressBar value={m.val} color={scoreColor(m.val)} />
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 16, marginBottom: 24 }}>
                <StatCard label="Total Rows" value={report.total_rows.toLocaleString()} color="var(--accent-blue)" />
                <StatCard label="Columns" value={report.total_columns} color="var(--accent-blue)" />
                <StatCard label="Missing Cells" value={report.missing_cells?.toLocaleString() || "0"} sub={`${report.missing_pct?.toFixed(1)}% of total`} color={report.missing_pct > 10 ? "var(--accent-red)" : "var(--accent)"} />
                <StatCard label="Duplicate Rows" value={report.duplicate_rows} color={report.duplicate_rows > 0 ? "var(--accent-red)" : "var(--accent-green)"} />
                <StatCard label="Outliers" value={report.outlier_count} sub="across all numeric cols" color={report.outlier_count > 0 ? "var(--accent)" : "var(--accent-green)"} />
              </div>

              {report.columns && report.columns.length > 0 && (
                <div style={{ background: "var(--bg-card)", border: "1px solid var(--bg-border)", borderRadius: 16, padding: 28, marginBottom: 24 }}>
                  <h3 style={{ fontFamily: "var(--font-display)", fontSize: 15, fontWeight: 700, marginBottom: 20, color: "var(--text-primary)" }}>
                    Missing Values by Column
                  </h3>
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart
                      data={report.columns
                        .filter(c => (c.missing_pct || 0) > 0)
                        .sort((a, b) => (b.missing_pct || 0) - (a.missing_pct || 0))
                        .slice(0, 12)
                        .map(c => ({ name: c.name, value: parseFloat((c.missing_pct || 0).toFixed(1)) }))}
                      margin={{ top: 0, right: 16, left: 0, bottom: 40 }}
                    >
                      <XAxis dataKey="name" tick={{ fontSize: 11, fill: "var(--text-muted)", fontFamily: "var(--font-mono)" }} angle={-35} textAnchor="end" interval={0} />
                      <YAxis tick={{ fontSize: 11, fill: "var(--text-muted)" }} unit="%" domain={[0, 100]} />
                      <Tooltip
                        contentStyle={{ background: "var(--bg-secondary)", border: "1px solid var(--bg-border)", borderRadius: 8, fontSize: 12 }}
                        formatter={(v) => [`${Number(v ?? 0)}%`, "Missing"]}
                      />
                      <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                        {report.columns
                          .filter(c => (c.missing_pct || 0) > 0)
                          .sort((a, b) => (b.missing_pct || 0) - (a.missing_pct || 0))
                          .slice(0, 12)
                          .map((c, i) => (
                            <Cell key={i} fill={(c.missing_pct || 0) > 20 ? "var(--accent-red)" : (c.missing_pct || 0) > 10 ? "var(--accent)" : "var(--accent-blue)"} />
                          ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                  {report.columns.every(c => !c.missing_pct || c.missing_pct === 0) && (
                    <p style={{ color: "var(--accent-green)", fontSize: 13, textAlign: "center", marginTop: 8 }}>✓ No missing values found</p>
                  )}
                </div>
              )}
            </div>
          )}

          {tab === 1 && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 16 }}>
              {(report.columns || []).map((col) => (
                <div key={col.name} style={{ background: "var(--bg-card)", border: "1px solid var(--bg-border)", borderRadius: 12, padding: 20 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                    <h3 style={{ fontFamily: "var(--font-display)", fontSize: 14, fontWeight: 700, color: "var(--text-primary)" }}>{col.name}</h3>
                    <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 4, background: "var(--bg-secondary)", color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>{col.dtype}</span>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                      <span style={{ color: "var(--text-muted)" }}>Missing</span>
                      <span style={{ fontFamily: "var(--font-mono)", color: (col.missing_pct || 0) > 10 ? "var(--accent-red)" : "var(--text-secondary)" }}>{(col.missing_pct || 0).toFixed(1)}%</span>
                    </div>
                    <ProgressBar value={col.missing_pct || 0} color={(col.missing_pct || 0) > 10 ? "var(--accent-red)" : "var(--accent-green)"} />
                  </div>
                  {col.mean !== undefined && (
                    <div style={{ marginTop: 12, borderTop: "1px solid var(--bg-border)", paddingTop: 12 }}>
                      <p style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "var(--font-mono)", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.4px" }}>Stats</p>
                      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                        {[
                          { label: "Mean", val: col.mean?.toFixed(2) },
                          { label: "Std Dev", val: col.std?.toFixed(2) },
                          { label: "Min", val: col.min?.toFixed(2) },
                          { label: "Max", val: col.max?.toFixed(2) },
                        ].map(s => (
                          <div key={s.label} style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                            <span style={{ color: "var(--text-muted)" }}>{s.label}</span>
                            <span style={{ fontFamily: "var(--font-mono)", color: "var(--text-secondary)" }}>{s.val ?? "—"}</span>
                          </div>
                        ))}
                        {(col.outlier_pct || 0) > 0 && (
                          <div style={{ marginTop: 6 }}>
                            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
                              <span style={{ color: "var(--text-muted)" }}>Outliers</span>
                              <span style={{ fontFamily: "var(--font-mono)", color: (col.outlier_pct || 0) > 5 ? "var(--accent-red)" : "var(--accent)" }}>{(col.outlier_pct || 0).toFixed(1)}%</span>
                            </div>
                            <ProgressBar value={col.outlier_pct || 0} color={(col.outlier_pct || 0) > 5 ? "var(--accent-red)" : "var(--accent)"} />
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                  {col.top_values && Object.keys(col.top_values).length > 0 && (
                    <div style={{ marginTop: 12, borderTop: "1px solid var(--bg-border)", paddingTop: 12 }}>
                      <p style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "var(--font-mono)", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.4px" }}>Top Values</p>
                      <ResponsiveContainer width="100%" height={100}>
                        <BarChart
                          data={Object.entries(col.top_values).slice(0, 5).map(([k, v]) => ({ name: k, count: v }))}
                          margin={{ top: 0, right: 0, left: -20, bottom: 0 }}
                        >
                          <XAxis dataKey="name" tick={{ fontSize: 9, fill: "var(--text-muted)" }} />
                          <YAxis tick={{ fontSize: 9, fill: "var(--text-muted)" }} />
                          <Tooltip contentStyle={{ background: "var(--bg-secondary)", border: "1px solid var(--bg-border)", borderRadius: 6, fontSize: 11 }} />
                          <Bar dataKey="count" fill="var(--accent-blue)" radius={[3, 3, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {tab === 2 && (
            <div>
              <div style={{ background: "var(--bg-card)", border: "1px solid var(--bg-border)", borderRadius: 16, padding: 28, marginBottom: 24 }}>
                <h3 style={{ fontFamily: "var(--font-display)", fontSize: 16, fontWeight: 700, marginBottom: 20 }}>Top Correlations</h3>
                {(!report.correlations || report.correlations.length === 0) ? (
                  <p style={{ color: "var(--text-secondary)", fontSize: 14 }}>No significant correlations found.</p>
                ) : (
                  <div>
                    <ResponsiveContainer width="100%" height={Math.max(200, Math.min(report.correlations.length, 15) * 36 + 40)}>
                      <BarChart
                        layout="vertical"
                        data={report.correlations
                          .slice(0, 15)
                          .map(c => ({
                            name: `${c.col1} × ${c.col2}`,
                            value: parseFloat(c.value.toFixed(3)),
                            abs: parseFloat(Math.abs(c.value).toFixed(3)),
                          }))}
                        margin={{ top: 0, right: 60, left: 8, bottom: 0 }}
                      >
                        <XAxis type="number" domain={[-1, 1]} tick={{ fontSize: 11, fill: "var(--text-muted)" }} tickFormatter={v => v.toFixed(1)} />
                        <YAxis type="category" dataKey="name" width={200} tick={{ fontSize: 11, fill: "var(--text-muted)", fontFamily: "var(--font-mono)" }} />
                        <Tooltip
                          contentStyle={{ background: "var(--bg-secondary)", border: "1px solid var(--bg-border)", borderRadius: 8, fontSize: 12 }}
                          formatter={(v) => [Number(v ?? 0).toFixed(3), "Correlation"]}
                        />
                        <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                          {report.correlations.slice(0, 15).map((c, i) => (
                            <Cell key={i} fill={Math.abs(c.value) > 0.7 ? "var(--accent-red)" : Math.abs(c.value) > 0.4 ? "var(--accent)" : "var(--accent-blue)"} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                    <div style={{ display: "flex", gap: 16, marginTop: 16, fontSize: 12, color: "var(--text-muted)" }}>
                      <span style={{ display: "flex", alignItems: "center", gap: 6 }}><span style={{ width: 10, height: 10, borderRadius: 2, background: "var(--accent-red)", display: "inline-block" }} /> Strong (&gt;0.7)</span>
                      <span style={{ display: "flex", alignItems: "center", gap: 6 }}><span style={{ width: 10, height: 10, borderRadius: 2, background: "var(--accent)", display: "inline-block" }} /> Moderate (0.4–0.7)</span>
                      <span style={{ display: "flex", alignItems: "center", gap: 6 }}><span style={{ width: 10, height: 10, borderRadius: 2, background: "var(--accent-blue)", display: "inline-block" }} /> Weak (&lt;0.4)</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {tab === 3 && (
            <div style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 200px)", maxHeight: 700 }}>
              <div style={{ background: "var(--bg-card)", border: "1px solid var(--bg-border)", borderRadius: "12px 12px 0 0", padding: "14px 20px", borderBottom: "1px solid var(--bg-border)" }}>
                <h3 style={{ fontFamily: "var(--font-display)", fontSize: 15, fontWeight: 700 }}>AI Assistant</h3>
                <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>Grounded in this dataset analysis report</p>
              </div>
              <div style={{ flex: 1, overflow: "auto", padding: 20, background: "var(--bg-card)", display: "flex", flexDirection: "column", gap: 16 }}>
                {messages.length === 0 && (
                  <div style={{ textAlign: "center", padding: "40px 20px" }}>
                    <p style={{ color: "var(--text-secondary)", fontSize: 13, marginBottom: 20 }}>Ask anything about your data quality, columns, or patterns.</p>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center" }}>
                      {["What are the main quality issues?", "Which columns have most missing data?", "Is this data suitable for classification?", "Explain the outliers found."].map((q) => (
                        <button key={q} onClick={() => setChatInput(q)} style={{ padding: "6px 14px", borderRadius: 100, background: "var(--bg-secondary)", border: "1px solid var(--bg-border)", color: "var(--text-secondary)", cursor: "pointer", fontSize: 12, fontFamily: "var(--font-body)" }}>
                          {q}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {messages.map((msg) => (
                  <div key={msg.id} style={{ display: "flex", justifyContent: msg.role === "user" ? "flex-end" : "flex-start" }}>
                    <div style={{ maxWidth: "80%", padding: "12px 16px", borderRadius: msg.role === "user" ? "12px 12px 2px 12px" : "12px 12px 12px 2px", background: msg.role === "user" ? "var(--accent)" : "var(--bg-secondary)", color: msg.role === "user" ? "#000" : "var(--text-primary)", fontSize: 14, lineHeight: 1.6, fontFamily: "var(--font-body)" }}>
                      {msg.content}
                    </div>
                  </div>
                ))}
                {chatLoading && (
                  <div style={{ display: "flex", gap: 6, padding: "12px 16px", background: "var(--bg-secondary)", borderRadius: 12, width: "fit-content" }}>
                    {[0, 1, 2].map((i) => (
                      <div key={i} style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--accent)", animation: `bounce-dots 1.4s infinite ${i * 0.2}s` }} />
                    ))}
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>
              <div style={{ background: "var(--bg-card)", border: "1px solid var(--bg-border)", borderRadius: "0 0 12px 12px", padding: 16, borderTop: "1px solid var(--bg-border)", display: "flex", gap: 10 }}>
                <input
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && askQuestion()}
                  placeholder="Ask about your dataset..."
                  style={{ flex: 1, padding: "10px 14px", borderRadius: 8, background: "var(--bg-secondary)", border: "1px solid var(--bg-border)", color: "var(--text-primary)", fontSize: 14, outline: "none", fontFamily: "var(--font-body)" }}
                />
                <button onClick={() => askQuestion()} disabled={!chatInput.trim() || chatLoading} style={{ padding: "10px 20px", borderRadius: 8, background: chatInput.trim() ? "var(--accent)" : "var(--bg-border)", color: chatInput.trim() ? "#000" : "var(--text-muted)", border: "none", cursor: chatInput.trim() ? "pointer" : "not-allowed", fontSize: 14, fontWeight: 700, fontFamily: "var(--font-display)", transition: "all 0.2s" }}>
                  Send
                </button>
              </div>
            </div>
          )}

          {tab === 4 && (
            <div>
              <div style={{ marginBottom: 24 }}>
                <h2 style={{ fontFamily: "var(--font-display)", fontSize: 20, fontWeight: 800, marginBottom: 8 }}>Algorithm Recommendations</h2>
                <p style={{ color: "var(--text-secondary)", fontSize: 14 }}>Based on your dataset shape and quality profile.</p>
              </div>
              {algoLoading ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="skeleton" style={{ height: 100 }} />
                  ))}
                </div>
              ) : algos.length === 0 ? (
                <div style={{ background: "var(--bg-card)", border: "1px solid var(--bg-border)", borderRadius: 12, padding: 32, textAlign: "center" }}>
                  <p style={{ color: "var(--text-secondary)", fontSize: 14 }}>{algoFetched ? "No recommendations available." : "Loading recommendations..."}</p>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                  {algos.map((algo, i) => (
                    <div key={i} style={{ background: "var(--bg-card)", border: "1px solid var(--bg-border)", borderRadius: 14, padding: 24 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
                        <div>
                          <h3 style={{ fontFamily: "var(--font-display)", fontSize: 17, fontWeight: 800, color: "var(--text-primary)", marginBottom: 4 }}>{algo.name}</h3>
                          <p style={{ fontSize: 14, color: "var(--text-secondary)", lineHeight: 1.5 }}>{algo.reason}</p>
                        </div>
                        <div style={{ textAlign: "center", flexShrink: 0 }}>
                          <div style={{ fontSize: 24, fontWeight: 800, fontFamily: "var(--font-display)", color: scoreColor(algo.score) }}>{algo.score}%</div>
                          <div style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>fit score</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
