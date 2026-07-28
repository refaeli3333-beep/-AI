// NaturalLanguageScanCommandEngine — parses free Hebrew commands into a structured
// scan command. Pure & deterministic (no network): rule/keyword based, timezone-aware.
export interface DateRange { from: string; to: string; fromLabel: string; toLabel: string }
export interface ScanCommand {
  action: "scan";
  commandType: "scan_people" | "analyze_company"; // Scan <person> ... | Analyze <company/ticker>
  company?: string;              // resolved ticker when analyzing a company
  people: string[];              // resolved display names / aliases found in text
  peopleQuery: string[];         // raw name fragments to match against the DB
  sourceTypes: string[];         // x_posts | official_statements | news | ...
  dateRange: DateRange;
  topics: string[];              // canonical: ai | defense | energy | crypto | datacenter
  includeMarketImpact: boolean;
  includeInvestigation: boolean;
  includeBeneficiaryCompanies: boolean;
  onlyMovedStocks?: boolean;     // "יצרו תנועה בשוק"
  onlyNotReacted?: boolean;      // "עדיין לא הגיבו"
  limit: number;
  raw: string;
}

// known people + aliases (mirrors DB; matching is by substring on either language)
const PEOPLE_ALIASES: { canonical: string; match: string[] }[] = [
  { canonical: "Elon Musk", match: ["elon", "musk", "מאסק", "אילון"] },
  { canonical: "Donald Trump", match: ["trump", "טראמפ", "דונלד"] },
  { canonical: "Benjamin Netanyahu", match: ["netanyahu", "נתניהו", "ביבי", "בנימין"] },
  { canonical: "Jensen Huang", match: ["jensen", "huang", "nvidia", "אנבידיה", "nvidia ceo"] },
  { canonical: "Tim Cook", match: ["tim cook", "קוק", "apple ceo", "אפל"] },
  { canonical: "Sam Altman", match: ["altman", "אלטמן", "openai"] },
  { canonical: "Jerome Powell", match: ["powell", "פאוול", "fed", "הפד"] },
];

// known companies / tickers for "Analyze <company>" commands
const COMPANY_ALIASES: { ticker: string; match: string[] }[] = [
  { ticker: "NVDA", match: ["nvidia", "אנבידיה", "nvda"] },
  { ticker: "AMD", match: ["amd"] },
  { ticker: "AAPL", match: ["apple", "אפל", "aapl"] },
  { ticker: "MSFT", match: ["microsoft", "מיקרוסופט", "msft"] },
  { ticker: "TSLA", match: ["tesla", "טסלה", "tsla"] },
  { ticker: "LMT", match: ["lockheed", "lmt"] },
  { ticker: "XOM", match: ["exxon", "xom"] },
  { ticker: "COIN", match: ["coinbase", "coin"] },
];
function resolveCompany(text: string): string | undefined {
  const t = text.toLowerCase();
  for (const c of COMPANY_ALIASES) if (c.match.some((m) => t.includes(m))) return c.ticker;
  return undefined;
}

const TOPIC_KEYWORDS: Record<string, string[]> = {
  ai: ["ai", "בינה מלאכותית", "בינה", "artificial intelligence"],
  datacenter: ["מרכזי נתונים", "data center", "ענן", "cloud"],
  defense: ["ביטחון", "בטחון", "defense", "צבא", "מלחמה", "טילים"],
  energy: ["אנרגיה", "נפט", "גז", "energy", "oil", "חשמל"],
  crypto: ["קריפטו", "ביטקוין", "crypto", "bitcoin", "מטבע"],
};
// "chips" maps into ai chain but we keep a topic alias too
const CHIP_WORDS = ["שבב", "שבבים", "chip", "semiconductor"];

function resolvePeople(text: string): { people: string[]; peopleQuery: string[] } {
  const t = text.toLowerCase();
  const people: string[] = []; const peopleQuery: string[] = [];
  for (const p of PEOPLE_ALIASES) {
    const hit = p.match.find((m) => t.includes(m));
    if (hit) { people.push(p.canonical); peopleQuery.push(hit); }
  }
  return { people, peopleQuery };
}

function resolveTopics(text: string): string[] {
  const t = text.toLowerCase(); const topics = new Set<string>();
  for (const [topic, kws] of Object.entries(TOPIC_KEYWORDS)) if (kws.some((k) => t.includes(k))) topics.add(topic);
  if (CHIP_WORDS.some((k) => t.includes(k))) topics.add("ai");
  return [...topics];
}

function resolveSourceTypes(text: string): string[] {
  const t = text.toLowerCase(); const src = new Set<string>();
  if (/ציוץ|ציוצים|טוויט|tweet|tweets|פוסט|post|x /.test(t)) src.add("x_posts");
  if (/נאום|הודעה רשמית|הצהרה|official|statement|speech/.test(t)) src.add("official_statements");
  if (/חדשות|כתבה|דיווח|news|article/.test(t)) src.add("news");
  if (src.size === 0) { src.add("x_posts"); src.add("official_statements"); src.add("news"); }
  return [...src];
}

