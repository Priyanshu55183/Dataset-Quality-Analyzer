"use client";
import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { datasetsAPI, Report, ChatMessage, AlgoRecommendation } from "@/lib/api";
import Sidebar from "@/components/layout/sidebar";

// ── Mini helpers ─────────────────────────────────────────────────
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

  // Chat state
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Algo state
  const [algos, setAlgos] = useState<AlgoRecommendation[]>([]);
  const [algoLoading, setAlgoLoading] = useState(false);
  const [algoFetched, setAlgoFetched] = useState(false);

  // Export state
  const [exporting, setExporting] = useState(false);
  const [exportUrl, setExportUrl] = useState("");

  useEffect(() => { if (!loading && !token) router.push("/login"); }, [loading, token, router]);

  useEffect(() => {
    if (!token || !id) return;
    datasetsAPI.getReport(id, token).then(r => {
      setFetching(false);
      if (r.error) setError(r.error);
      else setReport(r.data!);
    });
    datasetsAPI.getChatHistory(id, token).then(r => { if (!r.error) setMessages(r.data || []); });
  }, [token, id]);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const handleChat = async () => {
    if (!chatInput.trim() || !token || chatLoading) return;
    const userMsg: ChatMessage = { id: Date.now().toString(), role: "user", content: chatInput, created_at: new Date().toISOString() };
    setMessages(m => [...m, userMsg]);
    setChatInput("");
    setChatLoading(true);
    const res = await datasetsAPI.chat(id, userMsg.content, token);
    setChatLoading(false);
    if (!res.error) {
      setMessages(m => [...m, { id: (Date.now()+1).toString(), role: "assistant", content: res.data!.answer, created_at: new Date().toISOString(), sources: res.data!.sources }]);
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

  useEffect(() => { if (tab === 4) fetchAlgos(); }, [tab]);

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

  const scoreColor = (s: number) => s >= 80 ? "var(--accent-green)" : s >= 60 ? "var(--accent)" : "var(--accent-red)";

  if (loading || fetching) {
    return (
      <div style={{ display: "flex", minHeight: "100vh" }}>
        <Sidebar />
        <main style={{ flex: 1, background: "var(--bg-primary)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ textAlign: "center" }}>
            <div style={{ width: 40, height: 40, border: "3px solid var(--bg-border)", borderTopColor: "var(--accent)", borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "0 auto 16px" }} />
            <p style={{ color: "var(--text-secondary)", fontSize: 14 }}>Loading analysis…</p>
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
        {/* Header */}
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
            <button onClick={handleExport} disabled={exporting}
              style={{ padding: "8px 18px", borderRadius: 8, background: "var(--bg-card)", border: "1px solid var(--bg-border)", color: "var(--text-primary)", cursor: exporting ? "not-allowed" : "pointer", fontSize: 13, fontWeight: 600, fontFamily: "var(--font-body)", display: "flex", alignItems: "center", gap: 6 }}>
              {exporting ? "⏳ Generating…" : "📄 Export PDF"}
            </button>
            {exportUrl && (
              <a href={exportUrl} target="_blank" rel="noreferrer" style={{ padding: "8px 18px", borderRadius: 8, background: "rgba(0,208,132,0.1)", border: "1px solid rgba(0,208,132,0.3)", color: "var(--accent-green)", fontSize: 13, fontWeight: 600, textDecoration: "none" }}>
                ⬇ Download PDF
              </a>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div style={{ borderBottom: "1px solid var(--bg-border)", padding: "0 32px", background: "var(--bg-secondary)", display: "flex", gap: 4 }}>
          {TABS.map((t, i) => (
            <button key={t} onClick={() => setTab(i)}
              style={{ padding: "12px 18px", background: "none", border: "none", cursor: "pointer", fontSize: 14, fontFamily: "var(--font-body)", fontWeight: tab === i ? 600 : 400, color: tab === i ? "var(--accent)" : "var(--text-secondary)", borderBottom: `2px solid ${tab === i ? "var(--accent)" : "transparent"}`, marginBottom: -1, transition: "all 0.15s" }}>
              {t}
            </button>
          ))}
        </div>

        <div style={{ flex: 1, padding: 32, overflow: "auto" }}>

          {/* ── TAB 0: Overview ── */}
          {tab === 0 && (
            <div>
              {/* Score hero */}
              <div style={{ background: "var(--bg-card)", border: "1px solid var(--bg-border)", borderRadius: 16, padding: 32, marginBottom: 24, display: "flex", alignItems: "center", gap: 32, flexWrap: "wrap" }}>
                <div style={{ textAlign: "center" }}>
                  <div style={{ width: 100, height: 100, borderRadius: "50%", border: `4px solid ${scoreColor(sc)}`, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column" }}>
                    <span style={{ fontSize: 28, fontWeight: 800, fontFamily: "var(--font-display)", color: scoreColor(sc), letterSpacing: "-1px" }}>{sc}</span>
                    <span style={{ fontSize: 10, color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>/ 100</span>
                  </div>
                  <p style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 8, fontFamily: "var(--font-mono)" }}>Health Score</p>
                </div>
                <div style={{ flex: 1, minWidth: 200 }}>
                  <h2 style={{ fontFamily: "var(--font-display)", fontSize: 20, fontWeight: 700, marginBottom: 6 }}>
                    {sc >= 80 ? "✅ High Quality" : sc >= 60 ? "⚠️ Moderate Quality" : "❌ Poor Quality"}
                  </h2>
                  <p style={{ color: "var(--text-secondary)", fontSize: 14, lineHeight: 1.6 }}>
                    {sc >= 80 ? "This dataset is in good shape. Minor issues may still warrant attention before modeling." : sc >= 60 ? "Several quality issues detected. Review column details and recommendations before modeling." : "Significant quality issues detected. Address missing values, duplicates, and bias before use."}
                  </p>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 12, minWidth: 200 }}>
                  {[
                    { label: "Completeness", val: report.completeness_score ?? (100 - report.missing_pct) },
                    { label: "Consistency", val: report.consistency_score ?? Math.max(0, 100 - report.duplicate_rows) },
                    { label: "Noise-free", val: report.noise_score ?? Math.max(0, 100 - (report.outlier_count / report.total_rows * 100)) },
                  ].map(m => (
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

              {/* Stat grid */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 16, marginBottom: 24 }}>
                <StatCard label="Total Rows" value={report.total_rows.toLocaleString()} color="var(--accent-blue)" />
                <StatCard label="Columns" value={report.total_columns} color="var(--accent-blue)" />
                <StatCard label="Missing Cells" value={report.missing_cells.toLocaleString()} sub={`${report.missing_pct?.toFixed(1)}% of total`} color={report.missing_pct > 10 ? "var(--accent-red)" : "var(--accent)"} />
                <StatCard label="Duplicate Rows" value={report.duplicate_rows} color={report.duplicate_rows > 0 ? "var(--accent-red)" : "var(--accent-green)"} />
                <StatCard label="Outliers" value={report.outlier_count} sub="across all numeric cols" color={report.outlier_count > 0 ? "var(--accent)" : "var(--accent-green)"} />
              </div>

              {/* Bias Flags */}
              {report.bias_flags?.length > 0 && (
                <div style={{ background: "rgba(255,71,87,0.06)", border: "1px solid rgba(255,71,87,0.2)", borderRadius: 12, padding: 20, marginBottom: 24 }}>
                  <h3 style={{ fontFamily: "var(--font-display)", fontSize: 15, fontWeight: 700, color: "var(--accent-red)", marginBottom: 12 }}>⚠️ Bias Flags Detected</h3>
                  <ul style={{ listStyle: "none", display: "flex", flexDirection: "column", gap: 6 }}>
                    {report.bias_flags.map((f, i) => (
                      <li key={i} style={{ fontSize: 14, color: "var(--text-secondary)", display: "flex", gap: 8 }}>
                        <span style={{ color: "var(--accent-red)" }}>→</span>{f}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Recommendations */}
              {report.recommendations?.length > 0 && (
                <div style={{ background: "var(--bg-card)", border: "1px solid var(--bg-border)", borderRadius: 12, padding: 20 }}>
                  <h3 style={{ fontFamily: "var(--font-display)", fontSize: 15, fontWeight: 700, marginBottom: 12 }}>💡 Recommendations</h3>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {report.recommendations.map((r, i) => (
                      <div key={i} style={{ display: "flex", gap: 10, padding: "10px 14px", borderRadius: 8, background: "var(--bg-secondary)", fontSize: 14, color: "var(--text-secondary)", alignItems: "flex-start" }}>
                        <span style={{ color: "var(--accent)", fontWeight: 700, flexShrink: 0 }}>{i + 1}.</span>
                        {r}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── TAB 1: Columns ── */}
          {tab === 1 && (
            <div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 16 }}>
                {report.columns?.map(col => (
                  <div key={col.name} style={{ background: "var(--bg-card)", border: "1px solid var(--bg-border)", borderRadius: 12, padding: 20 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                      <h3 style={{ fontFamily: "var(--font-display)", fontSize: 14, fontWeight: 700, color: "var(--text-primary)" }}>{col.name}</h3>
                      <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 4, background: "var(--bg-secondary)", color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>{col.dtype}</span>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                        <span style={{ color: "var(--text-muted)" }}>Missing</span>
                        <span style={{ fontFamily: "var(--font-mono)", color: col.missing_pct > 10 ? "var(--accent-red)" : "var(--text-secondary)" }}>{col.missing_pct?.toFixed(1)}%</span>
                      </div>
                      <ProgressBar value={col.missing_pct} color={col.missing_pct > 10 ? "var(--accent-red)" : "var(--accent-green)"} />
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                        <span style={{ color: "var(--text-muted)" }}>Unique values</span>
                        <span style={{ fontFamily: "var(--font-mono)", color: "var(--text-secondary)" }}>{col.unique_count?.toLocaleString()}</span>
                      </div>
                      {col.mean !== undefined && (
                        <>
                          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                            <span style={{ color: "var(--text-muted)" }}>Mean</span>
                            <span style={{ fontFamily: "var(--font-mono)", color: "var(--text-secondary)" }}>{col.mean?.toFixed(3)}</span>
                          </div>
                          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                            <span style={{ color: "var(--text-muted)" }}>Std Dev</span>
                            <span style={{ fontFamily: "var(--font-mono)", color: "var(--text-secondary)" }}>{col.std?.toFixed(3)}</span>
                          </div>
                          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                            <span style={{ color: "var(--text-muted)" }}>Range</span>
                            <span style={{ fontFamily: "var(--font-mono)", color: "var(--text-secondary)" }}>{col.min?.toFixed(2)} – {col.max?.toFixed(2)}</span>
                          </div>
                          {col.outlier_pct !== undefined && col.outlier_pct > 0 && (
                            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                              <span style={{ color: "var(--text-muted)" }}>Outliers</span>
                              <span style={{ fontFamily: "var(--font-mono)", color: col.outlier_pct > 5 ? "var(--accent-red)" : "var(--accent)" }}>{col.outlier_pct?.toFixed(1)}%</span>
                            </div>
                          )}
                        </>
                      )}
                      {col.top_values && (
                        <div style={{ marginTop: 4 }}>
                          <p style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.4px", fontFamily: "var(--font-mono)" }}>Top values</p>
                          {Object.entries(col.top_values).slice(0, 4).map(([k, v]) => (
                            <div key={k} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "var(--text-secondary)", marginBottom: 3 }}>
                              <span style={{ fontFamily: "var(--font-mono)", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "60%" }}>{k}</span>
                              <span style={{ fontFamily: "var(--font-mono)" }}>{v}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── TAB 2: Correlations ── */}
          {tab === 2 && (
            <div>
              <div style={{ background: "var(--bg-card)", border: "1px solid var(--bg-border)", borderRadius: 16, padding: 28, marginBottom: 24 }}>
                <h3 style={{ fontFamily: "var(--font-display)", fontSize: 16, fontWeight: 700, marginBottom: 20 }}>Top Correlations</h3>
                {(!report.correlations || report.correlations.length === 0) ? (
                  <p style={{ color: "var(--text-secondary)", fontSize: 14 }}>No significant correlations found.</p>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {report.correlations.slice(0, 20).map((c, i) => {
                      const abs = Math.abs(c.value);
                      const barColor = abs > 0.7 ? "var(--accent-red)" : abs > 0.4 ? "var(--accent)" : "var(--accent-blue)";
                      return (
                        <div key={i} style={{ display: "grid", gridTemplateColumns: "140px 140px 60px 1fr", gap: 12, alignItems: "center" }}>
                          <span style={{ fontSize: 13, fontFamily: "var(--font-mono)", color: "var(--text-secondary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.col1}</span>
                          <span style={{ fontSize: 13, fontFamily: "var(--font-mono)", color: "var(--text-secondary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.col2}</span>
                          <span style={{ fontSize: 13, fontFamily: "var(--font-mono)", color: barColor, textAlign: "right" }}>{c.value.toFixed(3)}</span>
                          <ProgressBar value={abs * 100} color={barColor} />
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
              <div style={{ background: "rgba(240,165,0,0.06)", border: "1px solid rgba(240,165,0,0.2)", borderRadius: 12, padding: 16, fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.6 }}>
                <strong style={{ color: "var(--accent)" }}>Interpretation:</strong> Values close to ±1 indicate strong correlation. High correlations (&gt;0.7) may cause multicollinearity issues in linear models. Consider removing one of the correlated features.
              </div>
            </div>
          )}

          {/* ── TAB 3: AI Chat ── */}
          {tab === 3 && (
            <div style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 200px)", maxHeight: 700 }}>
              <div style={{ background: "var(--bg-card)", border: "1px solid var(--bg-border)", borderRadius: "12px 12px 0 0", padding: "14px 20px", borderBottom: "1px solid var(--bg-border)" }}>
                <h3 style={{ fontFamily: "var(--font-display)", fontSize: 15, fontWeight: 700 }}>🤖 AI Assistant</h3>
                <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>Powered by RAG — grounded in this dataset&apos;s analysis report</p>
              </div>
              <div style={{ flex: 1, overflow: "auto", padding: 20, background: "var(--bg-card)", display: "flex", flexDirection: "column", gap: 16 }}>
                {messages.length === 0 && (
                  <div style={{ textAlign: "center", padding: "40px 20px" }}>
                    <div style={{ fontSize: 40, marginBottom: 12 }}>💬</div>
                    <p style={{ fontFamily: "var(--font-display)", fontSize: 16, fontWeight: 700, marginBottom: 8 }}>Ask about your dataset</p>
                    <p style={{ color: "var(--text-secondary)", fontSize: 13, marginBottom: 20 }}>Ask anything about your data quality, columns, or patterns.</p>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center" }}>
                      {["What are the main quality issues?", "Which columns have most missing data?", "Is this data suitable for classification?", "Explain the outliers found."].map(q => (
                        <button key={q} onClick={() => setChatInput(q)} style={{ padding: "6px 14px", borderRadius: 100, background: "var(--bg-secondary)", border: "1px solid var(--bg-border)", color: "var(--text-secondary)", cursor: "pointer", fontSize: 12, fontFamily: "var(--font-body)" }}>
                          {q}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {messages.map(msg => (
                  <div key={msg.id} style={{ display: "flex", justifyContent: msg.role === "user" ? "flex-end" : "flex-start" }}>
                    <div style={{ maxWidth: "80%", padding: "12px 16px", borderRadius: msg.role === "user" ? "12px 12px 2px 12px" : "12px 12px 12px 2px", background: msg.role === "user" ? "var(--accent)" : "var(--bg-secondary)", color: msg.role === "user" ? "#000" : "var(--text-primary)", fontSize: 14, lineHeight: 1.6, fontFamily: "var(--font-body)" }}>
                      {msg.content}
                      {msg.sources && msg.sources.length > 0 && (
                        <div style={{ marginTop: 8, paddingTop: 8, borderTop: "1px solid rgba(255,255,255,0.1)" }}>
                          <p style={{ fontSize: 11, color: msg.role === "user" ? "rgba(0,0,0,0.6)" : "var(--text-muted)", marginBottom: 4 }}>Sources:</p>
                          {msg.sources.map((s, i) => <p key={i} style={{ fontSize: 11, fontFamily: "var(--font-mono)", color: msg.role === "user" ? "rgba(0,0,0,0.6)" : "var(--text-muted)" }}>{s}</p>)}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                {chatLoading && (
                  <div style={{ display: "flex", gap: 6, padding: "12px 16px", background: "var(--bg-secondary)", borderRadius: 12, width: "fit-content" }}>
                    {[0,1,2].map(i => <div key={i} style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--accent)", animation: `bounce-dots 1.4s infinite ${i*0.2}s` }} />)}
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>
              <div style={{ background: "var(--bg-card)", border: "1px solid var(--bg-border)", borderRadius: "0 0 12px 12px", padding: 16, borderTop: "1px solid var(--bg-border)", display: "flex", gap: 10 }}>
                <input value={chatInput} onChange={e => setChatInput(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && !e.shiftKey && handleChat()}
                  placeholder="Ask about your dataset…"
                  style={{ flex: 1, padding: "10px 14px", borderRadius: 8, background: "var(--bg-secondary)", border: "1px solid var(--bg-border)", color: "var(--text-primary)", fontSize: 14, outline: "none", fontFamily: "var(--font-body)" }}
                  onFocus={e => e.target.style.borderColor = "var(--accent)"}
                  onBlur={e => e.target.style.borderColor = "var(--bg-border)"} />
                <button onClick={handleChat} disabled={!chatInput.trim() || chatLoading}
                  style={{ padding: "10px 20px", borderRadius: 8, background: chatInput.trim() ? "var(--accent)" : "var(--bg-border)", color: chatInput.trim() ? "#000" : "var(--text-muted)", border: "none", cursor: chatInput.trim() ? "pointer" : "not-allowed", fontSize: 14, fontWeight: 700, fontFamily: "var(--font-display)", transition: "all 0.2s" }}>
                  Send
                </button>
              </div>
            </div>
          )}

          {/* ── TAB 4: Algo Advisor ── */}
          {tab === 4 && (
            <div>
              <div style={{ marginBottom: 24 }}>
                <h2 style={{ fontFamily: "var(--font-display)", fontSize: 20, fontWeight: 800, marginBottom: 8 }}>🧪 Algorithm Recommendations</h2>
                <p style={{ color: "var(--text-secondary)", fontSize: 14 }}>Based on your dataset&apos;s shape, quality profile, and characteristics, here are the best ML algorithms to try.</p>
              </div>
              {algoLoading ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {[1,2,3].map(i => <div key={i} className="skeleton" style={{ height: 100 }} />)}
                </div>
              ) : algos.length === 0 ? (
                <div style={{ background: "var(--bg-card)", border: "1px solid var(--bg-border)", borderRadius: 12, padding: 32, textAlign: "center" }}>
                  <p style={{ color: "var(--text-secondary)", fontSize: 14 }}>
                    {algoFetched ? "No recommendations available. Make sure the backend /recommendations endpoint is implemented." : "Loading recommendations…"}
                  </p>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                  {algos.map((algo, i) => (
                    <div key={i} style={{ background: "var(--bg-card)", border: "1px solid var(--bg-border)", borderRadius: 14, padding: 24, transition: "border-color 0.2s" }}
                      onMouseEnter={e => (e.currentTarget as HTMLElement).style.borderColor = "rgba(240,165,0,0.3)"}
                      onMouseLeave={e => (e.currentTarget as HTMLElement).style.borderColor = "var(--bg-border)"}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
                        <div>
                          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
                            <h3 style={{ fontFamily: "var(--font-display)", fontSize: 17, fontWeight: 800, color: "var(--text-primary)" }}>{i === 0 ? "🥇 " : i === 1 ? "🥈 " : i === 2 ? "🥉 " : ""}{algo.name}</h3>
                            <span style={{ fontSize: 11, padding: "2px 10px", borderRadius: 100, background: "rgba(61,142,248,0.1)", color: "var(--accent-blue)", border: "1px solid rgba(61,142,248,0.2)", fontFamily: "var(--font-mono)" }}>{algo.category}</span>
                            <span style={{ fontSize: 11, padding: "2px 10px", borderRadius: 100, background: algo.complexity === "low" ? "rgba(0,208,132,0.1)" : algo.complexity === "medium" ? "rgba(240,165,0,0.1)" : "rgba(255,71,87,0.1)", color: algo.complexity === "low" ? "var(--accent-green)" : algo.complexity === "medium" ? "var(--accent)" : "var(--accent-red)", border: "1px solid transparent", fontFamily: "var(--font-mono)" }}>
                              {algo.complexity} complexity
                            </span>
                          </div>
                          <p style={{ fontSize: 14, color: "var(--text-secondary)", lineHeight: 1.5 }}>{algo.reason}</p>
                        </div>
                        <div style={{ textAlign: "center", flexShrink: 0 }}>
                          <div style={{ fontSize: 24, fontWeight: 800, fontFamily: "var(--font-display)", color: scoreColor(algo.score) }}>{algo.score}%</div>
                          <div style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>fit score</div>
                        </div>
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                        <div style={{ background: "rgba(0,208,132,0.06)", border: "1px solid rgba(0,208,132,0.15)", borderRadius: 8, padding: 12 }}>
                          <p style={{ fontSize: 11, fontWeight: 700, color: "var(--accent-green)", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.4px" }}>Pros</p>
                          {algo.pros.map((p, j) => <p key={j} style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 3 }}>+ {p}</p>)}
                        </div>
                        <div style={{ background: "rgba(255,71,87,0.06)", border: "1px solid rgba(255,71,87,0.15)", borderRadius: 8, padding: 12 }}>
                          <p style={{ fontSize: 11, fontWeight: 700, color: "var(--accent-red)", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.4px" }}>Cons</p>
                          {algo.cons.map((c, j) => <p key={j} style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 3 }}>– {c}</p>)}
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
