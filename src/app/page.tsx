"use client";
import { useState, useRef, useEffect } from "react";
import LiveWidgets from "./_demo/LiveWidgets";

type Tag = "LIVE" | "MOCK" | "NOT_AVAILABLE";
const tagColor = (t: Tag) => (t === "LIVE" ? "#35D07F" : t === "MOCK" ? "#F5B841" : "#F2555A");
const card: React.CSSProperties = { background: "#111C2E", border: "1px solid #1E2D44", borderRadius: 16, padding: 16, marginBottom: 12 };
const stateColor: Record<string, string> = { LIVE: "#35D07F", HYBRID: "#F5B841", DEMO: "#8A9BB5", PARTIAL: "#F5B841", OFFLINE: "#F2555A" };
const fmt = (iso?: string | null) => (iso ? new Date(iso).toLocaleString("he-IL", { dateStyle: "short", timeStyle: "short" }) : "—");

const PRESETS: Record<string, string> = {
  stocks: "Scan stock market movers and company news today",
  crypto: "Scan crypto and Bitcoin news today",
  people: "Scan Elon Musk, Trump and Netanyahu last 7 days",
};
const ADV_LINKS: [string, string][] = [
  ["/connections", "חיבורים ומקורות"], ["/signals", "אותות"], ["/people", "אנשים"], ["/sectors", "סקטורים"],
  ["/assets", "נכסים"], ["/simulator", "סימולציית $200"], ["/history", "היסטוריה"], ["/performance", "ביצועים"],
  ["/graph", "גרף קשרים"], ["/radar-brain", "Radar Brain"], ["/scans", "סריקות"], ["/alerts", "התראות"],
  ["/settings", "הגדרות"], ["/about", "אודות"], ["/events", "אירועים"], ["/compare", "השוואה"],
];