// Resolve a natural Hebrew time phrase to an absolute UTC range, using the user's tz offset
// (minutes east of UTC). Stored/returned as UTC ISO. Never invents a time.
export function resolveDateRange(text: string, now = new Date(), tzOffsetMin = 0): DateRange {
  const t = text.toLowerCase();
  const toUtc = (d: Date) => d.toISOString();
  const local = new Date(now.getTime() + tzOffsetMin * 60000);
  const startOfLocalDay = () => { const d = new Date(local); d.setUTCHours(0, 0, 0, 0); return new Date(d.getTime() - tzOffsetMin * 60000); };
  const minus = (ms: number) => new Date(now.getTime() - ms);
  const DAY = 86400000;
  let from = minus(DAY), fromLabel = "24 שעות אחרונות";

  if (/היום|מהבוקר|start_of_today|today/.test(t)) { from = startOfLocalDay(); fromLabel = "מתחילת היום"; }
  else if (/אתמול/.test(t)) { const s = startOfLocalDay(); from = new Date(s.getTime() - DAY); return { from: toUtc(from), to: toUtc(startOfLocalDay()), fromLabel: "אתמול", toLabel: "תחילת היום" }; }
  else if (/24 השעות|24 שעות|ב-?24|last 24|24 hours/.test(t)) { from = minus(DAY); fromLabel = "24 שעות אחרונות"; }
  else if (/השבוע האחרון|7 הימים|7 ימים|שבוע אחרון|last_7|last 7 days|last week|this week|שבוע/.test(t)) { from = minus(7 * DAY); fromLabel = "7 ימים אחרונים"; }
  else if (/החודש|30 ימים|30 הימים|this month|last month|last 30 days|חודש/.test(t)) { from = minus(30 * DAY); fromLabel = "30 ימים אחרונים"; }
  return { from: toUtc(from), to: toUtc(now), fromLabel, toLabel: "עכשיו" };
}

export function parseScanCommand(text: string, now = new Date(), tzOffsetMin = 0): ScanCommand {
  const { people, peopleQuery } = resolvePeople(text);
  const company = resolveCompany(text);
  const topics = resolveTopics(text);
  const sourceTypes = resolveSourceTypes(text);
  const dateRange = resolveDateRange(text, now, tzOffsetMin);
  const t = text.toLowerCase();
  const wantsImpact = /מנ?יות|מניה|חבר|להרוויח|להשפיע|שוק|stock|impact|companies|beneficiar/.test(t);
  // "Analyze <company>" with no person → company analysis; otherwise scan people.
  const analyzeVerb = /\banalyze\b|לנתח|ניתוח/.test(t);
  const commandType: ScanCommand["commandType"] =
    (company && (analyzeVerb || people.length === 0)) ? "analyze_company" : "scan_people";
  return {
    action: "scan", commandType, company: commandType === "analyze_company" ? company : undefined,
    people, peopleQuery, sourceTypes, dateRange, topics,
    includeMarketImpact: true,
    includeInvestigation: true,
    includeBeneficiaryCompanies: wantsImpact || /יהנ|להרוויח|נהנ|beneficiar|companies/.test(t) || commandType === "analyze_company",
    onlyMovedStocks: /תנועה|זזו|הגיב|יצרו תנועה|moved/.test(t) && !/לא הגיב|not react/.test(t),
    onlyNotReacted: /לא הגיב|עדיין לא|not reacted|hasn't reacted/.test(t),
    limit: 100, raw: text,
  };
}

// Human-readable summary of what the system understood (for the UI confirmation line).
export function describeCommand(c: ScanCommand): string {
  const who = c.people.length ? c.people.join(", ") : "כל האנשים במעקב";
  const topics = c.topics.length ? ` · נושאים: ${c.topics.join(", ")}` : "";
  const src = c.sourceTypes.includes("x_posts") ? "ציוצים ומקורות" : "מקורות";
  const extra = c.onlyNotReacted ? " · רק מניות שלא הגיבו" : c.onlyMovedStocks ? " · רק מה שיצר תנועה" : "";
  return `סריקת ${src} של ${who} · ${c.dateRange.fromLabel} עד ${c.dateRange.toLabel}${topics}${extra}`;
}

// Progress stages (shared by API + UI)
export const SCAN_STAGES = [
  "מפרש את הפקודה", "מחפש ציוצים ומקורות", "מסיר כפילויות", "בודק אמינות",
  "מנתח משמעות", "מזהה סקטורים", "מזהה חברות", "בודק מחירי שוק", "מחשב תוצאות", "מסיים",
];
