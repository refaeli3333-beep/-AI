"use client";
import { useEffect, useState } from "react";
const card: React.CSSProperties = { background: "#111C2E", border: "1px solid #1E2D44", borderRadius: 14, padding: 14, marginBottom: 12 };
const fmt = (iso?: string | null) => (iso ? new Date(iso).toLocaleString("he-IL", { dateStyle: "short", timeStyle: "short" }) : "—");

export default function RadarBrainPage() {
  const [d, setD] = useState<any>(null);
  useEffect(() => { fetch("/api/radar-brain").then((r) => r.json()).then(setD).catch(() => setD({ error: true })); }, []);
  return (
    <main style={{ maxWidth: 900, margin: "0 auto", padding: "20px 16px 80px" }} dir="rtl">
      <h1 style={{ fontSize: 22, fontWeight: 900, margin: "0 0 4px" }}>🧠 Radar Brain</h1>
      <div style={{ fontSize: 12, color: "#8A9BB5", marginBottom: 12 }}>מצב מנוע המחקר הרציף — סוכנים, מגבלות, חקירות פעילות</div>
      {!d ? <div style={card}>טוען…</div> : (
        <>
          <div style={{ ...card, display: "flex", gap: 14, flexWrap: "wrap" }}>
            <span style={{ fontSize: 12 }}>סנכרון LIVE אחרון: <b>{fmt(d.lastLiveScan)}</b></span>
            <span style={{ fontSize: 12, color: "#35D07F" }}>SIMULATION ONLY ✓</span>
            <span style={{ fontSize: 12, color: "#8A9BB5" }}>מגבלות: עומק {d.limits?.maxAgentDepth} · במקביל {d.limits?.maxConcurrentAgents} · זמניים לחקירה {d.limits?.maxTemporaryAgentsPerInvestigation}</span>
          </div>
          <div style={card}>
            <div style={{ fontWeight: 700, marginBottom: 6 }}>חקירות פעילות</div>
            {(d.activeInvestigations || []).length === 0 ? <div style={{ fontSize: 12.5, color: "#8A9BB5" }}>אין חקירות פעילות כרגע.</div> : null}
          </div>
          <div style={card}>
            <div style={{ fontWeight: 700, marginBottom: 6 }}>סוכנים קבועים ({(d.permanentAgents || []).length})</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(200px,1fr))", gap: 6 }}>
              {(d.permanentAgents || []).map((a: any) => (
                <div key={a.id} style={{ fontSize: 12, background: "#16233A", border: "1px solid #1E2D44", borderRadius: 8, padding: "6px 9px" }}>
                  <b>{a.name}</b><div style={{ color: "#8A9BB5", fontSize: 11 }}>{a.focus}</div>
                </div>
              ))}
            </div>
          </div>
          <div style={card}>
            <div style={{ fontWeight: 700, marginBottom: 6 }}>סטטוס ספקים</div>
            {(d.providerStatus || []).map((p: any) => (
              <div key={p.key} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, borderTop: "1px solid #1E2D44", padding: "5px 0" }}>
                <span style={{ color: p.connected ? "#35D07F" : "#F2555A" }}>{p.connected ? "● CONNECTED" : "○ OFFLINE"}</span>
                <span>{p.label}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </main>
  );
}
