// App data mode. Never present demo data as live.
export type AppMode = "DEMO" | "HYBRID" | "LIVE";
export function getMode(): AppMode {
  const m = (process.env.APP_MODE || "DEMO").toUpperCase();
  return m === "LIVE" ? "LIVE" : m === "HYBRID" ? "HYBRID" : "DEMO";
}
export const MODE_LABELS: Record<AppMode, string> = {
  DEMO: "מצב הדגמה",
  HYBRID: "מצב משולב",
  LIVE: "מצב נתונים חיים",
};
