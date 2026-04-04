"use client";
import { useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { datasetsAPI } from "@/lib/api";
import Sidebar from "@/components/layout/sidebar";

export default function UploadPage() {
  const { token } = useAuth();
  const router = useRouter();
  const [dragging, setDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = (f: File) => {
    const ext = f.name.split(".").pop()?.toLowerCase();
    if (!["csv", "xlsx", "xls"].includes(ext || "")) {
      setError("Only CSV and Excel files (.csv, .xlsx, .xls) are supported.");
      return;
    }
    if (f.size > 50 * 1024 * 1024) {
      setError("File size must be under 50MB.");
      return;
    }
    setError("");
    setFile(f);
  };

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  }, []);

  const onDragOver = (e: React.DragEvent) => { e.preventDefault(); setDragging(true); };
  const onDragLeave = () => setDragging(false);

  const handleUpload = async () => {
    if (!file || !token) return;
    setUploading(true);
    setProgress(10);
    const interval = setInterval(() => setProgress(p => Math.min(p + 8, 85)), 600);
    const res = await datasetsAPI.upload(file, token);
    clearInterval(interval);
    setProgress(100);
    setUploading(false);
    if (res.error) { setError(res.error); setProgress(0); return; }
    router.push(`/analysis/${res.data!.id}`);
  };

  const fmtSize = (b: number) => b > 1e6 ? `${(b/1e6).toFixed(1)} MB` : `${(b/1e3).toFixed(0)} KB`;

  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      <Sidebar />
      <main style={{ flex: 1, background: "var(--bg-primary)", overflow: "auto" }}>
        <div style={{ borderBottom: "1px solid var(--bg-border)", padding: "24px 32px", background: "var(--bg-secondary)" }}>
          <h1 style={{ fontFamily: "var(--font-display)", fontSize: 24, fontWeight: 800, color: "var(--text-primary)", letterSpacing: "-0.5px", marginBottom: 4 }}>Upload Dataset</h1>
          <p style={{ color: "var(--text-secondary)", fontSize: 14 }}>Upload a CSV or Excel file to begin quality analysis.</p>
        </div>

        <div style={{ padding: 32, maxWidth: 720 }}>
          {/* Drop Zone */}
          <div
            onDrop={onDrop} onDragOver={onDragOver} onDragLeave={onDragLeave}
            onClick={() => !file && inputRef.current?.click()}
            style={{
              border: `2px dashed ${dragging ? "var(--accent)" : file ? "var(--accent-green)" : "var(--bg-border)"}`,
              borderRadius: 16, padding: "56px 32px", textAlign: "center",
              background: dragging ? "rgba(240,165,0,0.05)" : file ? "rgba(0,208,132,0.04)" : "var(--bg-card)",
              cursor: file ? "default" : "pointer", transition: "all 0.2s", marginBottom: 24,
            }}>
            <input ref={inputRef} type="file" accept=".csv,.xlsx,.xls" style={{ display: "none" }}
              onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])} />

            {file ? (
              <div>
                <div style={{ fontSize: 48, marginBottom: 12 }}>✓</div>
                <p style={{ fontFamily: "var(--font-display)", fontSize: 20, fontWeight: 700, color: "var(--accent-green)", marginBottom: 6 }}>{file.name}</p>
                <p style={{ color: "var(--text-secondary)", fontSize: 14, fontFamily: "var(--font-mono)", marginBottom: 20 }}>
                  {fmtSize(file.size)} · {file.name.split(".").pop()?.toUpperCase()}
                </p>
                <button onClick={() => setFile(null)} style={{ padding: "6px 16px", borderRadius: 6, background: "transparent", border: "1px solid var(--bg-border)", color: "var(--text-secondary)", cursor: "pointer", fontSize: 13 }}>
                  Remove file
                </button>
              </div>
            ) : (
              <div>
                <div style={{ fontSize: 48, marginBottom: 16, opacity: 0.6 }}>📂</div>
                <p style={{ fontFamily: "var(--font-display)", fontSize: 18, fontWeight: 700, marginBottom: 8, color: "var(--text-primary)" }}>
                  {dragging ? "Drop it here!" : "Drop your file here"}
                </p>
                <p style={{ color: "var(--text-secondary)", fontSize: 14, marginBottom: 16 }}>or click to browse</p>
                <p style={{ color: "var(--text-muted)", fontSize: 12, fontFamily: "var(--font-mono)" }}>CSV, XLSX, XLS · Max 50 MB</p>
              </div>
            )}
          </div>

          {error && (
            <div style={{ background: "rgba(255,71,87,0.1)", border: "1px solid rgba(255,71,87,0.3)", borderRadius: 10, padding: "12px 16px", marginBottom: 20, fontSize: 14, color: "var(--accent-red)" }}>
              {error}
            </div>
          )}

          {/* Progress */}
          {uploading && (
            <div style={{ marginBottom: 24 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>Uploading & starting analysis…</span>
                <span style={{ fontSize: 13, fontFamily: "var(--font-mono)", color: "var(--accent)" }}>{progress}%</span>
              </div>
              <div style={{ height: 4, background: "var(--bg-border)", borderRadius: 2, overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${progress}%`, background: "var(--accent)", borderRadius: 2, transition: "width 0.4s ease" }} />
              </div>
            </div>
          )}

          <button onClick={handleUpload} disabled={!file || uploading}
            style={{ padding: "13px 32px", borderRadius: 10, background: !file || uploading ? "var(--bg-border)" : "var(--accent)", color: !file || uploading ? "var(--text-muted)" : "#000", border: "none", cursor: !file || uploading ? "not-allowed" : "pointer", fontSize: 15, fontWeight: 700, fontFamily: "var(--font-display)", letterSpacing: "-0.2px", transition: "all 0.2s", width: "100%" }}>
            {uploading ? "Analyzing…" : "Start Analysis →"}
          </button>

          {/* Info */}
          <div style={{ marginTop: 32, background: "var(--bg-card)", border: "1px solid var(--bg-border)", borderRadius: 12, padding: 24 }}>
            <h3 style={{ fontFamily: "var(--font-display)", fontSize: 15, fontWeight: 700, marginBottom: 16, color: "var(--text-primary)" }}>What will be analyzed?</h3>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              {[
                "Missing values & imputation hints","Duplicate row detection",
                "Outlier identification (IQR / Z-score)","Class imbalance check",
                "Bias & fairness flags","Correlation heatmap",
                "Column distributions & statistics","Overall health score (0–100)",
              ].map(item => (
                <div key={item} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--text-secondary)" }}>
                  <span style={{ color: "var(--accent-green)", fontSize: 14 }}>✓</span>
                  {item}
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
