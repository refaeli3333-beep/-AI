"use client";
import { useEffect, useState } from "react";

const card: React.CSSProperties = { background: "#111C2E", border: "1px solid #1E2D44", borderRadius: 14, padding: 14, marginBottom: 12 };
const stateColor: Record<string, string> = { LIVE: "#35D07F", PARTIAL: "#F5B841", OFFLINE: "#F2555A" };
const fmt = (iso?: string | null) => (iso ? new Date(iso).toLocaleString("he-IL", { dateStyle: "short", timeStyle: "short" }) : "—");

export default function LiveWidgets() {
  const [d, setD] = useState<any>(null);
  useEffect(() => {
    const load = () => fetch("/api/dashboard/live").then((r) => r.json()).then(setD).catch(() => {});
    load();
    const t = setInterval(load, 30000);          // safe auto-refresh every 30s
    return () => clearInterval(t);
  }, []);
  if (!d) return null;

  const SignalRow = (s: any) => (
    <a key={s.id} href={`/signals/${s.id}`} style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, borderTop: "1px solid #1E2D44", padding: "6px 0", color: "#E8EEF7", textDecoration: "none" }}>
      <span><b>{s.ticker}</b> · {s.direction}</span>
      <span style={{ color: "#8A9BB5" }}>הזד׳ {s.opportunity_score} · סיכון {s.risk_score} · ביטחון {s.confidence_score}</span>
    </a>
  );

  return (
    <section dir="rtl" style={{ marginTop: 20 }}>
      <div style={{ ...card, display: "flex", gap: 16, flexWrap: "wrap", alignItems: "center" }}>
        <span style={{ fontWeight: 900, color: stateColor[d.appState?.state] || "#8A9BB5" }}>● {d.appState?.state || "—"}</span>
        <span style={{ fontSize: 12.5, color: "#8A9BB5" }}>ספקים מחוברים: {d.connectedProviders}/{d.totalProviders}</span>
        <span style={{ fontSize: 12.5, color: "#8A9BB5" }}>סנכרון אחרון: {fmt(d.lastSyncAt)}</span>
        {d.appState?.flags?.map((f: string) => <span key={f} style={{ fontSize: 11, color: "#F5B841" }}>⚑ {f}</span>)}
      </div>

      {!d.configured && <div style={{ ...card, color: "#8A9BB5", fontSize: 12.5 }}>מסד הנתונים אינו מחובר — הרדאר החי יתמלא לאחר חיבור Supabase והרצת סריקה. (לא מוצגים נתונים מדומים.)</div>}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))", gap: 12 }}>
        <Widget title="📡 Live Radar — אירועים אחרונים">
          {(d.liveRadar || []).length === 0 ? <Empty /> : d.liveRadar.map((e: any) => (
            <a key={e.id} href={`/events/${e.id}`} style={{ display: "block", fontSize: 12.5, borderTop: "1px solid #1E2D44", padding: "6px 0", color: "#E8EEF7", textDecoration: "none" }}>
              {e.title_he} <span style={{ color: "#8A9BB5" }}>· {fmt(e.created_at)}</span>
            </a>
          ))}
        </Widget>
        <Widget title="🔴 Breaking Events">
          {(d.breaking || []).length === 0 ? <Empty /> : d.breaking.map((e: any) => (
            <a key={e.id} href={`/events/${e.id}`} style={{ display: "block", fontSize: 12.5, borderTop: "1px solid #1E2D44", padding: "6px 0", color: "#E8EEF7", textDecoration: "none" }}>{e.title_he} <span style={{ color: "#8A9BB5" }}>· ביטחון {e.confidence_score}</span></a>
          ))}
        </Widget>
        <Widget title="🟢 מוטבים אפשריים">{(d.beneficiaries || []).length === 0 ? <Empty /> : d.beneficiaries.map(SignalRow)}</Widget>
        <Widget title="🔻 השפעה שלילית אפשרית">{(d.negatives || []).length === 0 ? <Empty /> : d.negatives.map(SignalRow)}</Widget>
        <Widget title="📈 אותות אחרונים">{(d.latestSignals || []).length === 0 ? <Empty /> : d.latestSignals.map(SignalRow)}</Widget>
        <Widget title="👥 אנשים במעקב">
          {(d.monitoredPeople || []).length === 0 ? <Empty /> : d.monitoredPeople.map((p: string, i: number) => <div key={i} style={{ fontSize: 12.5, borderTop: "1px solid #1E2D44", padding: "5px 0" }}>{p}</div>)}
        </Widget>
        <Widget title="🩺 בריאות ספקים">
          {(d.providerHealth || []).slice(0, 8).map((p: any) => (
            <div key={p.key} style={{ display: "flex", justifyContent: "space-between", fontSize: 11.5, borderTop: "1px solid #1E2D44", padding: "5px 0" }}>
              <span style={{ color: p.connected ? "#35D07F" : "#F2555A" }}>{p.connected ? "●" : "○"} {p.label}</span>
              <span style={{ color: "#8A9BB5" }}>בק׳ {p.requests} · שג׳ {p.errors}{p.rateLimited ? " · RL" : ""}</span>
            </div>
          ))}
        </Widget>
      </div>
    </section>
  );
}
function Widget({ title, children }: { title: string; children: React.ReactNode }) {
  return <div style={card}><div style={{ fontWeight: 700, marginBottom: 4, fontSize: 13 }}>{title}</div>{children}</div>;
}
function Empty() { return <div style={{ fontSize: 12, color: "#8A9BB5", paddingTop: 6 }}>אין נתונים עדיין.</div>; }
