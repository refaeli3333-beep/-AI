"use client";
import React from "react";

/** Shared visual language for the simplified screens. */
export type SystemState = "LIVE" | "HYBRID" | "MOCK" | "NOT_AVAILABLE" | "OFFLINE" | "PARTIAL" | "DEMO";

export const card: React.CSSProperties = {
  background: "#111C2E", border: "1px solid #1E2D44", borderRadius: 16, padding: 16, marginBottom: 12,
};
export const muted: React.CSSProperties = { fontSize: 12, color: "#8A9BB5" };

export const STATE_COLOR: Record<string, string> = {
  LIVE: "#35D07F", HYBRID: "#F5B841", PARTIAL: "#F5B841",
  MOCK: "#F5B841", DEMO: "#8A9BB5", OFFLINE: "#F2555A", NOT_AVAILABLE: "#F2555A",
};

/** LIVE / MOCK / NOT_AVAILABLE as used on per-result source tags. */
export const TAG_COLOR: Record<string, string> = {
  LIVE: "#35D07F", MOCK: "#F5B841", NOT_AVAILABLE: "#F2555A", OFFLINE: "#F2555A",
};

export const fmt = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleString("he-IL", { dateStyle: "short", timeStyle: "short" }) : "—";

export function Pill({ state }: { state: SystemState }) {
  const color = STATE_COLOR[state] || "#8A9BB5";
  return (
    <span style={{ fontSize: 10.5, fontWeight: 800, padding: "2px 8px", borderRadius: 999,
      color, border: `1px solid ${color}66`, whiteSpace: "nowrap" }}>
      {state}
    </span>
  );
}

export function Row({ label, v }: { label: string; v?: string | null }) {
  return (
    <div style={{ display: "flex", gap: 10, borderTop: "1px solid #1E2D44", padding: "8px 0", fontSize: 13, alignItems: "flex-start" }}>
      <span style={{ minWidth: 130, color: "#8A9BB5", flexShrink: 0 }}>{label}</span>
      <span style={{ flex: 1, lineHeight: 1.5, wordBreak: "break-word" }}>{v || "—"}</span>
    </div>
  );
}
