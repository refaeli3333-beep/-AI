"use client";
import { useState, useRef, useEffect } from "react";
import LiveWidgets from "./_demo/LiveWidgets";
import BrainPanel from "./_components/BrainPanel";
import { card, muted, STATE_COLOR, TAG_COLOR, fmt, Row, Pill, SystemState } from "./_components/ui";

const PRESETS: Record<string, string> = {
  stocks: "Scan stock market movers and company news today",
  crypto: "Scan crypto and Bitcoin news today",
  people: "Scan Elon Musk, Trump and Netanyahu last 7 days",
};

/** Everything advanced stays reachable — nothing was removed from the app. */
const ADV_LINKS: [string, string][] = [
  ["/connections", "חיבורים ומקורות"], ["/signals", "אותות"], ["/signal", "פרטי אות"],
  ["/people", "אנשים"], ["/person", "פרטי אדם"], ["/sectors", "סקטורים"],
  ["/assets", "נכסים"], ["/simulator", "סימולציית $200"], ["/history", "היסטוריה"],
  ["/radar-brain", "Radar Brain"], ["/scans", "סריקות"], ["/alerts", "התראות"],
  ["/settings", "הגדרות"], ["/about", "אודות"], ["/events", "אירועים"],
  ["/compare", "השוואה"], ["/overview", "סקירה"],
];

const listOr = (v: any, fallback = "—") => {
  const arr = Array.isArray(v) ? v.filter(Boolean) : v ? [v] : [];
  return arr.length ? arr.join(" · ") : fallback;
};

