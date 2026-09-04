"use client";
import { useState } from "react";
import { muted, Row } from "./ui";

/**
 * Runs the multi-agent investigation on one finding and shows the result honestly:
 * the vote, the evidence-based confidence with its ceilings, every dissenting agent,
 * every contradiction, and every temporary specialist the governor allowed or refused.
 * Disagreement is never collapsed into a single number.
 */
export default function BrainPanel({ question }: { question: string }) {
  const [busy, setBusy] = useState(false);
  const [inv, setInv] = useState<any>(null);

  async function investigate() {
    setBusy(true); setInv(null);
    try {
      const r = await fetch("/api/radar-brain", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ question }),
      });
      setInv(await r.json());
    } catch (e: any) { setInv({ state: "NOT_AVAILABLE", reason: e?.message || "network error" }); }
    setBusy(false);
  }

  const box: React.CSSProperties = { background: "#0E1728", border: "1px solid #1E2D44", borderRadius: 12, padding: 12, marginTop: 10 };

  return (
    <div style={{ marginTop: 14, borderTop: "1px solid #1E2D44", paddingTop: 12 }}>
      <button onClick={investigate} disabled={busy}
        style={{ padding: "10px 16px", borderRadius: 10, border: "1px solid #38E0C455",
          background: busy ? "#131F33" : "#16233A", color: busy ? "#5B6B83" : "#38E0C4",
          fontWeight: 800, fontSize: 13, cursor: busy ? "default" : "pointer" }}>
        🧠 {busy ? "חדר המחקר עובד…" : "חקירה מעמיקה (רב-סוכנית)"}
      </button>

      {inv?.state === "NOT_AVAILABLE" && (
        <div style={{ ...box, color: "#F2555A" }}>
          NOT_AVAILABLE — {inv.reason || inv.aiUnavailableReason || "שכבת ה-AI אינה זמינה"}
          <div style={{ ...muted, marginTop: 6 }}>לא הופק ניתוח מדומה במקום ניתוח אמיתי.</div>
        </div>
      )}

      {inv?.state === "LIVE" && (
        <div style={box}>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 8 }}>
            <span style={muted}>זרימה: {(inv.flow || []).join(" → ")}</span>
          </div>

          <Row label="ביטחון (ראיות)" v={`${inv.confidence?.score ?? "—"} / 100`} />
          <Row label="הסכמה בין סוכנים" v={`${inv.consensus?.consensusScore ?? "—"} / 100 · רוב: ${inv.consensus?.majorityStance ?? "—"}`} />
          <Row label="פילוח עמדות" v={`בעד ${inv.consensus?.agreement?.agree ?? 0} · נגד ${inv.consensus?.agreement?.disagree ?? 0} · לא ודאי ${inv.consensus?.agreement?.uncertain ?? 0}`} />
          <Row label="ראיות שנבדקו" v={`${inv.observationCount ?? 0} פריטים · ספקים: ${(inv.providersUsed || []).join(", ") || "—"}`} />

          {/* Confidence ceilings — why the score is capped, in plain language. */}
          {(inv.confidence?.caps || []).length > 0 && (
            <div style={{ marginTop: 8, fontSize: 12, color: "#F5B841" }}>
              {inv.confidence.caps.map((c: string) => <div key={c}>⚑ {c}</div>)}
            </div>
          )}
          <div style={{ ...muted, marginTop: 6 }}>{(inv.confidence?.notes || []).join(" ")}</div>

          {/* Dissent is always shown. */}
          <Section title={`חילוקי דעות (${(inv.consensus?.dissent || []).length})`}>
            {(inv.consensus?.dissent || []).length === 0
              ? <div style={muted}>אף סוכן לא חלק על מסקנת הרוב.</div>
              : inv.consensus.dissent.map((d: any) => (
                <div key={d.agentId} style={{ fontSize: 12.5, borderTop: "1px solid #1E2D44", padding: "6px 0" }}>
                  <b style={{ color: "#F5B841" }}>{d.agentId}</b>: {d.argument}
                </div>
              ))}
          </Section>

          <Section title={`סתירות בראיות (${(inv.contradictions || []).length})`}>
            {(inv.contradictions || []).length === 0
              ? <div style={muted}>לא נמצאו סתירות מפורשות.</div>
              : inv.contradictions.map((c: any, i: number) => (
                <div key={i} style={{ fontSize: 12.5, borderTop: "1px solid #1E2D44", padding: "6px 0" }}>{c.claimA} <span style={muted}>({c.note})</span></div>
              ))}
          </Section>

          <Section title="Bull case">{joinOr(inv.bullArguments, "אין טיעון חיובי מבוסס ראיות.")}</Section>
          <Section title="Bear case">{joinOr(inv.bearArguments, "אין טיעון שלילי מבוסס ראיות.")}</Section>
          <Section title="שאלות פתוחות / מה ישנה את המסקנה">{joinOr(inv.unresolvedQuestions, "אין שאלות פתוחות שנרשמו.")}</Section>

          <Section title={`מומחים זמניים (${(inv.temporaryAgents || []).length})`}>
            {(inv.temporaryAgents || []).length === 0
              ? <div style={muted}>לא נדרשו מומחים זמניים.</div>
              : inv.temporaryAgents.map((t: any, i: number) => (
                <div key={i} style={{ fontSize: 12.5, borderTop: "1px solid #1E2D44", padding: "6px 0" }}>
                  <b style={{ color: t.granted ? "#35D07F" : "#F5B841" }}>{t.granted ? "אושר" : `נדחה (${t.reason})`}</b> — {t.question}
                </div>
              ))}
          </Section>

          {/* Agents that could not run are named, not silently dropped from the vote. */}
          {(inv.consensus?.unavailable || []).length > 0 && (
            <Section title={`סוכנים שלא רצו (${inv.consensus.unavailable.length})`}>
              {inv.consensus.unavailable.map((u: any) => (
                <div key={u.agentId} style={{ fontSize: 12, color: "#F2555A", borderTop: "1px solid #1E2D44", padding: "5px 0" }}>{u.agentId}: {u.reason}</div>
              ))}
            </Section>
          )}

          <div style={{ ...muted, marginTop: 10 }}>
            למידה: {inv.memory?.persisted ? `נשמרה (${(inv.memory.tablesWritten || []).join(", ")})` : `לא נשמרה — ${inv.memory?.reason || "אין חיבור זיכרון"}`}
          </div>
        </div>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginTop: 10 }}>
      <div style={{ fontSize: 12.5, fontWeight: 700, marginBottom: 2 }}>{title}</div>
      {children}
    </div>
  );
}

function joinOr(list: any, fallback: string) {
  const arr = Array.isArray(list) ? list.filter(Boolean) : [];
  if (!arr.length) return <div style={muted}>{fallback}</div>;
  return <ul style={{ margin: "4px 0", paddingInlineStart: 18, fontSize: 12.5, lineHeight: 1.6 }}>
    {arr.slice(0, 6).map((a: string, i: number) => <li key={i}>{a}</li>)}
  </ul>;
}