export default function Home() {
  const [command, setCommand] = useState("Scan Elon Musk, Trump and Netanyahu last 7 days");
  const [run, setRun] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<any>(null);
  const poll = useRef<any>(null);

  useEffect(() => {
    fetch("/api/app-state").then((r) => r.json()).then(setStatus).catch(() => {});
    return () => poll.current && clearInterval(poll.current);
  }, []);

  async function scan(cmd?: string) {
    const text = (cmd ?? command).trim(); if (!text) return;
    setBusy(true); setRun(null);
    try {
      const res = await fetch("/api/scan-command", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ command: text, tzOffsetMin: -new Date().getTimezoneOffset() }) });
      const start = await res.json();
      if (!res.ok) throw new Error(start.error || "scan failed");
      setRun({ ...start, status: "running", progress: 0 });
      poll.current = setInterval(async () => {
        const p = await fetch(`/api/scan-command/${start.runId}`); if (!p.ok) return;
        const data = await p.json(); setRun((prev: any) => ({ ...prev, ...data }));
        if (data.status === "completed" || data.status === "failed") { clearInterval(poll.current); setBusy(false); }
      }, 400);
    } catch (e: any) { setRun({ error: e.message }); setBusy(false); }
  }
  const top = run?.results?.[0];
  const im = top?.impact || {};

  return (
    <main style={{ maxWidth: 860, margin: "0 auto", padding: "20px 16px 90px" }} dir="rtl">
      <div style={{ textAlign: "center", fontWeight: 900, fontSize: 24, marginBottom: 8 }}>Market Radar <span style={{ color: "#38E0C4" }}>AI</span></div>

      {/* STATUS BAR */}
      <div style={{ ...card, display: "flex", gap: 14, flexWrap: "wrap", alignItems: "center", justifyContent: "center" }}>
        <span style={{ fontWeight: 900, color: stateColor[status?.state] || "#8A9BB5" }}>● {status?.state || "…"}</span>
        <span style={{ fontSize: 12, color: "#8A9BB5" }}>ספקים: {status?.connected ?? "—"}/{status?.total ?? "—"}</span>
        <span style={{ fontSize: 12, color: "#8A9BB5" }}>סריקה אחרונה: {fmt(status?.lastSyncAt)}</span>
        {status?.flags?.map((f: string) => <span key={f} style={{ fontSize: 11, color: "#F5B841" }}>⚑ {f}</span>)}
        <span style={{ fontSize: 11, color: "#35D07F" }}>SIMULATION ONLY</span>
      </div>

      {/* 4 PRIMARY BUTTONS */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 10, marginBottom: 12 }}>
        {[["🛰️ Scan Now", () => scan()], ["📈 Stocks", () => { setCommand(PRESETS.stocks); scan(PRESETS.stocks); }],
          ["🪙 Crypto", () => { setCommand(PRESETS.crypto); scan(PRESETS.crypto); }], ["👥 People & News", () => { setCommand(PRESETS.people); scan(PRESETS.people); }],
        ].map(([label, fn]: any) => (
          <button key={label} onClick={fn} disabled={busy}
            style={{ padding: "20px 12px", borderRadius: 14, border: "none", background: busy ? "#1E2D44" : "#16233A", color: "#E8EEF7", fontWeight: 800, fontSize: 16, cursor: busy ? "default" : "pointer" }}>
            {label}
          </button>
        ))}
      </div>

      <input value={command} onChange={(e) => setCommand(e.target.value)} onKeyDown={(e) => e.key === "Enter" && scan()}
        placeholder="הקלד פקודת סריקה…" style={{ width: "100%", boxSizing: "border-box", background: "#0E1728", color: "#E8EEF7", border: "1px solid #1E2D44", borderRadius: 12, padding: 12, direction: "ltr", marginBottom: 12 }} />

      {busy && <div style={{ ...card, textAlign: "center", color: "#38E0C4" }}>סורק… {run?.progress || 0}%</div>}
      {run?.error && <div style={{ ...card, color: "#F2555A" }}>שגיאה: {run.error}</div>}

      {/* MAIN RESULT CARD */}
      {run?.status === "completed" && (
        top ? (
          <div style={{ ...card, borderColor: "#38E0C455" }}>
            <div style={{ fontWeight: 800, marginBottom: 8 }}>{top.title}</div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
              {(["news", "price", "analysis", "x"] as const).map((k) => (
                <span key={k} style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 999, color: tagColor(top.tags[k]), border: `1px solid ${tagColor(top.tags[k])}66` }}>{k}: {top.tags[k]}</span>
              ))}
              <span style={{ fontSize: 11, color: "#8A9BB5" }}>{fmt(run.completedAt)}</span>
            </div>
            <Row label="מה קרה" v={im.directMeaning || top.title} />
            <Row label="למה זה חשוב" v={im.economicNeed} />
            <Row label="מי מרוויח" v={(top.companies || []).filter((c: any) => c.opportunity > c.risk).map((c: any) => c.ticker).join(", ")} />
            <Row label="מי מפסיד" v={(top.companies || []).filter((c: any) => c.risk > c.opportunity).map((c: any) => c.ticker).join(", ") || "—"} />
            <Row label="השפעת שוק" v={im.hiddenMeaning} />
            <Row label="ציון ביטחון" v={String(top.score ?? im.confidenceScore ?? "—")} />
            <Row label="Bull case" v={im.bullCase || (im.economicNeed ? `ביקוש גובר: ${im.economicNeed}` : "—")} />
            <Row label="Bear case" v={im.bearCase || "התממשות ההשפעה אינה ודאית; ייתכן שכבר מתומחר"} />
            <Row label="ראיות" v={(im.evidence || []).slice(0, 3).map((e: any) => e.sourceUrl || e.url).filter(Boolean).join(" · ") || "—"} />
            <Row label="סתירות" v={im.contradictions || "לא זוהו סתירות מפורשות"} />
            <Row label="מה ישנה את המסקנה" v={(im.invalidationConditions || ["הכחשה רשמית", "היעדר אישור עצמאי"]).join(" · ")} />
          </div>
        ) : (
          <div style={{ ...card, color: "#8A9BB5" }}>לא נמצאו אירועים משמעותיים. {run.missingKeys?.length ? `מפתחות חסרים: ${run.missingKeys.join(", ")}` : ""}</div>
        )
      )}

      {/* ADVANCED — nothing removed, everything still reachable */}
      <details style={{ ...card }}>
        <summary style={{ cursor: "pointer", fontWeight: 700 }}>⚙️ מתקדם (Providers · Logs · Backtesting · Agents · Audit · Env · Cron)</summary>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
          {ADV_LINKS.map(([href, label]) => (
            <a key={href} href={href} style={{ fontSize: 12.5, padding: "6px 11px", borderRadius: 8, background: "#16233A", border: "1px solid #1E2D44", color: "#E8EEF7", textDecoration: "none" }}>{label}</a>
          ))}
        </div>
        <LiveWidgets />
      </details>
    </main>
  );
}
function Row({ label, v }: { label: string; v?: string }) {
  return (
    <div style={{ display: "flex", gap: 8, borderTop: "1px solid #1E2D44", padding: "7px 0", fontSize: 13 }}>
      <span style={{ minWidth: 130, color: "#8A9BB5" }}>{label}</span>
      <span style={{ flex: 1 }}>{v || "—"}</span>
    </div>
  );
}