export default function Home() {
  const [command, setCommand] = useState(PRESETS.people);
  const [run, setRun] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<any>(null);
  const [showProviders, setShowProviders] = useState(false);
  const poll = useRef<any>(null);

  const loadStatus = () => fetch("/api/app-state").then((r) => r.json()).then(setStatus).catch(() => setStatus({ state: "NOT_AVAILABLE", flags: ["לא ניתן לטעון סטטוס"] }));
  useEffect(() => {
    loadStatus();
    return () => poll.current && clearInterval(poll.current);
  }, []);

  async function scan(cmd?: string) {
    const text = (cmd ?? command).trim();
    if (!text) return;
    setBusy(true); setRun(null);
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
        if (data.status === "completed" || data.status === "failed") {
          clearInterval(poll.current); setBusy(false); loadStatus();
        }
      }, 600);
    } catch (e: any) { setRun({ error: e.message }); setBusy(false); }
  }

  const top = run?.results?.[0];
  const im = top?.impact || {};
  const winners = listOr([
    ...(im.directBeneficiaries || []), ...(im.indirectBeneficiaries || []), ...(im.hiddenSuppliers || []),
    ...(top?.companies || []).filter((c: any) => c.opportunity > c.risk).map((c: any) => c.ticker),
  ]);
  const losers = listOr([
    ...(im.possibleLosers || []),
    ...(top?.companies || []).filter((c: any) => c.risk > c.opportunity).map((c: any) => c.ticker),
  ]);

  return (
    <main style={{ maxWidth: 880, margin: "0 auto", padding: "20px 16px 90px" }} dir="rtl">
      <h1 style={{ textAlign: "center", fontWeight: 900, fontSize: 26, margin: "0 0 4px", letterSpacing: 0.5 }}>
        MARKET RADAR <span style={{ color: "#38E0C4" }}>AI</span>
      </h1>
      <div style={{ ...muted, textAlign: "center", marginBottom: 12 }}>מודיעין פיננסי · SIMULATION ONLY · אין מסחר אמיתי</div>

      {/* ---------- SYSTEM STATUS ---------- */}
      <div style={{ ...card, display: "flex", gap: 14, flexWrap: "wrap", alignItems: "center", justifyContent: "center" }}>
        <span style={{ fontWeight: 900, fontSize: 15, color: STATE_COLOR[status?.state] || "#8A9BB5" }}>
          ● {status?.state || "בודק…"}
        </span>
        <span style={muted}>ספקים מחוברים: <b>{status?.connected ?? "—"}/{status?.total ?? "—"}</b></span>
        <span style={muted}>סריקה אחרונה: <b>{fmt(status?.lastSyncAt)}</b></span>
        <span style={muted}>AI: <b style={{ color: STATE_COLOR[status?.ai?.state] || "#8A9BB5" }}>{status?.ai?.state || "—"}</b></span>
        <span style={muted}>זיכרון: <b style={{ color: status?.memory?.schemaReady ? "#35D07F" : "#F5B841" }}>{status?.memory?.schemaReady ? "פעיל" : "לא מוכן"}</b></span>
        <span style={{ fontSize: 11, color: "#35D07F", fontWeight: 700 }}>SIMULATION ONLY</span>
      </div>

      {/* ---------- PROVIDER HEALTH ---------- */}
      <div style={card}>
        <button onClick={() => setShowProviders((s) => !s)}
          style={{ background: "none", border: "none", color: "#E8EEF7", fontWeight: 700, cursor: "pointer", padding: 0, fontSize: 14 }}>
          🩺 בריאות ספקים {showProviders ? "▲" : "▼"}
        </button>
        {(status?.flags || []).length > 0 && (
          <div style={{ marginTop: 8, display: "flex", gap: 6, flexWrap: "wrap" }}>
            {status.flags.map((f: string) => <span key={f} style={{ fontSize: 11, color: "#F5B841" }}>⚑ {f}</span>)}
          </div>
        )}
        {showProviders && (
          <div style={{ marginTop: 10 }}>
            {(status?.providers || []).map((p: any) => (
              <div key={p.key} style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 12, borderTop: "1px solid #1E2D44", padding: "6px 0" }}>
                <Pill state={p.state as SystemState} />
                <span style={{ flex: 1, textAlign: "right" }}>{p.label}</span>
                <span style={{ ...muted, flex: 2, textAlign: "left" }}>{p.message}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ---------- PRIMARY ACTIONS ---------- */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 10, marginBottom: 12 }}>
        {([
          ["🛰️ SCAN NOW", () => scan()],
          ["📈 STOCKS", () => { setCommand(PRESETS.stocks); scan(PRESETS.stocks); }],
          ["🪙 CRYPTO", () => { setCommand(PRESETS.crypto); scan(PRESETS.crypto); }],
          ["👥 PEOPLE & NEWS", () => { setCommand(PRESETS.people); scan(PRESETS.people); }],
        ] as [string, () => void][]).map(([label, fn]) => (
          <button key={label} onClick={fn} disabled={busy}
            style={{ padding: "20px 12px", borderRadius: 14, border: "1px solid #1E2D44",
              background: busy ? "#131F33" : "#16233A", color: busy ? "#5B6B83" : "#E8EEF7",
              fontWeight: 800, fontSize: 15, cursor: busy ? "default" : "pointer" }}>
            {label}
          </button>
        ))}
      </div>

      <input value={command} onChange={(e) => setCommand(e.target.value)} onKeyDown={(e) => e.key === "Enter" && scan()}
        placeholder="הקלד פקודת סריקה…"
        style={{ width: "100%", boxSizing: "border-box", background: "#0E1728", color: "#E8EEF7",
          border: "1px solid #1E2D44", borderRadius: 12, padding: 12, direction: "ltr", marginBottom: 12 }} />

      {busy && <div style={{ ...card, textAlign: "center", color: "#38E0C4" }}>סורק… {run?.progress || 0}% · {run?.stage || ""}</div>}
      {run?.error && <div style={{ ...card, color: "#F2555A" }}>שגיאה: {run.error}</div>}
      {run?.blocked && <div style={{ ...card, color: "#F5B841" }}>⚑ {run.blockedReason}</div>}

      {/* ---------- LATEST IMPORTANT FINDING ---------- */}
      {run?.status === "completed" && (top ? (
        <div style={{ ...card, borderColor: "#38E0C455" }}>
          <div style={{ fontSize: 12, color: "#38E0C4", fontWeight: 700, marginBottom: 4 }}>הממצא החשוב ביותר</div>
          <div style={{ fontWeight: 800, marginBottom: 8, lineHeight: 1.4 }}>{top.title}</div>

          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
            {(["news", "price", "analysis", "x"] as const).map((k) => (
              <span key={k} style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 999,
                color: TAG_COLOR[top.tags?.[k]] || "#8A9BB5", border: `1px solid ${TAG_COLOR[top.tags?.[k]] || "#8A9BB5"}66` }}>
                {k}: {top.tags?.[k] || "—"}
              </span>
            ))}
            <span style={muted}>{fmt(run.completedAt)}</span>
            {top.url && <a href={top.url} target="_blank" rel="noreferrer" style={{ fontSize: 11, color: "#38E0C4" }}>מקור ↗</a>}
          </div>

          <Row label="מה קרה" v={im.directMeaning || top.title} />
          <Row label="למה זה חשוב" v={im.economicNeed || im.hiddenMeaning} />
          <Row label="מי צפוי להרוויח" v={winners} />
          <Row label="מי צפוי להפסיד" v={losers} />
          <Row label="ציון ביטחון" v={String(top.score ?? im.confidenceScore ?? "—")} />
          <Row label="ראיות" v={(im.evidence || []).slice(0, 4).map((e: any) => e.sourceUrl || e.url).filter(Boolean).join(" · ") || top.url || "—"} />
          <Row label="סתירות" v={listOr(im.contradictions, "לא זוהו סתירות מפורשות בסריקה זו — הרץ חקירה מעמיקה לבדיקה בין-סוכנית")} />
          <Row label="Bull case" v={listOr(im.confirmationTriggers, im.economicNeed ? `ביקוש גובר: ${im.economicNeed}` : "—")} />
          <Row label="Bear case" v={listOr(im.assumptions, "ההשפעה מותנית בהנחות שטרם אומתו; ייתכן שכבר מתומחרת")} />
          <Row label="מה ישנה את המסקנה" v={listOr(im.invalidationTriggers, "הכחשה רשמית · היעדר אישור עצמאי · שינוי בתנאי השוק")} />

          {/* Deep multi-agent investigation on this finding */}
          <BrainPanel question={top.title} />
        </div>
      ) : (
        <div style={{ ...card, ...muted }}>
          לא נמצאו אירועים משמעותיים בסריקה זו.
          {run.missingKeys?.length ? ` מפתחות חסרים: ${run.missingKeys.join(", ")}` : ""}
          {(run.providerNotes || []).map((n: string) => <div key={n} style={{ marginTop: 6, color: "#F5B841" }}>⚑ {n}</div>)}
        </div>
      ))}

      {/* ---------- ADVANCED — nothing removed, everything still reachable ---------- */}
      <details style={card}>
        <summary style={{ cursor: "pointer", fontWeight: 700 }}>
          ⚙️ מתקדם (ספקים · לוגים · Backtesting · סוכנים · סביבה · Cron)
        </summary>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
          {ADV_LINKS.map(([href, label]) => (
            <a key={href} href={href} style={{ fontSize: 12.5, padding: "6px 11px", borderRadius: 8,
              background: "#16233A", border: "1px solid #1E2D44", color: "#E8EEF7", textDecoration: "none" }}>{label}</a>
          ))}
        </div>
        <LiveWidgets />
      </details>
    </main>
  );
}
