"use client";
import { useState, useRef, useEffect } from "react";

type Tag = "LIVE" | "MOCK" | "NOT_AVAILABLE";
const tagColor = (t: Tag) => (t === "LIVE" ? "#35D07F" : t === "MOCK" ? "#F5B841" : "#F2555A");
const card: React.CSSProperties = { background: "#111C2E", border: "1px solid #1E2D44", borderRadius: 16, padding: 16, marginBottom: 12 };
const chip: React.CSSProperties = { fontSize: 12, padding: "4px 10px", borderRadius: 999, background: "#16233A", border: "1px solid #1E2D44", cursor: "pointer" };
const STAGES = ["מפרש את הפקודה", "מחפש ציוצים ומקורות", "מסיר כפילויות", "בודק אמינות", "מנתח משמעות", "מזהה סקטורים", "מזהה חברות", "בודק מחירי שוק", "מחשב תוצאות", "מסיים"];
const EXAMPLES = ["Scan Elon Musk last 7 days", "Analyze Trump today", "Scan Netanyahu this month", "Analyze NVIDIA"];

// AI Investigation Dashboard — command bar wired to the REAL internal API:
//   POST /api/scan-command → runId, then poll GET /api/scan-command/:runId
export default function Dashboard() {
  const [command, setCommand] = useState("Scan Elon Musk, Trump and Netanyahu last 7 days");
  const [run, setRun] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [envStatus, setEnvStatus] = useState<any>(null);
  const poll = useRef<any>(null);

  useEffect(() => {
    fetch("/api/env-status").then((r) => r.json()).then(setEnvStatus).catch(() => {});
    return () => poll.current && clearInterval(poll.current);
  }, []);

  async function runScan(cmd?: string) {
    const text = (cmd ?? command).trim(); if (!text) return;
    setError(null); setBusy(true); setRun(null);
    try {
      const res = await fetch("/api/scan-command", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ command: text, tzOffsetMin: -new Date().getTimezoneOffset() }),
      });
      const start = await res.json();
      if (!res.ok) throw new Error(start.error || "scan failed");
      setRun({ ...start, status: "running", progress: 0 });
      poll.current = setInterval(async () => {
        const p = await fetch(`/api/scan-command/${start.runId}`);
        if (!p.ok) return;
        const data = await p.json();
        setRun((prev: any) => ({ ...prev, ...data }));
        if (data.status === "completed" || data.status === "failed") { clearInterval(poll.current); setBusy(false); }
      }, 400);
    } catch (e: any) { setError(e.message); setBusy(false); }
  }

  const stageIdx = run ? STAGES.indexOf(run.stage) : -1;
  const blocked = run?.blocked;

  return (
    <main style={{ maxWidth: 940, margin: "0 auto", padding: "20px 16px 90px" }}>
      <div style={{ textAlign: "center", marginBottom: 4 }}>
        <span style={{ fontWeight: 900, fontSize: 22 }}>AI Investigation <span style={{ color: "#38E0C4" }}>Dashboard</span></span>
      </div>
      <div style={{ textAlign: "center", fontSize: 12, color: "#F5B841", marginBottom: 16 }}>
        SIMULATION ONLY · לא מסחר אמיתי · מקורות מסומנים LIVE / MOCK / NOT AVAILABLE
      </div>

      {/* command bar */}
      <div style={card}>
        <input value={command} onChange={(e) => setCommand(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") runScan(); }}
          placeholder="Type a command, e.g. Scan Elon Musk last 7 days"
          style={{ width: "100%", boxSizing: "border-box", background: "#0E1728", color: "#E8EEF7", border: "1px solid #1E2D44", borderRadius: 12, padding: 14, fontSize: 15, direction: "ltr" }} />
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10, alignItems: "center" }}>
          <button onClick={() => runScan()} disabled={busy}
            style={{ padding: "9px 18px", borderRadius: 10, border: "none", background: busy ? "#1E2D44" : "#38E0C4", color: "#06121f", fontWeight: 800, cursor: busy ? "default" : "pointer" }}>
            {busy ? "Scanning…" : "Scan"}
          </button>
          {EXAMPLES.map((ex) => <span key={ex} style={chip} onClick={() => { setCommand(ex); runScan(ex); }}>{ex}</span>)}
        </div>
      </div>

      {/* mode + missing keys banner */}
      {envStatus && (
        <div style={{ ...card, borderColor: envStatus.missingKeys?.length ? "#F5B84155" : "#35D07F55" }}>
          <div style={{ fontSize: 13 }}>מצב נוכחי: <b>{envStatus.mode}</b> · Supabase: {envStatus.supabaseConfigured ? "מחובר" : "לא מחובר"}</div>
          {envStatus.missingKeys?.length > 0 && (
            <div style={{ fontSize: 12.5, color: "#F5B841", marginTop: 6 }}>
              מפתחות חסרים: {envStatus.missingKeys.join(", ")}
            </div>
          )}
        </div>
      )}

      {error && <div style={{ ...card, borderColor: "#F2555A55", color: "#F2555A" }}>שגיאה: {error}</div>}

      {/* live per-source progress */}
      {run && (
        <div style={card}>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>מצב הסריקה · POST /api/scan-command · {run.mode}</div>
          <div style={{ height: 8, background: "#1E2D44", borderRadius: 8, overflow: "hidden", marginBottom: 10 }}>
            <div style={{ width: `${run.progress || 0}%`, height: "100%", background: "#38E0C4", transition: "width .3s" }} />
          </div>
          <div style={{ display: "grid", gap: 3 }}>
            {STAGES.map((s, i) => (
              <div key={s} style={{ fontSize: 11.5, color: stageIdx > i ? "#35D07F" : stageIdx === i ? "#38E0C4" : "#5B6b83" }}>
                {stageIdx > i ? "✓" : stageIdx === i ? "▸" : "○"} {s}
              </div>
            ))}
          </div>
          {run.providersUsed?.length > 0 && <div style={{ fontSize: 11.5, color: "#8A9BB5", marginTop: 8 }}>מקורות: {run.providersUsed.join(", ")}</div>}
          {run.providerNotes?.map((n: string, i: number) => <div key={i} style={{ fontSize: 11.5, color: "#8A9BB5", marginTop: 4 }}>• {n}</div>)}
        </div>
      )}

      {/* LIVE blocked → show missing keys, no demo data */}
      {blocked && (
        <div style={{ ...card, borderColor: "#F2555A66" }}>
          <div style={{ fontWeight: 800, color: "#F2555A", marginBottom: 8 }}>הסריקה נעצרה (מצב LIVE)</div>
          <div style={{ fontSize: 13, marginBottom: 8 }}>{run.blockedReason}</div>
          <div style={{ fontSize: 12.5, color: "#F5B841" }}>מפתחות חסרים: {(run.missingKeys || []).join(", ") || "—"}</div>
        </div>
      )}

      {/* results */}
      {run?.status === "completed" && !blocked && (
        <div style={card}>
          <div style={{ fontWeight: 700, marginBottom: 4 }}>
            אירועים שנמצאו: {run.resultCount} · אותות: {run.signalCount} · נדחו: {run.rejectedCount}
          </div>
          {(run.results || []).length === 0 && <div style={{ color: "#8A9BB5", fontSize: 13 }}>לא נמצאו אירועים משמעותיים.</div>}
          {(run.results || []).map((r: any, i: number) => <EventResult key={i} r={r} />)}
        </div>
      )}
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginTop: 10 }}>
      <div style={{ fontSize: 12, color: "#8A9BB5", marginBottom: 4 }}>{title}</div>
      {children}
    </div>
  );
}

