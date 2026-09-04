export type AgentKind = "permanent" | "temporary";
export interface AgentRole { id: string; name: string; focus: string; kind: AgentKind; }

/** The 22 permanent specialist roles. Agents must NOT blindly agree — see consensus.ts. */
export const PERMANENT_ROLES: AgentRole[] = [
  { id: "news", name: "News Agent", focus: "חדשות ואירועים", kind: "permanent" },
  { id: "market", name: "Market Data Agent", focus: "מחירים ונתוני שוק", kind: "permanent" },
  { id: "social", name: "X/Social Agent", focus: "פוסטים ואמירות ציבוריות", kind: "permanent" },
  { id: "sec", name: "SEC/Filings Agent", focus: "דיווחים רגולטוריים", kind: "permanent" },
  { id: "macro", name: "Macro Agent", focus: "מאקרו-כלכלה", kind: "permanent" },
  { id: "supply", name: "Supply Chain Agent", focus: "שרשרת אספקה", kind: "permanent" },
  { id: "tech", name: "Technology Agent", focus: "טכנולוגיה ורכיבים", kind: "permanent" },
  { id: "physics", name: "Physics Agent", focus: "מגבלות פיזיקליות", kind: "permanent" },
  { id: "math", name: "Mathematics Agent", focus: "מודלים כמותיים", kind: "permanent" },
  { id: "stats", name: "Statistics Agent", focus: "מובהקות וגודל מדגם", kind: "permanent" },
  { id: "risk", name: "Risk Agent", focus: "סיכונים", kind: "permanent" },
  { id: "contrarian", name: "Contrarian Agent", focus: "עמדה נגדית", kind: "permanent" },
  { id: "bull", name: "Bull Case Agent", focus: "תרחיש חיובי", kind: "permanent" },
  { id: "bear", name: "Bear Case Agent", focus: "תרחיש שלילי", kind: "permanent" },
  { id: "evidence", name: "Evidence Verification Agent", focus: "אימות ראיות", kind: "permanent" },
  { id: "source", name: "Source Reliability Agent", focus: "אמינות מקורות", kind: "permanent" },
  { id: "historical", name: "Historical Pattern Agent", focus: "תבניות היסטוריות", kind: "permanent" },
  { id: "hidden", name: "Hidden Winners Agent", focus: "מוטבים נסתרים", kind: "permanent" },
  { id: "downside", name: "Downside Agent", focus: "תרחישי הפסד", kind: "permanent" },
  { id: "catalyst", name: "Catalyst Agent", focus: "זרזים", kind: "permanent" },
  { id: "expectations", name: "Expectations Gap Agent", focus: "פער ציפיות", kind: "permanent" },
  { id: "synthesis", name: "Final Synthesis Agent", focus: "סינתזה סופית", kind: "permanent" },
];
export const roleById = (id: string) => PERMANENT_ROLES.find((r) => r.id === id) || null;
