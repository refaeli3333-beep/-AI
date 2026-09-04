"use client";
import { useEffect, useState } from "react";
import BrainPanel from "../_components/BrainPanel";
import { card, muted, STATE_COLOR, fmt, Pill, SystemState } from "../_components/ui";

export default function RadarBrainPage() {
  const [d, setD] = useState<any>(null);
  const [q, setQ] = useState("");
  const [asked, setAsked] = useState("");

  useEffect(() => {
    fetch("/api/radar-brain").then((r) => r.json()).then(setD).catch(() => setD({ error: true }));
  }, []);

  return (
    <main style={{ maxWidth: 900, margin: "0 auto", padding: "20px 16px 80px" }} dir="rtl">
      <h1 style={{ fontSize: 22, fontWeight: 900, margin: "0 0 4px" }}>🧠 Radar Brain</h1>
      <div style={{ ...muted, marginBottom: 12 }}>חדר המחקר — סוכנים קבועים, מגבלות ממשל, זרימת חקירה וזיכרון</div>

      {!d ? <div style={card}>טוען…</div> : d.error ? <div style={{ ...card, color: "#F2555A" }}>לא ניתן לטעון את מצב המנוע.</div> : (
        <>
          <div style={{ ...card, display: "flex", gap: 14, flexWrap: "wrap", alignItems: "center" }}>
            <span style={muted}>סנכרון LIVE אחרון: <b>{fmt(d.lastLiveScan)}</b></span>
            <span style={muted}>מצב: <b>{d.mode}</b></span>
            <span style={muted}>AI: <b style={{ color: STATE_COLOR[d.ai?.state] || "#8A9BB5" }}>{d.ai?.state}</b> ({d.ai?.model})</span>
            <span style={{ fontSize: 12, color: "#35D07F" }}>SIMULATION ONLY ✓</span>
          </div>

          <div style={card}>
            <div style={{ fontWeight: 700, marginBottom: 6 }}>זרימת חקירה</div>
            <div style={{ fontSize: 12.5, color: "#38E0C4" }}>{(d.flow || []).join(" → ")}</div>
            <div style={{ ...muted, marginTop: 8 }}>סבבי דיון: {(d.debateRounds || []).join(" · ")}</div>
            <div style={{ ...muted, marginTop: 4 }}>
              מגבלות ממשל: עומק {d.limits?.maxAgentDepth} · במקביל {d.limits?.maxConcurrentAgents} ·
              סוכנים זמניים לחקירה {d.limits?.maxTemporaryAgentsPerInvestigation} · תקציב טוקנים {d.limits?.maxTokenBudget?.toLocaleString?.()}
            </div>
          </div>

          <div style={{ ...card, borderColor: "#38E0C433" }}>
            <div style={{ fontWeight: 700, marginBottom: 6 }}>מדיניות ביטחון</div>
            <div style={{ fontSize: 12.5, lineHeight: 1.6 }}>{d.confidencePolicy}</div>
          </div>

          <div style={card}>
            <div style={{ fontWeight: 700, marginBottom: 6 }}>זיכרון ולמידה</div>
            <div style={{ fontSize: 12.5, color: d.memory?.schemaReady ? "#35D07F" : "#F5B841" }}>{d.memory?.message}</div>
          </div>

          <div style={card}>
            <div style={{ fontWeight: 700, marginBottom: 8 }}>הרץ חקירה</div>
            <input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && setAsked(q.trim())}
              placeholder="נסח שאלת חקירה…"
              style={{ width: "100%", boxSizing: "border-box", background: "#0E1728", color: "#E8EEF7", border: "1px solid #1E2D44", borderRadius: 10, padding: 10 }} />
            {asked && <BrainPanel key={asked} question={asked} />}
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
              <div key={p.key} style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 12, borderTop: "1px solid #1E2D44", padding: "5px 0" }}>
                <Pill state={(p.connected ? "LIVE" : "OFFLINE") as SystemState} />
                <span style={{ flex: 1, textAlign: "right" }}>{p.label}</span>
                <span style={{ ...muted, flex: 2, textAlign: "left" }}>{p.message}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </main>
  );
}