function EventResult({ r }: { r: any }) {
  const im = r.impact || {};
  const chainCompanies = im.valueChain?.companies || (r.companies || []).map((c: any) => c.ticker);
  return (
    <div style={{ borderTop: "1px solid #1E2D44", paddingTop: 12, marginTop: 12 }}>
      {/* event */}
      <div style={{ fontWeight: 800 }}>{r.personName} · ציון {r.score ?? "—"}</div>
      <a href={r.url} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: "#38E0C4", wordBreak: "break-all" }}>{r.title || r.url}</a>

      {/* source tags */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", margin: "8px 0" }}>
        {(["news", "price", "analysis", "x"] as const).map((k) => (
          <span key={k} style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 999, color: tagColor(r.tags[k]), border: `1px solid ${tagColor(r.tags[k])}66` }}>{k}: {r.tags[k]}</span>
        ))}
        <span style={{ fontSize: 11, color: "#8A9BB5" }}>שלמות נתונים {r.dataCompleteness}%</span>
        {im.confidenceScore != null && <span style={{ fontSize: 11, color: "#8A9BB5" }}>ביטחון {im.confidenceScore}%</span>}
      </div>

      {/* interpretation + economic meaning */}
      {(im.directMeaning || im.hiddenMeaning) && (
        <Section title="פירוש האירוע">
          <div style={{ fontSize: 13 }}>{im.directMeaning}</div>
          {im.hiddenMeaning && <div style={{ fontSize: 12.5, color: "#8A9BB5", marginTop: 2 }}>{im.hiddenMeaning}</div>}
          {im.possibleIntent && <div style={{ fontSize: 12, color: "#8A9BB5", marginTop: 2 }}>{im.possibleIntent}</div>}
        </Section>
      )}
      {im.economicNeed && <Section title="המשמעות הכלכלית"><div style={{ fontSize: 13 }}>{im.economicNeed}</div></Section>}

      {/* affected companies */}
      <Section title="חברות שעשויות להיות מושפעות">
        <div style={{ display: "grid", gap: 6 }}>
          {(r.companies || []).map((c: any, j: number) => (
            <div key={j} style={{ fontSize: 12.5, background: "#16233A", border: "1px solid #1E2D44", borderRadius: 8, padding: "6px 10px" }}>
              <b>{c.ticker}</b> · {c.role}{c.hidden ? " (ספקית נסתרת)" : ""} · הזדמנות {c.opportunity} · סיכון {c.risk} · ביטחון {c.confidence}
            </div>
          ))}
        </div>
      </Section>

      {/* direct + indirect suppliers */}
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        {im.directBeneficiaries?.length > 0 && <Section title="נהנים ישירים"><div style={{ fontSize: 12.5 }}>{im.directBeneficiaries.join(", ")}</div></Section>}
        {im.hiddenSuppliers?.length > 0 && <Section title="ספקים (ישירים/עקיפים/נסתרים)"><div style={{ fontSize: 12.5 }}>{im.hiddenSuppliers.join(", ")}</div></Section>}
        {im.indirectBeneficiaries?.length > 0 && <Section title="נהנים עקיפים"><div style={{ fontSize: 12.5 }}>{im.indirectBeneficiaries.join(", ")}</div></Section>}
        {im.possibleLosers?.length > 0 && <Section title="עלולים להיפגע"><div style={{ fontSize: 12.5 }}>{im.possibleLosers.join(", ")}</div></Section>}
      </div>

      {/* full supply chain */}
      {im.valueChain && (
        <Section title="שרשרת אספקה מלאה">
          <div style={{ fontSize: 12, color: "#B9C6DA", lineHeight: 1.9 }}>
            אירוע → <b>{im.economicNeed}</b> → טכנולוגיות: {(im.requiredTechnologies || []).slice(0, 5).join(", ")} → רכיבים: {(im.requiredComponents || []).slice(0, 5).join(", ")} → חברות: {chainCompanies.join(", ")}
          </div>
        </Section>
      )}

      {/* evidence per conclusion */}
      {im.evidence?.length > 0 && (
        <Section title="ראיות">
          <div style={{ display: "grid", gap: 4 }}>
            {im.evidence.slice(0, 6).map((e: any, j: number) => (
              <a key={j} href={e.sourceUrl} target="_blank" rel="noreferrer" style={{ fontSize: 11.5, color: "#38E0C4", wordBreak: "break-all" }}>
                • [{e.sourceType}] {e.extractedFact} — {e.sourceUrl}
              </a>
            ))}
          </div>
        </Section>
      )}
    </div>
  );
}
