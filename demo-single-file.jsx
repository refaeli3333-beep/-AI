import React, { useState, useMemo, useEffect } from "react";
import {
  ResponsiveContainer, AreaChart, Area, LineChart, Line,
  XAxis, YAxis, Tooltip, CartesianGrid, ReferenceLine, BarChart, Bar, Cell,
} from "recharts";

/* ============================================================================
   MARKET RADAR AI  —  דמו עובד (SIMULATION ONLY)
   מי אמר מה — ומה באמת קרה בשוק אחר כך
   כל הנתונים הם נתוני הדגמה בלבד. אין מסחר אמיתי. אין הבטחת רווח.
   ============================================================================ */

/* ----------------------------- Seeded RNG ------------------------------- */
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rng = mulberry32(20260711);
const rand = (min, max) => min + rng() * (max - min);
const randint = (min, max) => Math.floor(rand(min, max + 1));
const pick = (arr) => arr[Math.floor(rng() * arr.length)];

/* ----------------------------- Formatting ------------------------------- */
const money = (n) => `$${Number(n).toFixed(2)}`;
const signedMoney = (n) => `${n >= 0 ? "+" : "−"}$${Math.abs(n).toFixed(2)}`;
const pct = (n) => `${n >= 0 ? "+" : "−"}${Math.abs(n).toFixed(1)}%`;
const arrow = (n) => (n > 0.0001 ? "▲" : n < -0.0001 ? "▼" : "●");
const fmtInt = (n) => Number(n).toLocaleString("en-US");
const fmtDur = (mins) => {
  if (mins < 60) return `${Math.round(mins)} דק'`;
  if (mins < 1440) { const h = Math.floor(mins / 60), m = Math.round(mins % 60); return `${h} שע'${m ? ` ${m} דק'` : ""}`; }
  const d = Math.floor(mins / 1440); return `${d} ימים`;
};

/* ----------------------------- Domain data ------------------------------ */
const SECTORS = [
  "שבבים", "בינה מלאכותית", "ביטחון", "סייבר", "חלל", "אנרגיה", "נפט", "גז",
  "גרעין", "ליתיום", "סוללות", "רכבים חשמליים", "בנקים", "ביטוח", "ביוטכנולוגיה",
  "תרופות", "רובוטיקה", "מחשוב קוונטי", "ענן", "מרכזי נתונים", "תקשורת", "לוויינים",
  "רחפנים", "קריפטו", "תשלומים", "מסחר אלקטרוני", "תעופה", "תיירות", "מתכות",
  "זהב", "כסף", "חקלאות", "תשתיות",
].map((name, i) => ({ id: i + 1, name }));

const STOCK_SEED = [
  ["NVDA", "NVIDIA", "שבבים"], ["AAPL", "Apple", "מרכזי נתונים"],
  ["MSFT", "Microsoft", "ענן"], ["GOOGL", "Alphabet", "בינה מלאכותית"],
  ["AMZN", "Amazon", "מסחר אלקטרוני"], ["META", "Meta", "בינה מלאכותית"],
  ["TSLA", "Tesla", "רכבים חשמליים"], ["AMD", "AMD", "שבבים"],
  ["INTC", "Intel", "שבבים"], ["QCOM", "Qualcomm", "שבבים"],
  ["AVGO", "Broadcom", "שבבים"], ["TSM", "TSMC", "שבבים"],
  ["ASML", "ASML", "שבבים"], ["ARM", "Arm", "שבבים"],
  ["PLTR", "Palantir", "סייבר"], ["CRM", "Salesforce", "ענן"],
  ["ADBE", "Adobe", "ענן"], ["IBM", "IBM", "מחשוב קוונטי"],
  ["CSCO", "Cisco", "תקשורת"], ["ORCL", "Oracle", "מרכזי נתונים"],
  ["DELL", "Dell", "מרכזי נתונים"], ["SMCI", "Super Micro", "מרכזי נתונים"],
  ["LMT", "Lockheed Martin", "ביטחון"], ["RTX", "RTX", "ביטחון"],
  ["NOC", "Northrop Grumman", "ביטחון"], ["BA", "Boeing", "תעופה"],
  ["GD", "General Dynamics", "ביטחון"], ["BAESY", "BAE Systems", "ביטחון"],
  ["RHM.DE", "Rheinmetall", "ביטחון"], ["ESLT", "Elbit Systems", "ביטחון"],
  ["XOM", "ExxonMobil", "נפט"], ["CVX", "Chevron", "נפט"],
  ["SHEL", "Shell", "נפט"], ["BP", "BP", "נפט"],
  ["TTE", "TotalEnergies", "אנרגיה"], ["CCJ", "Cameco", "גרעין"],
  ["ALB", "Albemarle", "ליתיום"], ["JPM", "JPMorgan", "בנקים"],
  ["GS", "Goldman Sachs", "בנקים"], ["MS", "Morgan Stanley", "בנקים"],
  ["BAC", "Bank of America", "בנקים"], ["C", "Citigroup", "בנקים"],
  ["BLK", "BlackRock", "בנקים"], ["BRK.B", "Berkshire Hathaway", "בנקים"],
  ["SFTBY", "SoftBank", "בנקים"], ["COIN", "Coinbase", "קריפטו"],
  ["SQ", "Block", "תשלומים"], ["PYPL", "PayPal", "תשלומים"],
  ["V", "Visa", "תשלומים"], ["MA", "Mastercard", "תשלומים"],
  ["SHOP", "Shopify", "מסחר אלקטרוני"], ["UBER", "Uber", "תקשורת"],
  ["ABNB", "Airbnb", "תיירות"], ["NFLX", "Netflix", "תקשורת"],
  ["SPOT", "Spotify", "תקשורת"], ["BABA", "Alibaba", "מסחר אלקטרוני"],
  ["TCEHY", "Tencent", "בינה מלאכותית"], ["BIDU", "Baidu", "בינה מלאכותית"],
  ["MRNA", "Moderna", "ביוטכנולוגיה"], ["PFE", "Pfizer", "תרופות"],
  ["LLY", "Eli Lilly", "תרופות"], ["NEM", "Newmont", "זהב"],
  ["FCX", "Freeport", "מתכות"], ["RKLB", "Rocket Lab", "חלל"],
  ["IONQ", "IonQ", "מחשוב קוונטי"], ["ISRG", "Intuitive Surgical", "רובוטיקה"],
];
const CRYPTO_SEED = [
  ["BTC", "Bitcoin"], ["ETH", "Ethereum"], ["SOL", "Solana"],
  ["ADA", "Cardano"], ["XRP", "Ripple"], ["AVAX", "Avalanche"],
  ["LINK", "Chainlink"], ["DOT", "Polkadot"], ["DOGE", "Dogecoin"],
  ["MATIC", "Polygon"], ["LTC", "Litecoin"], ["BNB", "BNB"],
  ["TRX", "Tron"], ["ATOM", "Cosmos"], ["NEAR", "Near"],
  ["APT", "Aptos"], ["ARB", "Arbitrum"], ["OP", "Optimism"],
  ["UNI", "Uniswap"], ["FIL", "Filecoin"], ["ICP", "Internet Computer"],
  ["INJ", "Injective"], ["SUI", "Sui"], ["TIA", "Celestia"],
  ["SEI", "Sei"], ["RNDR", "Render"], ["FET", "Fetch.ai"],
  ["GRT", "The Graph"], ["AAVE", "Aave"], ["MKR", "Maker"],
];

let assetId = 1;
const ASSETS = [];
STOCK_SEED.forEach(([symbol, name, sector]) => {
  const entry = Math.round(rand(18, 480) * 100) / 100;
  const drift = rand(-0.28, 0.55);
  ASSETS.push({
    id: assetId++, symbol, name, type: "stock", sector,
    entry, current: Math.round(entry * (1 + drift) * 100) / 100,
    mcap: `$${randint(20, 3200)}B`, vol: rand(0.15, 0.55),
  });
});
CRYPTO_SEED.forEach(([symbol, name]) => {
  const entry = Math.round(rand(0.3, 3200) * 100) / 100;
  const drift = rand(-0.45, 0.9);
  ASSETS.push({
    id: assetId++, symbol, name, type: "crypto", sector: "קריפטו",
    entry, current: Math.round(entry * (1 + drift) * 100) / 100,
    mcap: `$${randint(1, 900)}B`, vol: rand(0.4, 0.95),
  });
});
// supply-chain / hidden-supplier companies (real names, demo prices) — carry a `sub`
const SUPPLY_SEED = [
  ["AMAT", "Applied Materials", "שבבים", "ציוד ייצור שבבים"],
  ["LRCX", "Lam Research", "שבבים", "ציוד ייצור שבבים"],
  ["KLAC", "KLA", "שבבים", "ציוד ייצור שבבים"],
  ["MU", "Micron", "שבבים", "זיכרונות"],
  ["VRT", "Vertiv", "מרכזי נתונים", "קירור"],
  ["ETN", "Eaton", "תשתיות", "חשמל"],
  ["GEV", "GE Vernova", "אנרגיה", "חשמל"],
  ["GLW", "Corning", "תקשורת", "סיבים אופטיים"],
  ["COHR", "Coherent", "תקשורת", "סיבים אופטיים"],
  ["HPE", "Hewlett Packard Enterprise", "מרכזי נתונים", "שרתים"],
  ["EQIX", "Equinix", "מרכזי נתונים", "מרכזי נתונים"],
  ["DLR", "Digital Realty", "מרכזי נתונים", "מרכזי נתונים"],
  ["CRWD", "CrowdStrike", "סייבר", "סייבר"],
  ["PANW", "Palo Alto Networks", "סייבר", "סייבר"],
  ["ZS", "Zscaler", "סייבר", "סייבר"],
];
SUPPLY_SEED.forEach(([symbol, name, sector, sub]) => {
  const entry = Math.round(rand(30, 600) * 100) / 100;
  const drift = rand(-0.25, 0.6);
  ASSETS.push({
    id: assetId++, symbol, name, type: "stock", sector, sub,
    entry, current: Math.round(entry * (1 + drift) * 100) / 100,
    mcap: `$${randint(20, 400)}B`, vol: rand(0.2, 0.6),
  });
});

/* ----------------------------- People ----------------------------------- */
const CURATED = [
  ["דונלד טראמפ", "נשיא ארה\"ב", "ממשל ארה\"ב", "ארה\"ב", "פוליטיקאי", "פוליטיקה", true],
  ["בנימין נתניהו", "ראש ממשלת ישראל", "ממשלת ישראל", "ישראל", "פוליטיקאי", "פוליטיקה", true],
  ["אילון מאסק", "מנכ\"ל", "Tesla / SpaceX / xAI", "ארה\"ב", "מנכ\"ל", "רכבים חשמליים", true],
  ["ג'נסן huang", "מנכ\"ל", "NVIDIA", "ארה\"ב", "מנכ\"ל", "שבבים", true],
  ["טים קוק", "מנכ\"ל", "Apple", "ארה\"ב", "מנכ\"ל", "מרכזי נתונים", true],
  ["סאטיה נאדלה", "מנכ\"ל", "Microsoft", "ארה\"ב", "מנכ\"ל", "ענן", true],
  ["סונדאר פיצ'אי", "מנכ\"ל", "Alphabet", "ארה\"ב", "מנכ\"ל", "בינה מלאכותית", true],
  ["מארק צוקרברג", "מנכ\"ל", "Meta", "ארה\"ב", "מנכ\"ל", "בינה מלאכותית", true],
  ["אנדי ג'אסי", "מנכ\"ל", "Amazon", "ארה\"ב", "מנכ\"ל", "מסחר אלקטרוני", true],
  ["סם אלטמן", "מנכ\"ל", "OpenAI", "ארה\"ב", "מנכ\"ל", "בינה מלאכותית", true],
  ["דריו אמודיי", "מנכ\"ל", "Anthropic", "ארה\"ב", "מנכ\"ל", "בינה מלאכותית", true],
  ["ליסה סו", "מנכ\"לית", "AMD", "ארה\"ב", "מנכ\"ל", "שבבים", true],
  ["פאט גלסינגר", "יו\"ר לשעבר", "Intel", "ארה\"ב", "מנכ\"ל", "שבבים", false],
  ["ג'רום פאוול", "יו\"ר הפדרל ריזרב", "Federal Reserve", "ארה\"ב", "בנקאי מרכזי", "בנקים", true],
  ["כריסטין לגארד", "נשיאת ה-ECB", "European Central Bank", "האיחוד האירופי", "בנקאי מרכזי", "בנקים", true],
  ["ג'נט ילן", "שרת האוצר לשעבר", "US Treasury", "ארה\"ב", "פוליטיקאי", "בנקים", false],
  ["וורן באפט", "יו\"ר", "Berkshire Hathaway", "ארה\"ב", "משקיע", "בנקים", true],
  ["ריי דליו", "מייסד", "Bridgewater", "ארה\"ב", "משקיע", "בנקים", true],
  ["קאת'י ווד", "מנכ\"לית", "ARK Invest", "ארה\"ב", "משקיע", "בינה מלאכותית", true],
  ["מייקל ברי", "מנהל קרן", "Scion", "ארה\"ב", "משקיע", "בנקים", false],
  ["ביל אקמן", "מנכ\"ל", "Pershing Square", "ארה\"ב", "משקיע", "בנקים", true],
  ["לארי פינק", "מנכ\"ל", "BlackRock", "ארה\"ב", "משקיע", "בנקים", true],
  ["ג'יימי דיימון", "מנכ\"ל", "JPMorgan", "ארה\"ב", "מנכ\"ל", "בנקים", true],
  ["מסיושי סון", "מנכ\"ל", "SoftBank", "יפן", "משקיע", "בינה מלאכותית", true],
  ["צ'אנגפנג ז'או", "מייסד לשעבר", "Binance", "איחוד האמירויות", "קריפטו", "קריפטו", false],
  ["בריאן ארמסטרונג", "מנכ\"ל", "Coinbase", "ארה\"ב", "קריפטו", "קריפטו", true],
  ["ויטליק בוטרין", "מייסד", "Ethereum", "קנדה", "קריפטו", "קריפטו", true],
  ["מייקל סיילור", "יו\"ר", "MicroStrategy", "ארה\"ב", "משקיע", "קריפטו", true],
  ["וולודימיר זלנסקי", "נשיא אוקראינה", "ממשלת אוקראינה", "אוקראינה", "פוליטיקאי", "ביטחון", true],
  ["שי ג'ינפינג", "נשיא סין", "ממשלת סין", "סין", "פוליטיקאי", "פוליטיקה", true],
  ["ולדימיר פוטין", "נשיא רוסיה", "ממשלת רוסיה", "רוסיה", "פוליטיקאי", "אנרגיה", true],
  ["נרנדרה מודי", "ראש ממשלת הודו", "ממשלת הודו", "הודו", "פוליטיקאי", "פוליטיקה", true],
  ["אולף שולץ", "קנצלר גרמניה", "ממשלת גרמניה", "גרמניה", "פוליטיקאי", "פוליטיקה", true],
  ["עמנואל מקרון", "נשיא צרפת", "ממשלת צרפת", "צרפת", "פוליטיקאי", "פוליטיקה", true],
  ["מוחמד בן סלמאן", "יורש העצר", "ממלכת סעודיה", "ערב הסעודית", "פוליטיקאי", "נפט", true],
  ["בצלאל סמוטריץ'", "שר האוצר", "משרד האוצר", "ישראל", "פוליטיקאי", "בנקים", true],
  ["אמיר ירון", "נגיד בנק ישראל", "בנק ישראל", "ישראל", "בנקאי מרכזי", "בנקים", true],
  ["בז'לאל מכלוף", "מנכ\"ל", "Elbit Systems", "ישראל", "מנכ\"ל", "ביטחון", false],
  ["ג'ים טאיקלט", "מנכ\"ל", "Lockheed Martin", "ארה\"ב", "מנכ\"ל", "ביטחון", true],
  ["דארן וודס", "מנכ\"ל", "ExxonMobil", "ארה\"ב", "מנכ\"ל", "נפט", true],
  ["אמין נאסר", "מנכ\"ל", "Saudi Aramco", "ערב הסעודית", "מנכ\"ל", "נפט", true],
  ["וו-שי וונג", "יו\"ר", "TSMC", "טאיוואן", "מנכ\"ל", "שבבים", true],
  ["כריסטיאנו אמון", "מנכ\"ל", "Qualcomm", "ארה\"ב", "מנכ\"ל", "שבבים", true],
  ["הוק טאן", "מנכ\"ל", "Broadcom", "ארה\"ב", "מנכ\"ל", "שבבים", true],
  ["אלכס קארפ", "מנכ\"ל", "Palantir", "ארה\"ב", "מנכ\"ל", "סייבר", true],
  ["דניאל אק", "מנכ\"ל", "Spotify", "שוודיה", "מנכ\"ל", "תקשורת", true],
  ["דארה חוסרושאהי", "מנכ\"ל", "Uber", "ארה\"ב", "מנכ\"ל", "תקשורת", true],
  ["פיטר בק", "מנכ\"ל", "Rocket Lab", "ניו זילנד", "מנכ\"ל", "חלל", true],
  ["דיוויד סאקס", "יועץ קריפטו ובינה מלאכותית", "ממשל ארה\"ב", "ארה\"ב", "פוליטיקאי", "קריפטו", true],
  ["רוברט קנדי", "שר הבריאות", "ממשל ארה\"ב", "ארה\"ב", "פוליטיקאי", "תרופות", true],
];
const EXTRA_ROLES = [
  "שר האנרגיה", "שר הביטחון", "שר החוץ", "שר הטכנולוגיה", "נגיד הבנק המרכזי",
  "יו\"ר רשות ניירות ערך", "מנכ\"ל חברת הגז הלאומית", "מנכ\"ל חברת החשמל",
  "ראש מטה הסייבר", "מנכ\"ל קרן העושר הריבונית",
];
const COUNTRIES = ["גרמניה", "צרפת", "בריטניה", "יפן", "קוריאה הדרומית", "הודו",
  "קנדה", "אוסטרליה", "ברזיל", "איחוד האמירויות", "סינגפור", "נורבגיה"];
const CATS_MAP = { "שר האנרגיה": ["פוליטיקאי", "אנרגיה"], "שר הביטחון": ["פוליטיקאי", "ביטחון"],
  "שר החוץ": ["פוליטיקאי", "פוליטיקה"], "שר הטכנולוגיה": ["פוליטיקאי", "בינה מלאכותית"],
  "נגיד הבנק המרכזי": ["בנקאי מרכזי", "בנקים"], "יו\"ר רשות ניירות ערך": ["פוליטיקאי", "בנקים"],
  "מנכ\"ל חברת הגז הלאומית": ["מנכ\"ל", "גז"], "מנכ\"ל חברת החשמל": ["מנכ\"ל", "אנרגיה"],
  "ראש מטה הסייבר": ["פוליטיקאי", "סייבר"], "מנכ\"ל קרן העושר הריבונית": ["משקיע", "בנקים"] };

let personId = 1;
const PEOPLE = [];
CURATED.forEach(([name, role, company, country, category, industry, verified]) => {
  PEOPLE.push({
    id: personId++, name, role, company, country, category, industry,
    verified, active: true, favorite: rng() > 0.72,
    importance: randint(70, 99),
    website: "https://example.com", x: "https://x.com/demo",
    linkedin: "https://linkedin.com/in/demo", youtube: "https://youtube.com/@demo",
    roleStart: `20${randint(15, 24)}`, roleHistory: role, lastVerified: "2026-07-10",
  });
});
while (PEOPLE.length < 108) {
  const role = pick(EXTRA_ROLES);
  const country = pick(COUNTRIES);
  const [category, industry] = CATS_MAP[role];
  PEOPLE.push({
    id: personId++, name: `${role} — ${country}`, role, company: `ממשלת ${country}`,
    country, category, industry, verified: rng() > 0.4, active: true,
    favorite: false, importance: randint(45, 82),
    website: "https://example.com", x: "https://x.com/demo",
    linkedin: "https://linkedin.com/in/demo", youtube: "https://youtube.com/@demo",
    roleStart: `20${randint(18, 25)}`, roleHistory: role, lastVerified: "2026-07-09",
  });
}

/* ----------------------------- Events / templates ----------------------- */
const EVENT_STAGES = [
  "רמז", "דעה", "הצהרה", "כוונה", "תוכנית", "הצעת חוק", "אישור ממשלתי",
  "אישור תקציב", "מכרז", "חוזה חתום", "ייצור", "אספקה", "הכנסה בפועל",
];
const STAGE_CONF = { "רמז": 20, "דעה": 25, "הצהרה": 40, "כוונה": 45, "תוכנית": 55,
  "הצעת חוק": 60, "אישור ממשלתי": 75, "אישור תקציב": 80, "מכרז": 78,
  "חוזה חתום": 92, "ייצור": 90, "אספקה": 95, "הכנסה בפועל": 98 };
const SOURCE_TYPES = ["ציוץ ב-X", "נאום", "ראיון", "הודעה רשמית", "פוסט", "דיווח חדשותי"];
const VERIF = ["מאומת", "מאומת חלקית", "דורש בדיקה", "שמועה", "לא מאומת"];

const TEMPLATES = [
  { txt: "We plan to invest billions of dollars in AI infrastructure and data centers.",
    he: "אנחנו מתכננים להשקיע מיליארדי דולרים בתשתיות בינה מלאכותית ומרכזי נתונים.",
    sum: "השקעת ענק אפשרית בתשתיות בינה מלאכותית.",
    topic: "בינה מלאכותית ומרכזי נתונים", event: "השקעה בבינה מלאכותית",
    sectors: ["שבבים", "מרכזי נתונים", "ענן", "אנרגיה"] },
  { txt: "Our new chip delivers a generational leap in performance for AI workloads.",
    he: "השבב החדש שלנו מציג קפיצת דור בביצועים עבור עומסי בינה מלאכותית.",
    sum: "השקת שבב חדש לעומסי בינה מלאכותית.",
    topic: "השקת שבב חדש", event: "השקת שבב", sectors: ["שבבים", "בינה מלאכותית"] },
  { txt: "The defense budget will increase significantly next fiscal year.",
    he: "תקציב הביטחון יגדל משמעותית בשנת הכספים הבאה.",
    sum: "כוונה להגדיל את תקציב הביטחון.",
    topic: "הגדלת תקציב ביטחון", event: "תקציב ביטחון", sectors: ["ביטחון", "חלל", "סייבר"] },
  { txt: "We are imposing new tariffs on imported semiconductors.",
    he: "אנו מטילים מכסים חדשים על שבבים מיובאים.",
    sum: "מכסים חדשים על שבבים מיובאים.",
    topic: "מכסים על שבבים", event: "מכסים", sectors: ["שבבים", "מסחר אלקטרוני"] },
  { txt: "Interest rates may need to stay higher for longer to control inflation.",
    he: "ייתכן שהריבית תצטרך להישאר גבוהה יותר לאורך זמן כדי לרסן את האינפלציה.",
    sum: "רמז לריבית גבוהה לאורך זמן.",
    topic: "מדיניות ריבית", event: "שינוי ריבית", sectors: ["בנקים", "ביטוח", "תשתיות"] },
  { txt: "We signed a major government contract for missile defense systems.",
    he: "חתמנו על חוזה ממשלתי גדול למערכות הגנה מפני טילים.",
    sum: "חוזה ממשלתי למערכות הגנה.",
    topic: "חוזה הגנה", event: "חוזה ממשלתי", sectors: ["ביטחון", "חלל"] },
  { txt: "A ceasefire agreement has been reached in the region.",
    he: "הושג הסכם הפסקת אש באזור.",
    sum: "הסכם הפסקת אש באזור.",
    topic: "הפסקת אש", event: "הפסקת אש", sectors: ["נפט", "ביטחון", "תעופה"] },
  { txt: "We support a clearer regulatory framework for digital assets.",
    he: "אנו תומכים במסגרת רגולטורית ברורה יותר לנכסים דיגיטליים.",
    sum: "תמיכה ברגולציה ברורה לקריפטו.",
    topic: "רגולציית קריפטו", event: "אימוץ קריפטו", sectors: ["קריפטו", "תשלומים"] },
  { txt: "The regulator approved a new spot ETF for the asset.",
    he: "הרגולטור אישר ETF ספוט חדש עבור הנכס.",
    sum: "אושר ETF ספוט חדש.",
    topic: "אישור ETF", event: "אישור ETF", sectors: ["קריפטו", "בנקים"] },
  { txt: "Our new plant will begin mass production within twelve months.",
    he: "המפעל החדש שלנו יתחיל ייצור המוני בתוך שנים-עשר חודשים.",
    sum: "מפעל חדש ייכנס לייצור המוני.",
    topic: "הרחבת ייצור", event: "בניית מפעל", sectors: ["שבבים", "סוללות", "רכבים חשמליים"] },
  { txt: "We are launching a new satellite constellation for global connectivity.",
    he: "אנו משיקים מערך לוויינים חדש לקישוריות גלובלית.",
    sum: "השקת מערך לוויינים חדש.",
    topic: "מערך לוויינים", event: "השקעה בחלל", sectors: ["חלל", "לוויינים", "תקשורת"] },
  { txt: "Oil supply cuts are being considered by major producers.",
    he: "יצרניות מרכזיות שוקלות קיצוצים באספקת הנפט.",
    sum: "שקילת קיצוץ באספקת נפט.",
    topic: "אספקת נפט", event: "שינוי במחיר נפט", sectors: ["נפט", "גז", "אנרגיה"] },
];

/* ---------------------- price path with volume -------------------------- */
function buildPricePath(entry, vol, drift, preMove) {
  const steps = [
    { k: "signal", label: "בזמן הפרסום", mins: 0 },
    { k: "m15", label: "15 דק'", mins: 15 },
    { k: "h1", label: "אחרי שעה", mins: 60 },
    { k: "h3", label: "אחרי 3 שעות", mins: 180 },
    { k: "d1", label: "אחרי 24 שעות", mins: 1440 },
    { k: "d3", label: "אחרי 3 ימים", mins: 4320 },
    { k: "d7", label: "אחרי שבוע", mins: 10080 },
    { k: "d30", label: "אחרי חודש", mins: 43200 },
    { k: "d90", label: "3 חודשים", mins: 129600 },
    { k: "y1", label: "שנה", mins: 525600 },
    { k: "now", label: "היום", mins: 700000 },
  ];
  const volBase = rand(0.6, 6);
  const path = [];
  steps.forEach((s, i) => {
    let price;
    if (i === 0) price = entry;
    else {
      const frac = s.mins / 700000;
      const noise = (rng() - 0.5) * vol * entry * (0.04 + frac * 0.5);
      const trend = entry * drift * frac;
      // preMove: signal reflects motion already underway → early bars carry more of the move
      const pre = preMove ? entry * drift * 0.25 * Math.min(1, frac * 6) : 0;
      price = entry + trend + noise + pre;
      if (price < entry * 0.15) price = entry * 0.15;
    }
    const vmult = 1 + (i <= 4 ? rand(-0.1, 1.7) : rand(-0.25, 0.6));
    path.push({
      ...s, price: Math.round(price * 100) / 100,
      volume: Math.round(volBase * vmult * 100) / 100, volAnomaly: vmult > 1.6,
    });
  });
  return path;
}

/* --------------------------- calc engines ------------------------------- */
function simulate(amount, entryPrice, currentPrice) {
  const units = amount / entryPrice;
  const currentValue = units * currentPrice;
  const pl = currentValue - amount;
  const plPct = (pl / amount) * 100;
  return { units, currentValue, pl, plPct };
}
function scoreSignal({ verif, importance, stage, directness, alreadyMoved, confirmations, hasOfficial }) {
  let score = 0;
  const verifPts = { "מאומת": 15, "מאומת חלקית": 10, "דורש בדיקה": 6, "שמועה": 2, "לא מאומת": 0 };
  score += verifPts[verif] ?? 4;
  score += Math.round((importance / 100) * 10);
  score += randint(4, 10);
  score += Math.round((STAGE_CONF[stage] / 100) * 15);
  score += Math.round(directness * 15);
  score += Math.min(10, confirmations * 3);
  score += randint(3, 10);
  score += randint(3, 10);
  score += alreadyMoved > 0.15 ? 0 : 5;
  if (alreadyMoved > 0.25) score -= 8;
  if (!hasOfficial) score -= 6;
  if (verif === "שמועה") score -= 5;
  return Math.max(0, Math.min(100, Math.round(score)));
}
const scoreLabel = (s) => s >= 80 ? "אות חזק מאוד" : s >= 60 ? "אות חזק" : s >= 40 ? "אות למעקב" : "אות חלש";
function riskLevel({ vol, alreadyMoved, verif, type }) {
  let r = vol * 3 + alreadyMoved * 2;
  if (verif === "שמועה" || verif === "לא מאומת") r += 1.2;
  if (type === "crypto") r += 1;
  if (r > 3.4) return "קיצוני";
  if (r > 2.3) return "גבוה";
  if (r > 1.3) return "בינוני";
  return "נמוך";
}
function connectionTag(sig) {
  const d = sig.directness, c = sig.confirmations, v = sig.verif;
  if (v === "לא מאומת") return "אין מספיק נתונים";
  if (v === "שמועה") return d < 0.5 ? "לא נמצא קשר ברור" : "קשר חלש";
  if (d >= 0.8 && c >= 2) return "קשר ישיר";
  if (d >= 0.62) return "קשר עקיף";
  if (d >= 0.45) return "קשר חלש";
  return "לא נמצא קשר ברור";
}
// reaction-time metrics from the price path
function reactionMetrics(sig) {
  const { path, entryPrice } = sig;
  const firstCross = (thr) => {
    for (let i = 1; i < path.length; i++) {
      const ch = Math.abs((path[i].price - entryPrice) / entryPrice * 100);
      if (ch >= thr) return path[i];
    }
    return null;
  };
  let peak = path[0], peakIdx = 0, trough = path[0], troughIdx = 0;
  path.forEach((p, i) => {
    if (p.price > peak.price) { peak = p; peakIdx = i; }
    if (p.price < trough.price) { trough = p; troughIdx = i; }
  });
  const cur = path[path.length - 1].price;
  const maxRet = (peak.price - entryPrice) / entryPrice * 100;
  const maxLoss = (trough.price - entryPrice) / entryPrice * 100;
  const gainWindow = peak.price - entryPrice;
  const erased = maxRet > 3 && cur < entryPrice + gainWindow * 0.4;
  const gainHeld = maxRet > 2 && cur >= entryPrice + gainWindow * 0.6;
  let returnedToEntry = false;
  for (let i = peakIdx + 1; i < path.length; i++) if (path[i].price <= entryPrice * 1.005) { returnedToEntry = true; break; }
  return {
    t1: firstCross(1), t3: firstCross(3), t5: firstCross(5),
    peak, peakIdx, trough, troughIdx, maxRet, maxLoss,
    erased, gainHeld, returnedToEntry, startedBefore: sig.preMove, cur,
  };
}

/* ----------------------------- build signals ---------------------------- */
const DAYMS = 86400000;
const NOW = new Date("2026-07-11T09:00:00");
const SIGNALS = [];
for (let i = 0; i < 210; i++) {
  const person = pick(PEOPLE);
  const tmpl = pick(TEMPLATES);
  const candidateAssets = ASSETS.filter((a) => tmpl.sectors.includes(a.sector));
  const asset = candidateAssets.length ? pick(candidateAssets) : pick(ASSETS);
  const stage = pick(EVENT_STAGES);
  const verif = person.verified ? pick(["מאומת", "מאומת חלקית", "דורש בדיקה"]) : pick(VERIF);
  const drift = rand(-0.35, 0.75);
  const preMove = rng() < 0.26;
  const path = buildPricePath(asset.entry, asset.vol, drift, preMove);
  const entryPrice = path[0].price;
  const currentPrice = path[path.length - 1].price;
  const alreadyMoved = Math.abs((path[2].price - entryPrice) / entryPrice);
  const directness = rand(0.4, 1);
  const confirmations = randint(0, 3);
  const hasOfficial = ["הודעה רשמית", "נאום"].includes(pick(SOURCE_TYPES)) || rng() > 0.5;
  const score = scoreSignal({ verif, importance: person.importance, stage, directness, alreadyMoved, confirmations, hasOfficial });
  const risk = riskLevel({ vol: asset.vol, alreadyMoved, verif, type: asset.type });
  const ageMin = Math.floor(rand(2, 600 * 60));
  const published = new Date(NOW.getTime() - ageMin * 60000);
  const sig = {
    id: i + 1, person, asset, tmpl, stage, verif, path, entryPrice, currentPrice,
    directness, confirmations, preMove, score, risk, published, hasOfficial,
    sourceType: pick(SOURCE_TYPES), topic: tmpl.topic, eventType: tmpl.event, sectors: tmpl.sectors,
    connectedAssets: (candidateAssets.length ? candidateAssets : [asset]).slice(0, 4),
  };
  sig.tag = connectionTag(sig);
  SIGNALS.push(sig);
}
SIGNALS.sort((a, b) => b.published - a.published);

/* -------------------- mock scan runs + recent items --------------------- */
const RECENT30 = SIGNALS.slice(0, 4);
const NEXT_SCAN = new Date(NOW.getTime() + 30 * 60000);
const SCAN_RUNS = Array.from({ length: 8 }).map((_, i) => {
  const start = new Date(NOW.getTime() - i * 30 * 60000);
  const people = randint(40, 108);
  const queries = people * randint(1, 3);
  const found = randint(20, 120);
  const fresh = randint(0, 18);
  const verified = randint(0, fresh);
  const signals = randint(0, Math.max(1, Math.floor(fresh / 2)));
  const errors = randint(0, 3);
  return {
    id: i + 1, start, end: new Date(start.getTime() + randint(40, 180) * 1000),
    status: i === 0 ? "רץ כעת" : "הושלם", people, queries, found, fresh, verified,
    signals, rejected: found - fresh, errors, details: SIGNALS.slice(i * 3, i * 3 + 4),
  };
});
function sampleQueries(p) {
  const n = p.name;
  return [`"${n}" announcement`, `"${n}" investment`, `site:gov "${n}"`, `"${n}" הודיע`].slice(0, p.importance > 80 ? 4 : 2);
}

/* -------------- timeline points used across UI (the 8 the spec asks) ---- */
const TIMELINE_KEYS = ["signal", "h1", "h3", "d1", "d3", "d7", "d30", "now"];
function timelinePoints(sig, amount) {
  return TIMELINE_KEYS.map((k) => {
    const p = sig.path.find((x) => x.k === k);
    const sim = simulate(amount, sig.entryPrice, p.price);
    const change = (p.price - sig.entryPrice) / sig.entryPrice * 100;
    return { ...p, change, value: sim.currentValue, pl: sim.pl };
  });
}

/* ----------------------------- aggregations ----------------------------- */
function personStats(person, amount) {
  const sigs = SIGNALS.filter((s) => s.person.id === person.id);
  let totalPL = 0, wins = 0, sumPct = 0, best = null, worst = null, strong = 0, weak = 0;
  sigs.forEach((s) => {
    const sim = simulate(amount, s.entryPrice, s.currentPrice);
    totalPL += sim.pl; sumPct += sim.plPct;
    if (sim.pl >= 0) wins++;
    if (s.score >= 60) strong++; else weak++;
    if (!best || sim.plPct > best.pct) best = { s, pct: sim.plPct };
    if (!worst || sim.plPct < worst.pct) worst = { s, pct: sim.plPct };
  });
  return { count: sigs.length, wins, losses: sigs.length - wins,
    winRate: sigs.length ? (wins / sigs.length) * 100 : 0,
    avgPct: sigs.length ? sumPct / sigs.length : 0, totalPL, best, worst, strong, weak, sigs };
}
function sectorStats(sectorName, amount) {
  const sigs = SIGNALS.filter((s) => s.sectors.includes(sectorName));
  let sumScore = 0, sumPct = 0, totalPL = 0; const byPerson = {};
  sigs.forEach((s) => {
    const sim = simulate(amount, s.entryPrice, s.currentPrice);
    sumScore += s.score; sumPct += sim.plPct; totalPL += sim.pl;
    byPerson[s.person.id] = (byPerson[s.person.id] || 0) + 1;
  });
  const topPersonId = Object.keys(byPerson).sort((a, b) => byPerson[b] - byPerson[a])[0];
  const today = sigs.filter((s) => (NOW - s.published) < DAYMS).length;
  return { count: sigs.length, today, avgScore: sigs.length ? sumScore / sigs.length : 0,
    avgPct: sigs.length ? sumPct / sigs.length : 0, totalPL,
    topPerson: topPersonId ? PEOPLE.find((p) => p.id == topPersonId) : null,
    last: sigs.sort((a, b) => b.published - a.published)[0] };
}

/* ==================== DEEP INVESTIGATION ENGINE ========================= */
// map a primary sector to its supply/benefit chain (sub-sectors)
const SECTOR_CHAIN = {
  "בינה מלאכותית": ["שבבים", "ציוד ייצור שבבים", "זיכרונות", "שרתים", "קירור", "חשמל", "מרכזי נתונים", "סיבים אופטיים", "סייבר"],
  "מרכזי נתונים": ["שבבים", "שרתים", "קירור", "חשמל", "מרכזי נתונים", "סיבים אופטיים"],
  "שבבים": ["ציוד ייצור שבבים", "זיכרונות", "שרתים", "סיבים אופטיים"],
  "ענן": ["שרתים", "מרכזי נתונים", "סייבר"],
  "ביטחון": ["ביטחון", "חלל", "סייבר"],
  "חלל": ["חלל", "לוויינים", "ביטחון"],
  "אנרגיה": ["חשמל", "נפט", "גז", "גרעין"],
  "נפט": ["נפט", "גז"],
  "קריפטו": ["קריפטו", "תשלומים"],
  "רכבים חשמליים": ["סוללות", "ליתיום", "שבבים"],
};
const SUB_ROLE = {
  "ציוד ייצור שבבים": "ספק רכיבים", "זיכרונות": "ספק רכיבים", "סיבים אופטיים": "ספק רכיבים",
  "שרתים": "ספק", "קירור": "תשתית", "חשמל": "תשתית", "מרכזי נתונים": "תשתית",
  "סייבר": "מוטב עקיף", "שבבים": "נהנית ישירה", "חלל": "מוטב עקיף", "לוויינים": "מוטב עקיף",
  "ביטחון": "נהנית ישירה", "נפט": "נהנית ישירה", "גז": "מוטב עקיף", "גרעין": "מוטב עקיף",
  "קריפטו": "נהנית ישירה", "תשלומים": "מוטב עקיף", "סוללות": "ספק", "ליתיום": "ספק רכיבים",
};
const ROLE_DIRECT = { "נהנית ישירה": 1, "ספק": 0.78, "ספק רכיבים": 0.7, "תשתית": 0.6, "מוטב עקיף": 0.5, "באותו סקטור": 0.72, "מתחרה": 0.42, "קשורה": 0.55 };
const SUB_META = {
  "שבבים": "מעבדים ומאיצים (GPU/AI) למערכות בינה מלאכותית",
  "ציוד ייצור שבבים": "מכונות ליתוגרפיה וציוד לייצור שבבים",
  "זיכרונות": "זיכרון HBM/DRAM לשרתי בינה מלאכותית",
  "שרתים": "שרתים ומערכות מחשוב למרכזי נתונים",
  "קירור": "פתרונות קירור וניהול תרמי למרכזי נתונים",
  "חשמל": "ציוד חשמל, ממירים וניהול אנרגיה",
  "מרכזי נתונים": "תשתית פיזית ואחסון של מרכזי נתונים",
  "סיבים אופטיים": "רכיבים אופטיים וקישוריות מהירה",
  "סייבר": "אבטחת מידע והגנת סייבר",
  "ביטחון": "מערכות נשק, חיישנים ומערכות הגנה",
  "חלל": "מערכות שיגור, לוויינים ותשתית חלל",
  "נפט": "הפקה וזיקוק של נפט וגז",
  "קריפטו": "מסחר, משמורת ותשתית בלוקצ'יין",
};

// deterministic per-(signal,asset) price path: starts at asset.entry, ends at asset.current
function assetSignalPath(asset, sig) {
  const seed = (((sig.id * 73856093) ^ (asset.id * 19349663)) >>> 0) || 1;
  const r = mulberry32(seed);
  const entry = asset.entry, current = asset.current, total = current - entry;
  const keys = [["signal", "בזמן הפרסום", 0], ["h1", "אחרי שעה", 60], ["h3", "אחרי 3 שעות", 180],
    ["d1", "אחרי יום", 1440], ["d7", "אחרי שבוע", 10080], ["now", "היום", 700000]];
  return keys.map(([k, label, mins], i) => {
    let price;
    if (i === 0) price = entry;
    else if (k === "now") price = current;
    else {
      const f = mins / 700000, ease = Math.pow(f, 0.55);
      const front = sig.preMove ? 0.22 : 0;
      const noise = (r() - 0.5) * asset.vol * entry * (0.03 + f * 0.25);
      price = entry + total * (ease + front * (1 - ease)) + noise;
      if (price < entry * 0.2) price = entry * 0.2;
    }
    return { k, label, mins, price: Math.round(price * 100) / 100 };
  });
}
const mcapNum = (a) => parseFloat(String(a.mcap || "$60B").replace(/[^0-9.]/g, "")) || 60;

function scoreCandidate(sig, asset, role, amount) {
  const path = assetSignalPath(asset, sig);
  const entry = path[0].price, current = path[path.length - 1].price;
  const chg = (k) => { const p = path.find((x) => x.k === k); return (p.price - entry) / entry * 100; };
  const changes = { h1: chg("h1"), h3: chg("h3"), d1: chg("d1"), d7: chg("d7"), now: chg("now") };
  const alreadyMoved = Math.abs(changes.h1) / 100;
  const directness = (ROLE_DIRECT[role] ?? 0.55) * (0.6 + 0.4 * sig.directness);
  const cap = mcapNum(asset);
  const significance = Math.min(1, (8 / Math.sqrt(cap)) * (STAGE_CONF[sig.stage] / 100));
  const verifBonus = sig.verif === "מאומת" ? 8 : sig.verif === "מאומת חלקית" ? 4 : 0;
  const hiddenBonus = ["ספק", "ספק רכיבים", "תשתית", "מוטב עקיף"].includes(role) ? 6 : 0;
  let opportunity = directness * 38 + significance * 22 + verifBonus + hiddenBonus;
  opportunity += alreadyMoved < 0.02 ? 18 : alreadyMoved < 0.05 ? 10 : alreadyMoved < 0.1 ? 4 : 0;
  opportunity = Math.max(0, Math.min(100, Math.round(opportunity)));
  let risk = asset.vol * 45 + (asset.type === "crypto" ? 14 : 0);
  risk += cap < 40 ? 14 : cap < 120 ? 7 : 0;
  risk += alreadyMoved > 0.12 ? 14 : alreadyMoved > 0.06 ? 7 : 0;
  risk += (sig.verif === "שמועה" || sig.verif === "לא מאומת") ? 12 : 0;
  risk = Math.max(0, Math.min(100, Math.round(risk)));
  const confidencePct = Math.round(directness * 70 + (verifBonus / 8) * 22 + Math.min(8, sig.confirmations * 3));
  const confidenceLabel = confidencePct >= 70 ? "גבוהה" : confidencePct >= 45 ? "בינונית" : "נמוכה";
  const alreadyReacted = Math.abs(changes.h1) >= 1 || Math.abs(changes.now) >= 5;
  const sub = asset.sub || asset.sector;
  const value200 = simulate(amount, entry, current);
  return {
    asset, role, sub, path, entry, current, changes, value200,
    opportunity, risk, directness, confidencePct, confidenceLabel, alreadyReacted,
    supplies: SUB_META[sub] || `מוצרים ושירותים בתחום ${asset.sector}`,
    why: `${asset.name} מסווגת כ"${role}" עבור האירוע — פעילות בתחום ${sub}.`,
    upCat: "אישור תקציב / חוזה חתום / עלייה בביקוש בפועל",
    downCat: "הכחשה / ביטול תוכנית / דוח חלש / המחיר כבר עלה יותר מדי",
  };
}

function investigate(sig, amount) {
  const seen = new Set(); const cands = [];
  const add = (asset, role) => { if (!asset || seen.has(asset.id)) return; seen.add(asset.id); cands.push({ asset, role }); };
  add(sig.asset, "נהנית ישירה");
  ASSETS.filter((a) => sig.sectors.includes(a.sector)).forEach((a) => add(a, a.id === sig.asset.id ? "נהנית ישירה" : "באותו סקטור"));
  sig.sectors.forEach((sec) => (SECTOR_CHAIN[sec] || []).forEach((sub) => {
    ASSETS.filter((a) => a.sub === sub || a.sector === sub).forEach((a) => add(a, SUB_ROLE[sub] || "קשורה"));
  }));
  sig.connectedAssets.forEach((a) => add(a, "קשורה"));
  const scored = cands.map((c) => scoreCandidate(sig, c.asset, c.role, amount));
  scored.sort((a, b) => b.opportunity - a.opportunity);
  return scored;
}

function ScoreBar({ t, value, color }) {
  return (
    <div style={{ height: 6, background: t.border, borderRadius: 6, overflow: "hidden" }}>
      <div style={{ width: `${value}%`, height: "100%", background: color, borderRadius: 6, transition: "width .5s" }} />
    </div>
  );
}

// "what's behind the event" — problem → need → technology → components → companies → revenue
const BEHIND = {
  "בינה מלאכותית": { problem: "הביקוש לכוח מחשוב גדל מהר מקצב ההיצע", need: "יותר כוח מחשוב, חשמל וקירור",
    tech: ["מאיצי AI", "זיכרון HBM", "רשתות", "קירור", "חשמל", "מרכזי נתונים"], comp: ["שבבים", "זיכרון מהיר", "מתגים", "כבלים אופטיים", "שנאים", "שרתי AI"] },
  "מרכזי נתונים": { problem: "אין מספיק קיבולת, חשמל וקירור למרכזי נתונים", need: "בנייה והצטיידות של מרכזי נתונים",
    tech: ["שרתים", "קירור", "חשמל", "אחסון", "רשתות"], comp: ["שרתי AI", "מערכות קירור", "שנאים", "UPS", "אחסון נתונים"] },
  "שבבים": { problem: "מחסור בכושר ייצור שבבים מתקדמים", need: "יותר ייצור, ציוד ואריזה מתקדמת",
    tech: ["ייצור שבבים", "ציוד ליתוגרפיה", "אריזה מתקדמת", "זיכרון"], comp: ["מכונות ייצור", "פרוסות סיליקון", "זיכרון HBM"] },
  "ביטחון": { problem: "צורך גובר במערכות הגנה ותחמושת", need: "יותר טילים, חיישנים ותקשורת צבאית",
    tech: ["טילים", "מכ\"ם", "חיישנים", "תקשורת", "רחפנים", "סייבר"], comp: ["טילי יירוט", "מערכי מכ\"ם", "שבבים צבאיים", "רחפנים"] },
  "נפט": { problem: "אי-ודאות באספקת נפט וגז", need: "ייצוב אספקה והפקה",
    tech: ["הפקה", "זיקוק", "הולכה"], comp: ["ציוד קידוח", "צנרת", "מכליות"] },
  "אנרגיה": { problem: "עומס גובר על רשת החשמל", need: "יותר ייצור, הולכה ואגירה של חשמל",
    tech: ["טורבינות", "רשת ושנאים", "אגירה", "גרעין"], comp: ["טורבינות", "שנאי רשת", "סוללות", "דלק גרעיני"] },
  "קריפטו": { problem: "חוסר ודאות רגולטורית מעכב אימוץ", need: "ודאות רגולטורית ואימוץ מוסדי",
    tech: ["בורסות", "משמורת", "תשלומים", "סייבר"], comp: ["פלטפורמות מסחר", "ארנקים מוסדיים"] },
};
function behindFor(s) {
  for (const k of s.sectors) if (BEHIND[k]) return BEHIND[k];
  return { problem: `אירוע בתחום ${s.sectors[0] || "כללי"}`, need: `ביקוש אפשרי בסקטורים: ${s.sectors.join(", ")}`,
    tech: s.sectors.slice(0, 4), comp: s.connectedAssets.map((a) => a.symbol) };
}
function WhatsBehind({ t, s }) {
  const b = behindFor(s);
  const change = ((s.currentPrice - s.entryPrice) / s.entryPrice) * 100;
  const priced = Math.abs(change) >= 6;
  const early = ["רמז", "דעה", "הצהרה", "כוונה", "תוכנית"].includes(s.stage);
  const missing = early ? ["אישור תקציב", "בחירת ספק", "חתימת חוזה", "תחילת אספקה"]
    : ["חתימת חוזה", "הזמנה בפועל", "תחילת אספקה"];
  const chain = [
    ["אירוע", s.eventType], ["צורך", b.need], ["טכנולוגיה", b.tech.slice(0, 3).join(" · ")],
    ["רכיב", b.comp.slice(0, 3).join(" · ")], ["חברות", s.connectedAssets.map((a) => a.symbol).join(" · ")],
    ["הכנסה אפשרית", early ? "רחוקה — טרם חוזה" : "קרובה יותר"],
  ];
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "6px 0 10px" }}>
        <span style={{ fontSize: 20 }}>🧩</span>
        <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: t.text }}>מה מסתתר מאחורי האירוע?</h3>
      </div>
      <Card t={t} style={{ marginBottom: 10 }}>
        <div style={{ display: "grid", gap: 8, fontSize: 13.5 }}>
          <div><b style={{ color: t.text }}>הבעיה:</b> <span style={{ color: t.muted }}>{b.problem}</span></div>
          <div><b style={{ color: t.text }}>הצורך:</b> <span style={{ color: t.muted }}>{b.need}</span></div>
        </div>
        <div style={{ marginTop: 10, fontSize: 12, color: t.faint }}>טכנולוגיות נדרשות:</div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 5 }}>{b.tech.map((x) => <Chip key={x} t={t} color={t.accent2}>{x}</Chip>)}</div>
        <div style={{ marginTop: 10, fontSize: 12, color: t.faint }}>רכיבים נדרשים:</div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 5 }}>{b.comp.map((x) => <Chip key={x} t={t}>{x}</Chip>)}</div>
      </Card>

      {/* value chain diagram */}
      <Card t={t} style={{ marginBottom: 10 }}>
        <div style={{ fontWeight: 700, color: t.text, marginBottom: 10 }}>שרשרת הערך</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {chain.map(([label, val], i) => (
            <React.Fragment key={label}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ width: 90, fontSize: 11.5, color: t.faint, fontWeight: 600 }}>{label}</span>
                <span style={{ flex: 1, fontSize: 13, color: t.text, background: t.surface2, borderRadius: 8, padding: "7px 10px", border: `1px solid ${t.border}` }}>{val}</span>
              </div>
              {i < chain.length - 1 && <div style={{ color: t.accent, textAlign: "center", fontSize: 12, marginInlineStart: 100 }}>↓</div>}
            </React.Fragment>
          ))}
        </div>
      </Card>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <Card t={t}>
          <div style={{ fontSize: 12.5, fontWeight: 700, color: t.warn, marginBottom: 6 }}>מה חסר כדי להגיע להכנסה</div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>{missing.map((m) => <Chip key={m} t={t} color={t.warn}>{m}</Chip>)}</div>
        </Card>
        <Card t={t}>
          <div style={{ fontSize: 12.5, fontWeight: 700, color: t.text, marginBottom: 6 }}>מה השוק כבר תימחר</div>
          <div style={{ fontSize: 12.5, color: priced ? t.neg : t.pos }}>{priced ? `המחיר כבר זז ${pct(change)} — ייתכן שחלק מהאירוע כבר מגולם` : "המחיר כמעט לא הגיב — ייתכן שהאירוע טרם תומחר"}</div>
        </Card>
      </div>
    </div>
  );
}

function DeepInvestigation({ t, s, amount, go }) {
  const scored = useMemo(() => investigate(s, amount), [s.id, amount]);
  const top = scored.slice(0, 5);
  const pool = scored.slice(0, 8);
  const strongest = [...pool].sort((a, b) => b.directness - a.directness)[0];
  const notReacted = [...pool].sort((a, b) => Math.abs(a.changes.now) - Math.abs(b.changes.now))[0];
  const highestRisk = [...pool].sort((a, b) => b.risk - a.risk)[0];
  const hiddenSupplier = pool.filter((c) => ["ספק", "ספק רכיבים", "תשתית", "מוטב עקיף"].includes(c.role)).sort((a, b) => b.opportunity - a.opportunity)[0];
  const ranHot = [...pool].sort((a, b) => b.changes.now - a.changes.now)[0];
  const weakEvidence = !strongest || (strongest.directness < 0.5 && (top[0]?.opportunity ?? 0) < 50);
  const toConfirm = ["רמז", "דעה", "הצהרה", "כוונה", "תוכנית"].includes(s.stage)
    ? "נדרשת הודעה רשמית או אישור תקציב"
    : ["הצעת חוק", "אישור ממשלתי", "אישור תקציב", "מכרז"].includes(s.stage)
      ? "נדרש חוזה חתום או הזמנה בפועל" : "נדרש דיווח הכנסות בפועל";

  const highlight = (label, c, color, note) => c && (
    <Card t={t} style={{ borderColor: color + "55" }}>
      <div style={{ fontSize: 11.5, color, fontWeight: 700, marginBottom: 6 }}>{label}</div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div><div style={{ fontWeight: 800, color: t.text }}>{c.asset.symbol}</div><div style={{ fontSize: 11.5, color: t.muted }}>{c.role}</div></div>
        <div style={{ textAlign: "left" }}><div style={{ fontSize: 12.5, fontWeight: 700, color: c.changes.now >= 0 ? t.pos : t.neg }}>{arrow(c.changes.now)}{pct(c.changes.now)}</div><div style={{ fontSize: 10.5, color: t.faint }}>{note}</div></div>
      </div>
    </Card>
  );

  return (
    <div style={{ marginBottom: 6 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "6px 0 10px" }}>
        <span style={{ fontSize: 20 }}>🔍</span>
        <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: t.text }}>מה הציוץ באמת אומר לשוק?</h3>
      </div>
      <div style={{ fontSize: 13.5, color: t.muted, lineHeight: 1.6, marginBottom: 12 }}>
        {s.tmpl.sum} המערכת בדקה את כל שרשרת האספקה — לא רק את החברה הגדולה והברורה — ודירגה {scored.length} נכסים אפשריים.
      </div>

      {weakEvidence && (
        <Card t={t} style={{ marginBottom: 12, borderColor: t.warn + "66" }}>
          <div style={{ fontSize: 13, color: t.warn, fontWeight: 700 }}>לא נמצא כרגע קשר מספיק חזק למניה מסוימת.</div>
          <div style={{ fontSize: 12.5, color: t.muted, marginTop: 4 }}>הקשרים שלהלן חלשים או עקיפים ודורשים אישור נוסף לפני מסקנה.</div>
        </Card>
      )}

      {/* three highlight cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 10, marginBottom: 14 }}>
        {highlight("המניה עם הקשר החזק ביותר", strongest, t.pos, "קשר ישיר יותר")}
        {highlight("המניה שעדיין לא הגיבה", notReacted, t.accent, "השוק אולי טרם תימחר")}
        {highlight("המניה עם הסיכון הגבוה ביותר", highestRisk, t.neg, `סיכון ${highestRisk?.risk}/100`)}
      </div>

      {/* top 5 */}
      <SectionTitle t={t} title="5 המניות הרלוונטיות ביותר" sub="מדורגות לפי ציון הזדמנות" small />
      {top.map((c, i) => (
        <Card t={t} key={c.asset.id} style={{ marginBottom: 10 }}>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <div style={{ width: 26, height: 26, borderRadius: 8, background: t.chip, color: t.text, fontWeight: 800, fontSize: 13, display: "flex", alignItems: "center", justifyContent: "center", border: `1px solid ${t.border}` }}>{i + 1}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                <span style={{ fontWeight: 800, color: t.text }}>{c.asset.symbol}</span>
                <span style={{ fontSize: 12, color: t.muted }}>{c.asset.name}</span>
                <Chip t={t} color={t.accent2}>{c.role}</Chip>
                {c.alreadyReacted && <Chip t={t} color={t.warn}>כבר הגיב</Chip>}
              </div>
            </div>
          </div>

          <div style={{ fontSize: 12.5, color: t.muted, marginTop: 8, lineHeight: 1.6 }}>
            <b style={{ color: t.text }}>מה מספקת:</b> {c.supplies}<br />
            <b style={{ color: t.text }}>למה קשורה:</b> {c.why}
          </div>

          {/* scores */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, margin: "10px 0" }}>
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11.5, marginBottom: 3 }}><span style={{ color: t.faint }}>ציון הזדמנות</span><b style={{ color: SCORE_COLOR(t, c.opportunity) }}>{c.opportunity}/100</b></div>
              <ScoreBar t={t} value={c.opportunity} color={SCORE_COLOR(t, c.opportunity)} />
            </div>
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11.5, marginBottom: 3 }}><span style={{ color: t.faint }}>ציון סיכון</span><b style={{ color: RISK_COLOR(t, c.risk > 66 ? "גבוה" : c.risk > 40 ? "בינוני" : "נמוך") }}>{c.risk}/100</b></div>
              <ScoreBar t={t} value={c.risk} color={c.risk > 66 ? t.neg : c.risk > 40 ? t.warn : t.pos} />
            </div>
          </div>
          <div style={{ fontSize: 11.5, color: t.faint, marginBottom: 8 }}>רמת ביטחון: <b style={{ color: t.text }}>{c.confidenceLabel} ({c.confidencePct}%)</b></div>

          {/* price reaction row */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 6, marginBottom: 8 }}>
            {[["שעה", c.changes.h1], ["3 שע'", c.changes.h3], ["יום", c.changes.d1], ["שבוע", c.changes.d7]].map(([lbl, v]) => (
              <div key={lbl} style={{ textAlign: "center", background: t.surface2, borderRadius: 8, padding: "6px 3px", border: `1px solid ${t.border}` }}>
                <div style={{ fontSize: 10, color: t.faint }}>{lbl}</div>
                <div style={{ fontSize: 12, fontWeight: 700, color: v >= 0 ? t.pos : t.neg }}>{arrow(v)}{pct(v)}</div>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, borderTop: `1px solid ${t.border}`, paddingTop: 8 }}>
            <span style={{ color: t.muted }}>{money(c.entry)} → {money(c.current)}</span>
            <span style={{ color: t.muted }}>{money(amount)} → <b style={{ color: c.value200.pl >= 0 ? t.pos : t.neg }}>{money(c.value200.currentValue)}</b> ({arrow(c.value200.pl)}{signedMoney(c.value200.pl)})</span>
          </div>

          <div style={{ marginTop: 8, fontSize: 11.5, color: t.muted, lineHeight: 1.6 }}>
            <span style={{ color: t.pos }}>עשוי לעלות אם:</span> {c.upCat}<br />
            <span style={{ color: t.neg }}>עשוי לרדת אם:</span> {c.downCat}
          </div>
        </Card>
      ))}

      {/* conclusion */}
      <Card t={t} glow style={{ marginTop: 4 }}>
        <div style={{ fontWeight: 800, color: t.text, marginBottom: 10 }}>מסקנה פשוטה</div>
        <div style={{ display: "grid", gap: 8, fontSize: 13, lineHeight: 1.5 }}>
          <div><b style={{ color: t.text }}>מה עומד מאחורי הפרסום:</b> <span style={{ color: t.muted }}>{s.tmpl.sum}</span></div>
          <div><b style={{ color: t.text }}>איזה תחום עשוי ליהנות:</b> <span style={{ color: t.muted }}>{s.sectors.slice(0, 3).join(", ")}</span></div>
          {strongest && <div><b style={{ color: t.text }}>הנהנית הישירה:</b> <span style={{ color: t.muted }}>{strongest.asset.symbol} · {strongest.asset.name}</span></div>}
          {hiddenSupplier && <div><b style={{ color: t.text }}>ספקית נסתרת שעשויה ליהנות:</b> <span style={{ color: t.muted }}>{hiddenSupplier.asset.symbol} — {hiddenSupplier.supplies}</span></div>}
          <div><b style={{ color: t.text }}>מניה שאולי כבר עלתה יותר מדי:</b> <span style={{ color: t.muted }}>{ranHot && ranHot.changes.now >= 5 ? `${ranHot.asset.symbol} (${pct(ranHot.changes.now)})` : "אין מניה שעלתה בצורה קיצונית"}</span></div>
          {notReacted && <div><b style={{ color: t.text }}>מניה שעדיין לא הגיבה:</b> <span style={{ color: t.muted }}>{notReacted.asset.symbol} ({pct(notReacted.changes.now)})</span></div>}
          <div><b style={{ color: t.text }}>מה צריך לקרות כדי לאשר את הרמז:</b> <span style={{ color: t.muted }}>{toConfirm}</span></div>
        </div>
        <div style={{ marginTop: 10, fontSize: 11, color: t.faint }}>
          אלה תרחישים אפשריים בנתוני הדגמה — לא המלצה, לא הבטחת רווח, ולא הוכחה שהאדם גרם לתנועת המחיר.
        </div>
      </Card>
    </div>
  );
}

/* ----------------------------- providers (mock) ------------------------- */
const PROVIDERS = [
  { key: "XProvider", label: "X (Twitter) API", role: "פוסטים של אנשים במעקב", envKey: "X_API_BEARER_TOKEN" },
  { key: "GdeltProvider", label: "GDELT", role: "חדשות עולמיות ואירועים גיאופוליטיים", envKey: "—" },
  { key: "GoogleSearchProvider", label: "Google Custom Search", role: "מקורות משלימים ואימות", envKey: "GOOGLE_SEARCH_API_KEY" },
  { key: "SecEdgarProvider", label: "SEC EDGAR", role: "דיווחי 8-K / 10-Q / 10-K", envKey: "—" },
  { key: "CompanyNewsroomProvider", label: "Company Newsrooms", role: "חדרי חדשות והודעות לעיתונות", envKey: "—" },
  { key: "GovernmentSourcesProvider", label: "Government Sources", role: "אתרי ממשלה, בנקים מרכזיים, רגולציה", envKey: "—" },
  { key: "RSSProvider", label: "RSS / Atom", role: "קריאת פידים ומניעת כפילויות", envKey: "—" },
  { key: "MarketDataProvider", label: "Market Data", role: "מחירי מניות היסטוריים ותוך-יומיים", envKey: "MARKET_DATA_API_KEY" },
  { key: "CryptoMarketDataProvider", label: "Crypto Market Data", role: "מחירי קריפטו 24/7", envKey: "MARKET_DATA_API_KEY" },
  { key: "TranslationProvider", label: "Translation", role: "תרגום לעברית וזיהוי שפה", envKey: "TRANSLATION_API_KEY" },
  { key: "AIAnalysisProvider", label: "AI Analysis", role: "חילוץ ישויות, זיהוי אירוע וסקטור", envKey: "AI_API_KEY" },
];

/* ----------------------------- Themes ----------------------------------- */
const THEMES = {
  dark: {
    bg: "#0B1220", surface: "#111C2E", surface2: "#0E1728", border: "#1E2D44",
    text: "#E8EEF7", muted: "#8A9BB5", faint: "#5A6B85",
    accent: "#38E0C4", accent2: "#5B8DEF", pos: "#35D07F", neg: "#F2555A",
    warn: "#F5B841", chip: "#16233A", shadow: "0 8px 30px rgba(0,0,0,.35)",
  },
  light: {
    bg: "#F4F7FB", surface: "#FFFFFF", surface2: "#F0F4FA", border: "#E2E9F3",
    text: "#0F1B2E", muted: "#5A6B85", faint: "#93A2B8",
    accent: "#0FB59B", accent2: "#3B6FE0", pos: "#1E9E5F", neg: "#D93A40",
    warn: "#C98A0E", chip: "#EEF3FA", shadow: "0 8px 26px rgba(20,40,80,.08)",
  },
};
const RISK_COLOR = (t, r) => ({ "נמוך": t.pos, "בינוני": t.warn, "גבוה": t.neg, "קיצוני": "#B02A6E" }[r] || t.muted);
const SCORE_COLOR = (t, s) => s >= 80 ? t.accent : s >= 60 ? t.pos : s >= 40 ? t.warn : t.faint;
const VERIF_COLOR = (t, v) => ({ "מאומת": t.pos, "מאומת חלקית": t.accent2, "דורש בדיקה": t.warn, "שמועה": t.neg, "לא מאומת": t.faint }[v] || t.muted);
const TAG_COLOR = (t, tag) => ({ "קשר ישיר": t.pos, "קשר עקיף": t.accent2, "קשר חלש": t.warn, "לא נמצא קשר ברור": t.neg, "אין מספיק נתונים": t.faint }[tag] || t.muted);

/* ----------------------------- Small UI --------------------------------- */
function Chip({ children, color, t, onClick, active }) {
  return (
    <span onClick={onClick} style={{
      display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 10px",
      borderRadius: 999, fontSize: 12.5, fontWeight: 600,
      background: active ? color : t.chip, color: active ? "#06121f" : (color || t.muted),
      border: `1px solid ${active ? color : t.border}`, cursor: onClick ? "pointer" : "default",
      whiteSpace: "nowrap", transition: "all .15s",
    }}>{children}</span>
  );
}
function Card({ children, t, style, onClick, glow }) {
  return (
    <div onClick={onClick} style={{
      background: t.surface, border: `1px solid ${t.border}`, borderRadius: 18, padding: 18,
      boxShadow: glow ? `0 0 0 1px ${t.accent}22, ${t.shadow}` : t.shadow,
      cursor: onClick ? "pointer" : "default", transition: "transform .15s, border-color .15s", ...style,
    }}
      onMouseEnter={onClick ? (e) => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.borderColor = t.accent + "66"; } : undefined}
      onMouseLeave={onClick ? (e) => { e.currentTarget.style.transform = "none"; e.currentTarget.style.borderColor = t.border; } : undefined}
    >{children}</div>
  );
}
function Avatar({ person, size = 40, t }) {
  const initials = person.name.replace(/["']/g, "").split(" ").slice(0, 2).map((w) => w[0]).join("");
  const hue = (person.id * 47) % 360;
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%", flexShrink: 0,
      background: `linear-gradient(135deg, hsl(${hue} 55% 40%), hsl(${(hue + 40) % 360} 55% 30%))`,
      display: "flex", alignItems: "center", justifyContent: "center",
      color: "#fff", fontWeight: 800, fontSize: size * 0.36, border: `1px solid ${t.border}`,
    }}>{initials}</div>
  );
}
function ScoreDial({ score, t, size = 78 }) {
  const r = size / 2 - 7, c = 2 * Math.PI * r, off = c * (1 - score / 100), col = SCORE_COLOR(t, score);
  return (
    <div style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={t.border} strokeWidth={6} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={col} strokeWidth={6}
          strokeDasharray={c} strokeDashoffset={off} strokeLinecap="round" style={{ transition: "stroke-dashoffset .6s ease" }} />
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
        <div style={{ fontSize: size * 0.3, fontWeight: 800, color: col, lineHeight: 1 }}>{score}</div>
        <div style={{ fontSize: 9, color: t.faint }}>/ 100</div>
      </div>
    </div>
  );
}
function StatBig({ label, value, sub, color, t, arrow: ar, onClick }) {
  return (
    <Card t={t} onClick={onClick} style={{ minWidth: 0 }}>
      <div style={{ fontSize: 13, color: t.muted, marginBottom: 8, fontWeight: 600 }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 800, color: color || t.text, display: "flex", alignItems: "baseline", gap: 6 }}>
        {ar && <span style={{ fontSize: 16 }}>{ar}</span>}{value}
      </div>
      {sub && <div style={{ fontSize: 12.5, color: t.faint, marginTop: 6 }}>{sub}</div>}
    </Card>
  );
}
function MiniStat({ t, label, value, color }) {
  return (
    <div style={{ background: t.surface, border: `1px solid ${t.border}`, borderRadius: 12, padding: 12 }}>
      <div style={{ fontSize: 11.5, color: t.faint, marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 15, fontWeight: 700, color: color || t.text }}>{value}</div>
    </div>
  );
}
function SectionTitle({ t, title, sub, small }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <h2 style={{ fontSize: small ? 17 : 22, fontWeight: 800, color: t.text, margin: 0 }}>{title}</h2>
      {sub && <div style={{ fontSize: 13, color: t.faint, marginTop: 2 }}>{sub}</div>}
    </div>
  );
}
function BackBar({ t, onBack, label }) {
  return <button onClick={onBack} style={{ ...btnStyle(t), marginBottom: 12, background: "transparent" }}>→ {label}</button>;
}
function EmptyState({ t, text }) {
  return <div style={{ textAlign: "center", padding: 40, color: t.faint, fontSize: 14 }}>{text}</div>;
}

/* ============ FLAGSHIP: "מי אמר ומה קרה אחר כך" card ==================== */
function WhoSaidCard({ s, t, amount, go, historic }) {
  const pts = timelinePoints(s, amount);
  const nowPt = pts[pts.length - 1];
  const quick = [pts.find((p) => p.k === "h1"), pts.find((p) => p.k === "d1"), pts.find((p) => p.k === "d7"), nowPt];
  return (
    <Card t={t} onClick={() => go("signal", s)} style={{ marginBottom: 14 }}>
      {/* who */}
      <div style={{ display: "flex", gap: 12 }}>
        <Avatar person={s.person} t={t} size={48} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
            <span style={{ fontWeight: 800, color: t.text }}>{s.person.name}</span>
            {s.person.verified && <span style={{ color: t.accent2, fontSize: 13 }}>✓</span>}
          </div>
          <div style={{ fontSize: 12, color: t.muted }}>{s.person.role} · {s.person.company}{s.person.country ? ` · ${s.person.country}` : ""}</div>
          <div style={{ fontSize: 11.5, color: t.faint, marginTop: 2 }}>
            פורסם {s.published.toLocaleDateString("he-IL")} בשעה {s.published.toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" })} · {s.sourceType}
          </div>
        </div>
        <ScoreDial score={s.score} t={t} size={52} />
      </div>

      {/* what said */}
      <div style={{ marginTop: 12, padding: 12, background: t.surface2, borderRadius: 12, border: `1px solid ${t.border}` }}>
        <div style={{ fontSize: 11, color: t.faint, marginBottom: 3 }}>מה נאמר</div>
        <div style={{ fontSize: 14.5, color: t.text, fontWeight: 600, lineHeight: 1.5 }}>{s.tmpl.he}</div>
        <div style={{ fontSize: 12, color: t.muted, marginTop: 6 }}>המערכת הבינה: {s.tmpl.sum}</div>
      </div>

      {/* tags */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 10 }}>
        <Chip t={t} color={VERIF_COLOR(t, s.verif)}>{s.verif}</Chip>
        <Chip t={t} color={t.accent2}>{s.stage}</Chip>
        <Chip t={t} color={TAG_COLOR(t, s.tag)}>{s.tag}</Chip>
      </div>

      {/* related assets with why */}
      <div style={{ marginTop: 10 }}>
        <div style={{ fontSize: 11.5, color: t.faint, marginBottom: 5 }}>מניות ונכסים שנבדקו</div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {s.connectedAssets.map((a) => <Chip key={a.id} t={t}>{a.symbol}</Chip>)}
        </div>
      </div>

      {/* what happened strip */}
      <div style={{ marginTop: 12, borderTop: `1px solid ${t.border}`, paddingTop: 10 }}>
        <div style={{ fontSize: 11.5, color: t.faint, marginBottom: 8 }}>
          מה קרה ל־{money(amount)} · נכס מוביל {s.asset.symbol}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 6 }}>
          {quick.map((p) => (
            <div key={p.k} style={{ textAlign: "center", background: t.surface2, borderRadius: 10, padding: "8px 4px", border: `1px solid ${t.border}` }}>
              <div style={{ fontSize: 10.5, color: t.faint }}>{p.k === "h1" ? "שעה" : p.k === "d1" ? "יום" : p.k === "d7" ? "שבוע" : "היום"}</div>
              <div style={{ fontSize: 13.5, fontWeight: 800, color: p.pl >= 0 ? t.pos : t.neg }}>{money(p.value)}</div>
              <div style={{ fontSize: 10.5, color: p.pl >= 0 ? t.pos : t.neg }}>{arrow(p.change)}{pct(p.change)}</div>
            </div>
          ))}
        </div>
      </div>
      {historic && <div style={{ marginTop: 10, fontSize: 11, color: t.warn }}>שחזור להדגמה — לא ציטוט מאומת. זמן מדויק אינו זמין ולכן רמת הדיוק נמוכה יותר.</div>}
    </Card>
  );
}

/* ============================== Dashboard =============================== */
function Dashboard({ t, amount, setAmount, go, mode }) {
  const todaySignals = SIGNALS.filter((s) => (NOW - s.published) < DAYMS);
  const reacted = SIGNALS.filter((s) => { const m = reactionMetrics(s); return m.t1 && m.t1.mins <= 1440; });
  const strongest = [...SIGNALS].sort((a, b) => b.score - a.score)[0];
  const bestSignal = [...SIGNALS].sort((a, b) =>
    simulate(amount, b.entryPrice, b.currentPrice).plPct - simulate(amount, a.entryPrice, a.currentPrice).plPct)[0];
  const bestVal = simulate(amount, bestSignal.entryPrice, bestSignal.currentPrice);
  const feed = SIGNALS.slice(0, 6);

  return (
    <div>
      {/* hero */}
      <Card t={t} glow style={{ marginBottom: 16, position: "relative", overflow: "hidden", textAlign: "center" }}>
        <div className="radar-sweep" style={{ position: "absolute", inset: 0, opacity: 0.4, pointerEvents: "none" }} />
        <div style={{ position: "relative" }}>
          <div style={{ fontSize: 24, fontWeight: 900, letterSpacing: -0.4 }}>MARKET RADAR <span style={{ color: t.accent }}>AI</span></div>
          <div style={{ fontSize: 14.5, color: t.muted, marginTop: 4, fontWeight: 600 }}>מי אמר מה — ומה באמת קרה בשוק אחר כך</div>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, marginTop: 14, padding: "8px 16px", background: t.surface2, borderRadius: 14, border: `1px solid ${t.border}` }}>
            <span style={{ fontSize: 13, color: t.muted, fontWeight: 600 }}>סכום הסימולציה</span>
            <span style={{ color: t.accent, fontWeight: 900, fontSize: 22 }}>$</span>
            <input type="number" value={amount} min={1} onChange={(e) => setAmount(Math.max(1, Number(e.target.value) || 1))}
              style={{ width: 90, fontSize: 22, fontWeight: 900, color: t.text, background: "transparent", border: "none", borderBottom: `2px solid ${t.accent}`, outline: "none", fontFamily: "inherit", textAlign: "center" }} />
          </div>
          <div style={{ fontSize: 12, color: t.faint, marginTop: 8 }}>שנה את הסכום — כל המספרים באפליקציה יתעדכנו מיד. סימולציה לימודית בלבד.</div>
        </div>
      </Card>

      {/* 4 cards only */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12, marginBottom: 16 }}>
        <StatBig t={t} label="אמירות חדשות היום" value={fmtInt(todaySignals.length)} sub="פרסומים ב-24 השעות האחרונות" onClick={() => go("signals")} />
        <StatBig t={t} label="אירועים שהשוק כבר הגיב אליהם" value={fmtInt(reacted.length)} sub="תנועת מחיר של 1%+ ביום הראשון" color={t.warn} onClick={() => go("signals")} />
        <StatBig t={t} label="האות החזק ביותר כרגע" value={`${strongest.score}`} sub={`${strongest.person.name} · ${strongest.asset.symbol}`} color={t.accent} onClick={() => go("signal", strongest)} />
        <StatBig t={t} label={`שווי ${money(amount)} באות המוצלח ביותר`} value={money(bestVal.currentValue)} sub={`${arrow(bestVal.pl)} ${signedMoney(bestVal.pl)} · ${bestSignal.asset.symbol}`} color={t.pos} onClick={() => go("signal", bestSignal)} />
      </div>

      {/* what was said in the last half hour */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", margin: "6px 0 10px", flexWrap: "wrap", gap: 6 }}>
        <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: t.text }}>מה נאמר בחצי השעה האחרונה</h3>
        <span onClick={() => go("scans")} style={{ fontSize: 12, color: t.accent2, cursor: "pointer" }}>סריקות אחרונות ←</span>
      </div>
      {RECENT30.length === 0 ? (
        <Card t={t} style={{ marginBottom: 16 }}><div style={{ color: t.muted, fontSize: 13.5 }}>לא נמצאו פרסומים משמעותיים חדשים בחצי השעה האחרונה.</div></Card>
      ) : (
        <div style={{ marginBottom: 16 }}>
          {RECENT30.map((s) => (
            <Card t={t} key={s.id} style={{ marginBottom: 10 }}>
              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <Avatar person={s.person} t={t} size={38} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, color: t.text, fontSize: 13.5, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{s.person.name}</div>
                  <div style={{ fontSize: 12, color: t.muted, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{s.tmpl.sum}</div>
                </div>
                <Chip t={t} color={VERIF_COLOR(t, s.verif)}>{s.verif}</Chip>
              </div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8, alignItems: "center" }}>
                <Chip t={t}>{s.sourceType}</Chip>
                <Chip t={t} color={t.accent2}>{s.sectors[0]}</Chip>
                <Chip t={t}>{s.asset.symbol}</Chip>
                <Chip t={t} color={SCORE_COLOR(t, s.score)}>אות {s.score}</Chip>
                <button onClick={(e) => { e.stopPropagation(); go("signal", s); }} style={{ ...btnStyle(t), marginInlineStart: "auto", padding: "6px 12px", background: t.accent, color: "#06121f", border: "none", fontWeight: 700 }}>פתח חקירה מלאה</button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* flagship feed */}
      <SectionTitle t={t} title="מי אמר ומה קרה אחר כך" sub="האמירות האחרונות והתגובה שנצפתה בשוק" small />
      {feed.map((s) => <WhoSaidCard key={s.id} s={s} t={t} amount={amount} go={go} />)}

      <button onClick={() => go("signals")} style={{ ...btnStyle(t), width: "100%", justifyContent: "center", display: "flex", marginTop: 4 }}>
        לכל האותות ←
      </button>
    </div>
  );
}

/* ============================== Signals ================================= */
function Signals({ t, amount, go }) {
  const [cat, setCat] = useState("הכל");
  const [risk, setRisk] = useState("הכל");
  const [strongOnly, setStrongOnly] = useState(false);
  const [q, setQ] = useState("");
  const cats = ["הכל", "פוליטיקאי", "מנכ\"ל", "משקיע", "קריפטו", "בנקאי מרכזי"];
  const risks = ["הכל", "נמוך", "בינוני", "גבוה", "קיצוני"];
  const filtered = SIGNALS.filter((s) => {
    if (cat !== "הכל" && s.person.category !== cat) return false;
    if (risk !== "הכל" && s.risk !== risk) return false;
    if (strongOnly && s.score < 60) return false;
    if (q && !(s.person.name.includes(q) || s.asset.symbol.toLowerCase().includes(q.toLowerCase()) || s.topic.includes(q))) return false;
    return true;
  });
  return (
    <div>
      <SectionTitle t={t} title="אותות עכשיו" sub={`${filtered.length} אותות · מסודרים לפי זמן`} />
      <input placeholder="חיפוש לפי שם, מניה או נושא…" value={q} onChange={(e) => setQ(e.target.value)} style={inputStyle(t)} />
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", margin: "10px 0" }}>
        {cats.map((c) => <Chip key={c} t={t} color={t.accent} active={cat === c} onClick={() => setCat(c)}>{c}</Chip>)}
      </div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 14, alignItems: "center" }}>
        {risks.map((r) => <Chip key={r} t={t} color={RISK_COLOR(t, r === "הכל" ? null : r) || t.muted} active={risk === r} onClick={() => setRisk(r)}>{r === "הכל" ? "כל הסיכונים" : r}</Chip>)}
        <Chip t={t} color={t.accent} active={strongOnly} onClick={() => setStrongOnly(!strongOnly)}>רק אותות חזקים (60+)</Chip>
      </div>
      {filtered.slice(0, 50).map((s) => <WhoSaidCard key={s.id} s={s} t={t} amount={amount} go={go} />)}
      {filtered.length === 0 && <EmptyState t={t} text="אין כרגע מספיק מידע מאומת לפי הסינון שבחרת." />}
    </div>
  );
}

/* ============================ Signal detail ============================= */
function ThreeLayers({ t, s }) {
  const layers = [
    ["שכבה 1 · מה נאמר", s.tmpl.he, t.accent2],
    ["שכבה 2 · על מה זה עשוי להשפיע", `${s.tmpl.sum} סקטורים אפשריים: ${s.sectors.slice(0, 3).join(", ")}.`, t.warn],
    ["שכבה 3 · מה קרה למחירים בפועל", `לאחר הפרסום נצפתה תנועה במחיר ${s.asset.symbol}. קשר בזמן אינו הוכחת סיבתיות.`, t.pos],
  ];
  return (
    <div style={{ display: "grid", gap: 8, marginBottom: 14 }}>
      {layers.map(([title, body, col]) => (
        <div key={title} style={{ background: t.surface, border: `1px solid ${t.border}`, borderInlineStart: `3px solid ${col}`, borderRadius: 12, padding: 12 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: col, marginBottom: 3 }}>{title}</div>
          <div style={{ fontSize: 13.5, color: t.text, lineHeight: 1.5 }}>{body}</div>
        </div>
      ))}
    </div>
  );
}
function TimelineTable({ t, s, amount }) {
  const [mode, setMode] = useState("value"); // 'price' | 'value'
  const pts = timelinePoints(s, amount);
  const chartData = pts.map((p) => ({ label: p.label.replace("אחרי ", ""), price: p.price, value: Math.round(p.value * 100) / 100 }));
  return (
    <Card t={t} style={{ marginBottom: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
        <div style={{ fontWeight: 700, color: t.text }}>מה קרה למחיר לאחר הפרסום</div>
        <div style={{ display: "flex", gap: 6 }}>
          <Chip t={t} color={t.accent} active={mode === "price"} onClick={() => setMode("price")}>מחיר המניה</Chip>
          <Chip t={t} color={t.accent} active={mode === "value"} onClick={() => setMode("value")}>שווי {money(amount)}</Chip>
        </div>
      </div>
      <div style={{ height: 220 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 6, right: 8, left: 8, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={t.border} />
            <XAxis dataKey="label" tick={{ fill: t.faint, fontSize: 10 }} reversed />
            <YAxis tick={{ fill: t.faint, fontSize: 11 }} width={46} domain={["auto", "auto"]} />
            <Tooltip contentStyle={{ background: t.surface, border: `1px solid ${t.border}`, borderRadius: 10, color: t.text, direction: "rtl" }}
              formatter={(v) => [money(v), mode === "price" ? "מחיר" : "שווי"]} />
            {mode === "value" && <ReferenceLine y={amount} stroke={t.faint} strokeDasharray="4 4" />}
            <Line type="monotone" dataKey={mode} stroke={t.accent} strokeWidth={2.4} dot={{ r: 3, fill: t.accent }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      {/* vertical rows for mobile clarity */}
      <div style={{ marginTop: 12, display: "grid", gap: 6 }}>
        {pts.map((p) => (
          <div key={p.k} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", background: t.surface2, borderRadius: 10, border: `1px solid ${t.border}` }}>
            <div style={{ width: 96, fontSize: 12.5, color: t.muted, fontWeight: 600 }}>{p.label}</div>
            <div style={{ flex: 1, fontSize: 13, color: t.text }}>{money(p.price)}</div>
            <div style={{ width: 64, fontSize: 12.5, color: p.change >= 0 ? t.pos : t.neg, fontWeight: 700, textAlign: "center" }}>{arrow(p.change)}{pct(p.change)}</div>
            <div style={{ width: 78, fontSize: 12.5, color: p.pl >= 0 ? t.pos : t.neg, fontWeight: 700, textAlign: "left" }}>{money(p.value)}</div>
            {p.volAnomaly && <span title="מחזור חריג" style={{ fontSize: 11, color: t.warn }}>◆</span>}
          </div>
        ))}
      </div>
      <div style={{ fontSize: 11, color: t.faint, marginTop: 8 }}>◆ = מחזור מסחר חריג בנקודת הזמן.</div>
    </Card>
  );
}
function ReactionPanel({ t, s }) {
  const m = reactionMetrics(s);
  const rows = [
    ["תנועה ראשונה של 1%", m.t1 ? `${m.t1.label.replace("אחרי ", "")}` : "לא נצפתה"],
    ["תנועה של 3%", m.t3 ? `${m.t3.label.replace("אחרי ", "")}` : "לא נצפתה"],
    ["תנועה של 5%", m.t5 ? `${m.t5.label.replace("אחרי ", "")}` : "לא נצפתה"],
    ["זמן עד לשיא", m.peak.label.replace("אחרי ", "")],
    ["זמן עד לשפל", m.trough.label.replace("אחרי ", "")],
    ["תשואה מקסימלית", pct(m.maxRet)],
    ["הפסד מקסימלי", pct(m.maxLoss)],
  ];
  const conclusion = m.startedBefore
    ? "חלק מהתנועה החל עוד לפני הפרסום — ייתכן שהשוק כבר תמחר את המידע."
    : m.erased ? "המחיר עלה לאחר האירוע, אך חלק מהעלייה נמחק בהמשך."
      : m.gainHeld ? "המחיר עלה לאחר האירוע ורוב העלייה נשמרה עד היום."
        : m.maxRet < 1 ? "לא נצפתה תנועה משמעותית לאחר הפרסום." : "נצפתה תנועה מעורבת לאחר האירוע.";
  return (
    <Card t={t} style={{ marginBottom: 14 }}>
      <div style={{ fontWeight: 700, color: t.text, marginBottom: 10 }}>כמה זמן לקח לשוק להגיב</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(130px,1fr))", gap: 8 }}>
        {rows.map(([k, v], i) => (
          <div key={i} style={{ background: t.surface2, borderRadius: 10, padding: 10, border: `1px solid ${t.border}` }}>
            <div style={{ fontSize: 11, color: t.faint }}>{k}</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: t.text }}>{v}</div>
          </div>
        ))}
      </div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 10 }}>
        <Chip t={t} color={m.startedBefore ? t.warn : t.pos}>{m.startedBefore ? "התנועה החלה לפני הפרסום" : "התנועה החלה אחרי הפרסום"}</Chip>
        <Chip t={t} color={m.gainHeld ? t.pos : t.neg}>{m.gainHeld ? "העלייה נשמרה" : m.erased ? "העלייה נמחקה" : "ללא עלייה מובהקת"}</Chip>
        {m.returnedToEntry && <Chip t={t} color={t.faint}>המחיר חזר למחיר הכניסה</Chip>}
      </div>
      <div style={{ marginTop: 10, fontSize: 13, color: t.muted, lineHeight: 1.6 }}>מסקנה: {conclusion}</div>
    </Card>
  );
}
function SignalDetail({ s, t, amount, go }) {
  const sim = simulate(amount, s.entryPrice, s.currentPrice);
  const confidencePct = s.score;
  const section = (n, title) => (
    <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "18px 0 8px" }}>
      <span style={{ width: 22, height: 22, borderRadius: 7, background: t.accent, color: "#06121f", fontSize: 12, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{n}</span>
      <span style={{ fontWeight: 700, color: t.text }}>{title}</span>
    </div>
  );
  return (
    <div>
      <BackBar t={t} onBack={() => go("signals")} label="חזרה לאותות" />
      <div className="demo-inline">דוגמה בדיונית לצורכי הדגמה בלבד — לא ציטוט אמיתי</div>

      <ThreeLayers t={t} s={s} />

      <WhatsBehind t={t} s={s} />

      <DeepInvestigation t={t} s={s} amount={amount} go={go} />

      {section("1", "מי אמר")}
      <Card t={t}>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <Avatar person={s.person} t={t} size={52} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 800, fontSize: 17, color: t.text }}>{s.person.name}</div>
            <div style={{ fontSize: 13, color: t.muted }}>תפקיד בזמן הפרסום: {s.person.role}</div>
            <div style={{ fontSize: 12.5, color: t.faint }}>{s.person.company} · {s.person.country}</div>
            <div style={{ fontSize: 12, color: t.faint, marginTop: 2 }}>{s.published.toLocaleString("he-IL")}</div>
          </div>
          <ScoreDial score={s.score} t={t} />
        </div>
      </Card>

      {section("2", "מה נאמר")}
      <Card t={t}>
        <div style={{ fontSize: 11.5, color: t.faint, marginBottom: 4 }}>הטקסט המקורי</div>
        <div style={{ fontSize: 14, color: t.text, direction: "ltr", textAlign: "left", marginBottom: 10 }}>{s.tmpl.txt}</div>
        <div style={{ fontSize: 11.5, color: t.faint, marginBottom: 4 }}>תרגום לעברית</div>
        <div style={{ fontSize: 15, color: t.text, fontWeight: 600, marginBottom: 8 }}>{s.tmpl.he}</div>
        <div style={{ fontSize: 12.5, color: t.muted }}>תקציר: {s.tmpl.sum}</div>
      </Card>

      {section("3", "מאיפה המידע הגיע")}
      <Card t={t}>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
          <Chip t={t} color={t.accent2}>{s.sourceType}</Chip>
          <Chip t={t} color={s.hasOfficial ? t.pos : t.faint}>{s.hasOfficial ? "מקור רשמי" : "מקור משני"}</Chip>
        </div>
        <a href="#" onClick={(e) => e.preventDefault()} style={{ color: t.accent2, fontSize: 12.5, textDecoration: "none" }}>🔗 קישור למקור (דמו — יוחלף במקור אמיתי בחיבור Provider)</a>
      </Card>

      {section("4", "האם המקור מאומת")}
      <Card t={t}>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
          <Chip t={t} color={VERIF_COLOR(t, s.verif)}>{s.verif}</Chip>
          <Chip t={t} color={TAG_COLOR(t, s.tag)}>{s.tag}</Chip>
        </div>
        <div style={{ fontSize: 12, color: t.faint, marginBottom: 6 }}>לוח ראיות</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(120px,1fr))", gap: 6 }}>
          {[["מקור ראשוני", s.hasOfficial], ["מקור רשמי", s.hasOfficial], ["מקור שני", s.confirmations > 0], ["דיווח חברה", s.confirmations > 1], ["מסמך ממשלתי", s.eventType.includes("ממשלתי") || s.eventType.includes("תקציב")], ["אישור נוסף", s.confirmations > 0], ["מחיר שוק", true], ["הכחשה אפשרית", false]].map(([label, on]) => (
            <div key={label} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: on ? t.text : t.faint }}>
              <span style={{ color: on ? t.pos : t.faint }}>{on ? "✓" : "○"}</span>{label}
            </div>
          ))}
        </div>
      </Card>

      {section("5", "מה המערכת הבינה")}
      <Card t={t}>
        <p style={{ fontSize: 14, color: t.muted, lineHeight: 1.7, margin: 0 }}>
          {s.person.name} דיבר על {s.topic}. {s.tmpl.sum} אם המהלך יתממש, הביקוש בסקטורים הקשורים עשוי לעלות.
          כרגע מדובר בשלב "{s.stage}" — לא בהכנסה בפועל.
        </p>
      </Card>

      {section("6", "אילו סקטורים קשורים")}
      <Card t={t}>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>{s.sectors.map((sec) => <Chip key={sec} t={t} color={t.accent2}>{sec}</Chip>)}</div>
      </Card>

      {section("7", "אילו חברות קשורות · ומדוע")}
      <Card t={t}>
        <div style={{ display: "grid", gap: 8 }}>
          {s.connectedAssets.map((a) => {
            const conf = 60 + ((a.id * 7) % 35);
            return (
              <div key={a.id} style={{ padding: 10, background: t.surface2, borderRadius: 10, border: `1px solid ${t.border}` }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontWeight: 700, color: t.text }}>{a.symbol} · {a.name}</span>
                  <Chip t={t} color={SCORE_COLOR(t, conf)}>ביטחון {conf}%</Chip>
                </div>
                <div style={{ fontSize: 12.5, color: t.muted, marginTop: 4 }}>{a.name} פועלת בתחום {a.sector}, שקשור ישירות לאירוע "{s.eventType}".</div>
              </div>
            );
          })}
        </div>
      </Card>

      {section("8", "מה קרה למחיר · ציר זמן")}
      <TimelineTable t={t} s={s} amount={amount} />

      {section("9", `מה היה קורה ל־${money(amount)}`)}
      <Card t={t}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(110px,1fr))", gap: 8 }}>
          <MiniStat t={t} label="מחיר בזמן האות" value={money(s.entryPrice)} />
          <MiniStat t={t} label="מחיר נוכחי" value={money(s.currentPrice)} />
          <MiniStat t={t} label="יחידות מדומות" value={sim.units.toFixed(4)} />
          <MiniStat t={t} label="שווי נוכחי" value={money(sim.currentValue)} />
          <MiniStat t={t} label="רווח / הפסד" value={signedMoney(sim.pl)} color={sim.pl >= 0 ? t.pos : t.neg} />
          <MiniStat t={t} label="תשואה" value={pct(sim.plPct)} color={sim.plPct >= 0 ? t.pos : t.neg} />
        </div>
      </Card>

      {section("10", "כמה זמן לקח לשוק להגיב")}
      <ReactionPanel t={t} s={s} />

      {section("11", "מה יכול לאשר · ומה יכול לבטל")}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 4 }}>
        <Card t={t} style={{ borderColor: t.pos + "44" }}>
          <div style={{ fontSize: 12.5, fontWeight: 700, color: t.pos, marginBottom: 6 }}>מה יכול לאשר</div>
          <div style={{ fontSize: 12.5, color: t.muted, lineHeight: 1.7 }}>הודעה רשמית · אישור תקציב · חוזה חתום · הזמנה · עלייה בהכנסות</div>
        </Card>
        <Card t={t} style={{ borderColor: t.neg + "44" }}>
          <div style={{ fontSize: 12.5, fontWeight: 700, color: t.neg, marginBottom: 6 }}>מה יכול לבטל</div>
          <div style={{ fontSize: 12.5, color: t.muted, lineHeight: 1.7 }}>הכחשה · ביטול תוכנית · בעיה רגולטורית · דוח חלש · המחיר כבר עלה יותר מדי</div>
        </Card>
      </div>

      {section("12", "סיכון וביטחון")}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <MiniStat t={t} label="רמת סיכון" value={s.risk} color={RISK_COLOR(t, s.risk)} />
        <MiniStat t={t} label="רמת ביטחון" value={`${confidencePct}% · ${scoreLabel(s.score)}`} color={SCORE_COLOR(t, s.score)} />
      </div>

      <div style={{ marginTop: 14, padding: 10, background: t.surface2, borderRadius: 10, fontSize: 12, color: t.faint, border: `1px solid ${t.border}` }}>
        נמצא קשר בזמן בין הפרסום לבין תנועת המחיר. הדבר אינו מוכיח שהפרסום לבדו גרם לתנועה. סימולציה לימודית בלבד — אין מסחר אמיתי.
      </div>
    </div>
  );
}

/* ============================== People ================================= */
function People({ t, amount, go }) {
  const [q, setQ] = useState(""); const [country, setCountry] = useState("הכל");
  const [cat, setCat] = useState("הכל"); const [favOnly, setFavOnly] = useState(false);
  const countries = ["הכל", ...Array.from(new Set(PEOPLE.map((p) => p.country)))];
  const cats = ["הכל", ...Array.from(new Set(PEOPLE.map((p) => p.category)))];
  const filtered = PEOPLE.filter((p) => {
    if (q && !p.name.includes(q) && !p.company.includes(q)) return false;
    if (country !== "הכל" && p.country !== country) return false;
    if (cat !== "הכל" && p.category !== cat) return false;
    if (favOnly && !p.favorite) return false;
    return true;
  });
  return (
    <div>
      <SectionTitle t={t} title="אנשים במעקב" sub={`${filtered.length} מתוך ${PEOPLE.length} אישים`} />
      <input placeholder="חיפוש לפי שם או חברה…" value={q} onChange={(e) => setQ(e.target.value)} style={inputStyle(t)} />
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", margin: "10px 0" }}>
        <select value={country} onChange={(e) => setCountry(e.target.value)} style={selectStyle(t)}>{countries.map((c) => <option key={c}>{c}</option>)}</select>
        <select value={cat} onChange={(e) => setCat(e.target.value)} style={selectStyle(t)}>{cats.map((c) => <option key={c}>{c}</option>)}</select>
        <Chip t={t} color={t.warn} active={favOnly} onClick={() => setFavOnly(!favOnly)}>⭐ מועדפים בלבד</Chip>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 12 }}>
        {filtered.map((p) => {
          const st = personStats(p, amount);
          return (
            <Card key={p.id} t={t} onClick={() => go("person", p)}>
              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <Avatar person={p} t={t} size={46} />
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ fontWeight: 700, color: t.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.name}</span>
                    {p.verified && <span title="מאומת" style={{ color: t.accent2, fontSize: 13 }}>✓</span>}
                    {p.favorite && <span style={{ color: t.warn, fontSize: 12 }}>⭐</span>}
                  </div>
                  <div style={{ fontSize: 12, color: t.muted, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.role} · {p.country}</div>
                </div>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 12, fontSize: 12.5 }}>
                <div><div style={{ color: t.faint }}>אותות</div><div style={{ fontWeight: 700, color: t.text }}>{st.count}</div></div>
                <div><div style={{ color: t.faint }}>הצלחה</div><div style={{ fontWeight: 700, color: t.text }}>{st.winRate.toFixed(0)}%</div></div>
                <div><div style={{ color: t.faint }}>תשואה ממוצעת</div><div style={{ fontWeight: 700, color: st.avgPct >= 0 ? t.pos : t.neg }}>{pct(st.avgPct)}</div></div>
              </div>
            </Card>
          );
        })}
      </div>
      {filtered.length === 0 && <EmptyState t={t} text="לא נמצאו אנשים לפי הסינון." />}
    </div>
  );
}
function PersonDetail({ p, t, amount, go }) {
  const st = personStats(p, amount);
  const links = [["אתר רשמי", p.website], ["X", p.x], ["LinkedIn", p.linkedin], ["YouTube", p.youtube]];
  return (
    <div>
      <BackBar t={t} onBack={() => go("people")} label="חזרה לאנשים" />
      <Card t={t} style={{ marginBottom: 14 }}>
        <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
          <Avatar person={p} t={t} size={64} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 20, fontWeight: 800, color: t.text }}>{p.name}</span>
              {p.verified && <Chip t={t} color={t.accent2}>מאומת ✓</Chip>}
            </div>
            <div style={{ fontSize: 13.5, color: t.muted, marginTop: 2 }}>{p.role} · {p.company}</div>
            <div style={{ fontSize: 12.5, color: t.faint, marginTop: 2 }}>{p.country} · {p.industry} · חשיבות {p.importance}/100</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
          {links.map(([lbl, url]) => (<a key={lbl} href={url} onClick={(e) => e.preventDefault()} style={{ fontSize: 12.5, color: t.accent2, textDecoration: "none", padding: "5px 10px", background: t.chip, borderRadius: 8, border: `1px solid ${t.border}` }}>{lbl} ↗</a>))}
        </div>
        <div style={{ marginTop: 12, fontSize: 12, color: t.faint }}>תפקיד נוכחי מאז {p.roleStart} · עודכן לאחרונה {p.lastVerified}</div>
      </Card>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(120px,1fr))", gap: 10, marginBottom: 14 }}>
        <MiniStat t={t} label="אותות" value={st.count} />
        <MiniStat t={t} label="רווחיים" value={st.wins} color={t.pos} />
        <MiniStat t={t} label="מפסידים" value={st.losses} color={t.neg} />
        <MiniStat t={t} label="אחוז הצלחה" value={`${st.winRate.toFixed(0)}%`} />
        <MiniStat t={t} label="תשואה ממוצעת" value={pct(st.avgPct)} color={st.avgPct >= 0 ? t.pos : t.neg} />
        <MiniStat t={t} label={`רווח מצטבר (${money(amount)})`} value={signedMoney(st.totalPL)} color={st.totalPL >= 0 ? t.pos : t.neg} />
      </div>
      {st.best && st.worst && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
          <Card t={t} onClick={() => go("signal", st.best.s)}>
            <div style={{ fontSize: 12, color: t.faint }}>האות החזק ביותר</div>
            <div style={{ fontWeight: 700, color: t.text, marginTop: 4 }}>{st.best.s.asset.symbol}</div>
            <div style={{ color: t.pos, fontWeight: 700 }}>{arrow(1)}{pct(st.best.pct)}</div>
          </Card>
          <Card t={t} onClick={() => go("signal", st.worst.s)}>
            <div style={{ fontSize: 12, color: t.faint }}>האות החלש ביותר</div>
            <div style={{ fontWeight: 700, color: t.text, marginTop: 4 }}>{st.worst.s.asset.symbol}</div>
            <div style={{ color: st.worst.pct >= 0 ? t.pos : t.neg, fontWeight: 700 }}>{arrow(st.worst.pct)}{pct(st.worst.pct)}</div>
          </Card>
        </div>
      )}
      <SectionTitle t={t} title="כל האותות של האדם" sub={`${st.sigs.length} אותות`} small />
      {st.sigs.slice(0, 15).map((s) => <WhoSaidCard key={s.id} s={s} t={t} amount={amount} go={go} />)}
    </div>
  );
}

/* ============================== Simulator =============================== */
function Simulator({ t, amount, setAmount, go }) {
  const [signalId, setSignalId] = useState(SIGNALS[0].id);
  const s = SIGNALS.find((x) => x.id === Number(signalId));
  const [range, setRange] = useState("now");
  const rangeIdx = s.path.findIndex((p) => p.k === range);
  const endPrice = s.path[rangeIdx].price;
  const sim = simulate(amount, s.entryPrice, endPrice);
  const chartData = s.path.slice(0, rangeIdx + 1).map((p) => ({ label: p.label, value: Math.round(simulate(amount, s.entryPrice, p.price).currentValue * 100) / 100 }));
  const allValues = s.path.map((p) => simulate(amount, s.entryPrice, p.price).currentValue);
  const peak = Math.max(...allValues), trough = Math.min(...allValues);
  const m = reactionMetrics(s);
  const rows = [["h1", "אחרי שעה"], ["h3", "אחרי 3 שעות"], ["d1", "אחרי יום"], ["d7", "אחרי שבוע"], ["d30", "אחרי חודש"], ["now", "היום"]];
  return (
    <div>
      <SectionTitle t={t} title="מה היה קורה ל־$200" sub="בחר אות, סכום וטווח זמן" />
      <Card t={t} style={{ marginBottom: 14 }}>
        <label style={labelStyle(t)}>בחר אות</label>
        <select value={signalId} onChange={(e) => setSignalId(e.target.value)} style={{ ...selectStyle(t), width: "100%" }}>
          {SIGNALS.slice(0, 80).map((x) => <option key={x.id} value={x.id}>{x.person.name} · {x.asset.symbol} · {x.topic}</option>)}
        </select>
        <div style={{ marginTop: 12 }}>
          <label style={labelStyle(t)}>סכום השקעה</label>
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <span style={{ color: t.accent, fontWeight: 800, fontSize: 18 }}>$</span>
            <input type="number" value={amount} min={1} onChange={(e) => setAmount(Math.max(1, Number(e.target.value) || 1))} style={{ ...inputStyle(t), width: 110, margin: 0 }} />
          </div>
        </div>
        <label style={{ ...labelStyle(t), marginTop: 12 }}>טווח זמן</label>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {s.path.slice(1).map((p) => <Chip key={p.k} t={t} color={t.accent} active={range === p.k} onClick={() => setRange(p.k)}>{p.label}</Chip>)}
        </div>
      </Card>
      <Card t={t} glow style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 13, color: t.muted, marginBottom: 8 }}>אם היית משקיע {money(amount)} בזמן פרסום האות:</div>
        {rows.map(([k, lbl]) => {
          const price = s.path.find((p) => p.k === k).price;
          const v = simulate(amount, s.entryPrice, price).currentValue;
          return (
            <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "7px 0", borderTop: `1px solid ${t.border}` }}>
              <span style={{ color: t.muted, fontSize: 13.5 }}>{lbl}</span>
              <span style={{ fontWeight: 700, color: v >= amount ? t.pos : t.neg }}>{money(v)}</span>
            </div>
          );
        })}
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 12, paddingTop: 10, borderTop: `2px solid ${t.accent}` }}>
          <span style={{ color: t.text, fontWeight: 700 }}>רווח נוכחי · תשואה</span>
          <span style={{ fontWeight: 800, color: sim.pl >= 0 ? t.pos : t.neg }}>{arrow(sim.pl)}{signedMoney(sim.pl)} · {pct(sim.plPct)}</span>
        </div>
      </Card>
      <Card t={t} style={{ marginBottom: 14 }}>
        <div style={{ fontWeight: 700, color: t.text, marginBottom: 10 }}>ערך ההשקעה לאורך זמן</div>
        <div style={{ height: 240 }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 6, right: 8, left: 8, bottom: 0 }}>
              <defs><linearGradient id="g2" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={sim.pl >= 0 ? t.pos : t.neg} stopOpacity={0.32} /><stop offset="100%" stopColor={sim.pl >= 0 ? t.pos : t.neg} stopOpacity={0} /></linearGradient></defs>
              <CartesianGrid strokeDasharray="3 3" stroke={t.border} />
              <XAxis dataKey="label" tick={{ fill: t.faint, fontSize: 10 }} reversed />
              <YAxis tick={{ fill: t.faint, fontSize: 11 }} width={44} domain={["auto", "auto"]} />
              <Tooltip contentStyle={{ background: t.surface, border: `1px solid ${t.border}`, borderRadius: 10, color: t.text, direction: "rtl" }} formatter={(v) => [money(v), "שווי"]} />
              <ReferenceLine y={amount} stroke={t.faint} strokeDasharray="4 4" />
              <Area type="monotone" dataKey="value" stroke={sim.pl >= 0 ? t.pos : t.neg} strokeWidth={2.4} fill="url(#g2)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Card>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))", gap: 10 }}>
        <MiniStat t={t} label="השיא הגבוה ביותר" value={money(peak)} color={t.pos} />
        <MiniStat t={t} label="הירידה החדה ביותר" value={money(trough)} color={t.neg} />
        <MiniStat t={t} label="זמן עד רווח ראשון" value={m.t1 ? m.t1.label.replace("אחרי ", "") : "טרם"} />
        <MiniStat t={t} label="האם התוצאה חיובית" value={sim.pl >= 0 ? "כן ✓" : "לא ✗"} color={sim.pl >= 0 ? t.pos : t.neg} />
        <MiniStat t={t} label="האם העלייה נמחקה" value={m.erased ? "כן, נשחקה" : "לא"} />
      </div>
    </div>
  );
}

/* ============================== Sectors ================================= */
function Sectors({ t, amount, go }) {
  const data = SECTORS.map((sec) => ({ name: sec.name, ...sectorStats(sec.name, amount) })).filter((s) => s.count > 0).sort((a, b) => b.avgPct - a.avgPct);
  return (
    <div>
      <SectionTitle t={t} title="סקטורים" sub={`${data.length} סקטורים פעילים`} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(260px,1fr))", gap: 12 }}>
        {data.map((sec) => (
          <Card key={sec.name} t={t} onClick={() => sec.last && go("signal", sec.last)}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontWeight: 800, fontSize: 16, color: t.text }}>{sec.name}</span>
              <Chip t={t} color={SCORE_COLOR(t, sec.avgScore)}>ציון {sec.avgScore.toFixed(0)}</Chip>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 12, fontSize: 12.5 }}>
              <div><div style={{ color: t.faint }}>אותות היום</div><div style={{ fontWeight: 700, color: t.text }}>{sec.today}</div></div>
              <div><div style={{ color: t.faint }}>שינוי ממוצע</div><div style={{ fontWeight: 700, color: sec.avgPct >= 0 ? t.pos : t.neg }}>{arrow(sec.avgPct)}{pct(sec.avgPct)}</div></div>
              <div><div style={{ color: t.faint }}>רווח $ ({amount})</div><div style={{ fontWeight: 700, color: sec.totalPL >= 0 ? t.pos : t.neg }}>{signedMoney(sec.totalPL)}</div></div>
            </div>
            {sec.topPerson && <div style={{ marginTop: 10, fontSize: 12, color: t.muted }}>המשפיע ביותר: <b style={{ color: t.text }}>{sec.topPerson.name}</b></div>}
          </Card>
        ))}
      </div>
    </div>
  );
}

/* ============================== Assets ================================== */
function Assets({ t, amount }) {
  const [tab, setTab] = useState("stock"); const [q, setQ] = useState("");
  const list = ASSETS.filter((a) => a.type === tab && (!q || a.symbol.toLowerCase().includes(q.toLowerCase()) || a.name.toLowerCase().includes(q.toLowerCase())));
  return (
    <div>
      <SectionTitle t={t} title="מניות וקריפטו" sub={`${ASSETS.filter((a) => a.type === "stock").length} מניות · ${ASSETS.filter((a) => a.type === "crypto").length} מטבעות`} />
      <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
        <Chip t={t} color={t.accent} active={tab === "stock"} onClick={() => setTab("stock")}>מניות</Chip>
        <Chip t={t} color={t.accent} active={tab === "crypto"} onClick={() => setTab("crypto")}>קריפטו</Chip>
      </div>
      <input placeholder="חיפוש נכס…" value={q} onChange={(e) => setQ(e.target.value)} style={inputStyle(t)} />
      <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(220px,1fr))", gap: 10 }}>
        {list.map((a) => {
          const ch = ((a.current - a.entry) / a.entry) * 100; const sim = simulate(amount, a.entry, a.current);
          return (
            <Card key={a.id} t={t}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                <span style={{ fontWeight: 800, fontSize: 16, color: t.text }}>{a.symbol}</span>
                <span style={{ fontSize: 12, color: t.muted, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 110 }}>{a.name}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 10, fontSize: 13 }}>
                <span style={{ color: t.muted }}>{money(a.current)}</span>
                <span style={{ fontWeight: 700, color: ch >= 0 ? t.pos : t.neg }}>{arrow(ch)}{pct(ch)}</span>
              </div>
              <div style={{ marginTop: 8, fontSize: 12, color: t.faint }}>{money(amount)} → <b style={{ color: sim.pl >= 0 ? t.pos : t.neg }}>{money(sim.currentValue)}</b></div>
              <div style={{ marginTop: 6 }}><Chip t={t}>{a.sector}</Chip></div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

/* ============================== Compare ================================= */
function Compare({ t, amount }) {
  const favs = PEOPLE.filter((p) => p.favorite).slice(0, 5);
  const initial = (favs.length >= 2 ? favs : PEOPLE.slice(0, 4)).map((p) => p.id);
  const [ids, setIds] = useState(initial);
  const chosen = ids.map((id) => PEOPLE.find((p) => p.id === id)).filter(Boolean);
  const rows = chosen.map((p) => ({ p, st: personStats(p, amount) }));
  const barData = rows.map((r) => ({ name: r.p.name.split(" ")[0], value: Math.round(r.st.avgPct * 10) / 10 }));
  return (
    <div>
      <SectionTitle t={t} title="השוואת אנשים" sub="בחר עד 5 אנשים להשוואה" />
      <Card t={t} style={{ marginBottom: 14 }}>
        <label style={labelStyle(t)}>הוסף אדם</label>
        <select onChange={(e) => { const v = Number(e.target.value); if (v && !ids.includes(v) && ids.length < 5) setIds([...ids, v]); }} style={{ ...selectStyle(t), width: "100%" }} value="">
          <option value="">בחר…</option>{PEOPLE.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 10 }}>
          {chosen.map((p) => <Chip key={p.id} t={t} color={t.accent2} onClick={() => setIds(ids.filter((i) => i !== p.id))}>{p.name} ✕</Chip>)}
        </div>
      </Card>
      <Card t={t} style={{ marginBottom: 14 }}>
        <div style={{ fontWeight: 700, color: t.text, marginBottom: 10 }}>תשואה ממוצעת על {money(amount)} לאות</div>
        <div style={{ height: 200 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={barData}>
              <CartesianGrid strokeDasharray="3 3" stroke={t.border} />
              <XAxis dataKey="name" tick={{ fill: t.faint, fontSize: 11 }} /><YAxis tick={{ fill: t.faint, fontSize: 11 }} width={40} />
              <Tooltip contentStyle={{ background: t.surface, border: `1px solid ${t.border}`, borderRadius: 10, color: t.text, direction: "rtl" }} formatter={(v) => [`${v}%`, "תשואה"]} />
              <Bar dataKey="value" radius={[6, 6, 0, 0]}>{barData.map((d, i) => <Cell key={i} fill={d.value >= 0 ? t.pos : t.neg} />)}</Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: 480 }}>
          <thead><tr style={{ color: t.muted }}>
            <th style={thStyle(t)}>אדם</th><th style={thStyle(t)}>אותות</th><th style={thStyle(t)}>הצלחה</th><th style={thStyle(t)}>תשואה ממוצעת</th><th style={thStyle(t)}>חזקים</th><th style={thStyle(t)}>רווח מצטבר</th>
          </tr></thead>
          <tbody>{rows.map((r) => (
            <tr key={r.p.id}>
              <td style={tdStyle(t)}><b style={{ color: t.text }}>{r.p.name}</b></td>
              <td style={tdStyle(t)}>{r.st.count}</td><td style={tdStyle(t)}>{r.st.winRate.toFixed(0)}%</td>
              <td style={{ ...tdStyle(t), color: r.st.avgPct >= 0 ? t.pos : t.neg, fontWeight: 700 }}>{arrow(r.st.avgPct)}{pct(r.st.avgPct)}</td>
              <td style={tdStyle(t)}>{r.st.strong}</td>
              <td style={{ ...tdStyle(t), color: r.st.totalPL >= 0 ? t.pos : t.neg, fontWeight: 700 }}>{signedMoney(r.st.totalPL)}</td>
            </tr>))}</tbody>
        </table>
      </div>
      <div style={{ marginTop: 12, fontSize: 12, color: t.faint }}>נמצא קשר בזמן בין הפרסומים לבין תנועות המחיר. הדבר אינו מוכיח שהאדם גרם לעלייה.</div>
    </div>
  );
}

/* ============================== History ================================= */
function History({ t, amount, go }) {
  const rows = [...SIGNALS].sort((a, b) => b.published - a.published).slice(0, 40);
  let wins = 0, held = 0;
  SIGNALS.forEach((s) => { const sim = simulate(amount, s.entryPrice, s.currentPrice); if (sim.pl >= 0) wins++; if (reactionMetrics(s).gainHeld) held++; });
  return (
    <div>
      <SectionTitle t={t} title="היסטוריה ו־Backtesting" sub={`${SIGNALS.length} אותות בארכיון`} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 10, marginBottom: 14 }}>
        <MiniStat t={t} label="אותות שהסתיימו ברווח" value={`${wins} / ${SIGNALS.length}`} color={t.pos} />
        <MiniStat t={t} label="אחוז אותות מרוויחים" value={`${((wins / SIGNALS.length) * 100).toFixed(0)}%`} />
        <MiniStat t={t} label="שמרו על העלייה" value={`${((held / SIGNALS.length) * 100).toFixed(0)}%`} />
      </div>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5, minWidth: 560 }}>
          <thead><tr style={{ color: t.muted }}>
            <th style={thStyle(t)}>תאריך</th><th style={thStyle(t)}>אדם</th><th style={thStyle(t)}>נכס</th><th style={thStyle(t)}>שלב</th><th style={thStyle(t)}>ציון</th><th style={thStyle(t)}>מחיר אז→היום</th><th style={thStyle(t)}>תשואה</th><th style={thStyle(t)}>רווח $</th>
          </tr></thead>
          <tbody>{rows.map((s) => {
            const sim = simulate(amount, s.entryPrice, s.currentPrice);
            return (
              <tr key={s.id} onClick={() => go("signal", s)} style={{ cursor: "pointer" }}>
                <td style={tdStyle(t)}>{s.published.toLocaleDateString("he-IL")}</td>
                <td style={tdStyle(t)}>{s.person.name.split(" ").slice(0, 2).join(" ")}</td>
                <td style={{ ...tdStyle(t), fontWeight: 700, color: t.text }}>{s.asset.symbol}</td>
                <td style={tdStyle(t)}>{s.stage}</td>
                <td style={{ ...tdStyle(t), color: SCORE_COLOR(t, s.score), fontWeight: 700 }}>{s.score}</td>
                <td style={tdStyle(t)}>{money(s.entryPrice)}→{money(s.currentPrice)}</td>
                <td style={{ ...tdStyle(t), color: sim.plPct >= 0 ? t.pos : t.neg, fontWeight: 700 }}>{arrow(sim.plPct)}{pct(sim.plPct)}</td>
                <td style={{ ...tdStyle(t), color: sim.pl >= 0 ? t.pos : t.neg, fontWeight: 700 }}>{signedMoney(sim.pl)}</td>
              </tr>);
          })}</tbody>
        </table>
      </div>
    </div>
  );
}

/* ========================= Historical events =========================== */
function HistoricalEvents({ t, amount, go }) {
  const [pid, setPid] = useState("all");
  const people = PEOPLE.slice(0, 12);
  const list = SIGNALS.filter((s) => pid === "all" || s.person.id === Number(pid)).slice(0, 12);
  return (
    <div>
      <SectionTitle t={t} title="אירועים היסטוריים" sub="שחזורים להדגמה — מבנה מוכן לחיבור מקור אמיתי" />
      <Card t={t} style={{ marginBottom: 14, borderColor: t.warn + "55" }}>
        <div style={{ fontSize: 13, color: t.warn, fontWeight: 700, marginBottom: 6 }}>⚠️ שים לב</div>
        <div style={{ fontSize: 13, color: t.muted, lineHeight: 1.6 }}>
          המסך בנוי להצגת מקרים אמיתיים בלבד כאשר קיים מקור אמיתי עם זמן פרסום מדויק ומחיר היסטורי מאומת.
          כרגע, ללא Provider מחובר, כל רשומה כאן היא <b style={{ color: t.text }}>שחזור להדגמה</b> ולא ציטוט מאומת.
          כאשר יחוברו MarketDataProvider + XProvider/GovernmentSourcesProvider, המסך יתמלא באירועים אמיתיים.
        </div>
      </Card>
      <select value={pid} onChange={(e) => setPid(e.target.value)} style={{ ...selectStyle(t), width: "100%", marginBottom: 14 }}>
        <option value="all">כל האנשים</option>
        {people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
      </select>
      {list.map((s) => <WhoSaidCard key={s.id} s={s} t={t} amount={amount} go={go} historic />)}
    </div>
  );
}

/* ========================= Recent scans =============================== */
function RecentScans({ t, go }) {
  const [open, setOpen] = useState(SCAN_RUNS[0].id);
  const last = SCAN_RUNS[0];
  const agg = SCAN_RUNS.reduce((a, r) => ({
    people: a.people + r.people, queries: a.queries + r.queries, found: a.found + r.found,
    fresh: a.fresh + r.fresh, signals: a.signals + r.signals, errors: a.errors + r.errors,
  }), { people: 0, queries: 0, found: 0, fresh: 0, signals: 0, errors: 0 });
  return (
    <div>
      <SectionTitle t={t} title="סריקות אחרונות" sub="הסורק פועל כל 30 דקות · נתוני הדגמה" />
      <Card t={t} glow style={{ marginBottom: 14 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
          <MiniStat t={t} label="סריקה אחרונה" value={last.start.toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" })} />
          <MiniStat t={t} label="סריקה הבאה" value={NEXT_SCAN.toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" })} color={t.accent} />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(90px,1fr))", gap: 8, fontSize: 12 }}>
          <div><div style={{ color: t.faint }}>נסרקו</div><b style={{ color: t.text }}>{agg.people}</b></div>
          <div><div style={{ color: t.faint }}>שאילתות</div><b style={{ color: t.text }}>{agg.queries}</b></div>
          <div><div style={{ color: t.faint }}>תוצאות</div><b style={{ color: t.text }}>{agg.found}</b></div>
          <div><div style={{ color: t.faint }}>חדשות</div><b style={{ color: t.pos }}>{agg.fresh}</b></div>
          <div><div style={{ color: t.faint }}>אותות</div><b style={{ color: t.accent }}>{agg.signals}</b></div>
          <div><div style={{ color: t.faint }}>שגיאות</div><b style={{ color: agg.errors ? t.warn : t.text }}>{agg.errors}</b></div>
        </div>
      </Card>
      {SCAN_RUNS.map((r) => (
        <Card t={t} key={r.id} style={{ marginBottom: 10 }}>
          <div onClick={() => setOpen(open === r.id ? 0 : r.id)} style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700, color: t.text, fontSize: 13.5 }}>{r.start.toLocaleString("he-IL")}</div>
              <div style={{ fontSize: 12, color: t.muted }}>{r.people} אנשים · {r.queries} שאילתות · {r.fresh} תוצאות חדשות · {r.signals} אותות</div>
            </div>
            <Chip t={t} color={r.status === "רץ כעת" ? t.accent : t.pos}>{r.status}</Chip>
            <span style={{ color: t.faint }}>{open === r.id ? "▲" : "▼"}</span>
          </div>
          {open === r.id && (
            <div style={{ marginTop: 12, borderTop: `1px solid ${t.border}`, paddingTop: 12 }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(80px,1fr))", gap: 8, fontSize: 11.5, marginBottom: 12 }}>
                {[["נמצאו", r.found, t.text], ["חדשות", r.fresh, t.pos], ["אומתו", r.verified, t.accent2], ["נדחו", r.rejected, t.faint], ["אותות", r.signals, t.accent], ["שגיאות", r.errors, r.errors ? t.warn : t.text]].map(([l, v, c]) => (
                  <div key={l}><div style={{ color: t.faint }}>{l}</div><b style={{ color: c }}>{v}</b></div>
                ))}
              </div>
              {r.details.map((s) => (
                <div key={s.id} style={{ padding: 10, background: t.surface2, borderRadius: 10, border: `1px solid ${t.border}`, marginBottom: 8 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                    <span style={{ fontWeight: 700, color: t.text, fontSize: 13 }}>{s.person.name}</span>
                    <Chip t={t} color={VERIF_COLOR(t, s.verif)}>{s.verif}</Chip>
                  </div>
                  <div style={{ fontSize: 11.5, color: t.faint, marginTop: 6 }}>מונחי חיפוש:</div>
                  <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: 3 }}>
                    {sampleQueries(s.person).map((q, i) => <span key={i} style={{ fontSize: 10.5, color: t.muted, background: t.chip, padding: "2px 7px", borderRadius: 6, border: `1px solid ${t.border}`, direction: "ltr" }}>{q}</span>)}
                  </div>
                  <div style={{ fontSize: 12, color: t.muted, marginTop: 8 }}>
                    <span style={{ color: t.pos }}>סיבת קבלה:</span> נמצאה משמעות אפשרית לשוק · נכס {s.asset.symbol} · אמינות מקור {s.hasOfficial ? "רשמי" : "משני"}.
                  </div>
                  <button onClick={() => go("signal", s)} style={{ ...btnStyle(t), marginTop: 8, padding: "6px 12px" }}>פתח חקירה מלאה ←</button>
                </div>
              ))}
              <div style={{ fontSize: 11, color: t.faint }}>סיבת דחייה נפוצה: כתבה ללא משמעות לשוק, כפילות URL, או מקור לא נגיש לבדיקה.</div>
            </div>
          )}
        </Card>
      ))}
    </div>
  );
}

/* ============================== Alerts ================================== */
function Alerts({ t, go }) {
  const alerts = SIGNALS.slice(0, 14).map((s, i) => {
    const types = [["אדם חשוב פרסם הודעה חדשה", t.accent2], ["האות קיבל ציון מעל 80", t.accent], ["נמצא קשר למניה", t.pos], ["המחיר כבר עלה יותר מדי", t.warn], ["האות נחלש", t.neg], ["פורסם חוזה ממשלתי", t.accent2]];
    const [title, color] = types[i % types.length];
    return { s, title, color, read: i > 4 };
  });
  return (
    <div>
      <SectionTitle t={t} title="התראות" sub={`${alerts.filter((a) => !a.read).length} חדשות`} />
      {alerts.map((a, i) => (
        <Card key={i} t={t} onClick={() => go("signal", a.s)} style={{ marginBottom: 10, borderColor: a.read ? t.border : a.color + "55" }}>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: a.read ? t.faint : a.color, flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700, color: t.text, fontSize: 13.5 }}>{a.title}</div>
              <div style={{ fontSize: 12, color: t.muted }}>{a.s.person.name} · {a.s.asset.symbol} · {a.s.published.toLocaleDateString("he-IL")}</div>
            </div>
            <Chip t={t} color={a.color}>ציון {a.s.score}</Chip>
          </div>
        </Card>
      ))}
    </div>
  );
}

/* ======================== Connections (admin) ========================== */
function Connections({ t, mode, setMode }) {
  const [msg, setMsg] = useState("");
  const modeInfo = {
    DEMO: ["מצב הדגמה", "כל הנתונים הם נתוני דמה.", t.warn],
    HYBRID: ["מצב משולב", "חלק מהמקורות אמיתיים וחלקם דמה.", t.accent2],
    LIVE: ["מצב נתונים חיים", "כל הרשומות מבוססות על מקורות אמיתיים.", t.pos],
  };
  return (
    <div>
      <SectionTitle t={t} title="חיבורים ומקורות" sub="מסך ניהול · מצב ה-Providers" />
      <Card t={t} style={{ marginBottom: 14 }}>
        <div style={{ fontWeight: 700, color: t.text, marginBottom: 10 }}>מצב נתונים</div>
        <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
          {["DEMO", "HYBRID", "LIVE"].map((m) => <Chip key={m} t={t} color={modeInfo[m][2]} active={mode === m} onClick={() => setMode(m)}>{modeInfo[m][0]}</Chip>)}
        </div>
        <div style={{ fontSize: 13, color: t.muted }}>{modeInfo[mode][1]}</div>
        <div style={{ marginTop: 8, fontSize: 12, color: t.faint }}>המערכת לעולם לא תציג נתוני דמה כנתונים חיים. מעבר ל-LIVE דורש Providers מחוברים בפועל.</div>
      </Card>
      {msg && <div className="demo-inline" style={{ color: t.neg, borderColor: t.neg + "44", background: t.neg + "18" }}>{msg}</div>}
      <div style={{ display: "grid", gap: 10 }}>
        {PROVIDERS.map((p) => {
          const needsKey = p.envKey !== "—";
          return (
            <Card key={p.key} t={t}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 700, color: t.text }}>{p.label}</div>
                  <div style={{ fontSize: 12, color: t.muted }}>{p.role}</div>
                </div>
                <Chip t={t} color={t.neg}>לא מחובר</Chip>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(100px,1fr))", gap: 6, marginTop: 10, fontSize: 11.5 }}>
                <div style={{ color: t.faint }}>בדיקה אחרונה<br /><b style={{ color: t.text }}>—</b></div>
                <div style={{ color: t.faint }}>רשומות שנאספו<br /><b style={{ color: t.text }}>0</b></div>
                <div style={{ color: t.faint }}>שגיאות<br /><b style={{ color: t.text }}>0</b></div>
                <div style={{ color: t.faint }}>Rate Limit<br /><b style={{ color: t.text }}>—</b></div>
                <div style={{ color: t.faint }}>זמן תגובה<br /><b style={{ color: t.text }}>—</b></div>
                <div style={{ color: t.faint }}>API key<br /><b style={{ color: needsKey ? t.warn : t.pos }}>{needsKey ? "חסר" : "לא נדרש"}</b></div>
              </div>
              <div style={{ display: "flex", gap: 6, marginTop: 12, flexWrap: "wrap" }}>
                <button onClick={() => setMsg(`לא ניתן לבדוק את ${p.label} — ${needsKey ? "חסר מפתח API" : "נדרש חיבור שרת"}. בפרויקט המלא כפתור זה יבצע בקשת בדיקה אמיתית.`)} style={btnStyle(t)}>Test Connection</button>
                <button style={{ ...btnStyle(t), opacity: 0.5 }}>Enable</button>
                <button style={{ ...btnStyle(t), opacity: 0.5 }}>Disable</button>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

/* ============================== Settings ================================ */
function Settings({ t, amount, setAmount, dark, setDark }) {
  return (
    <div>
      <SectionTitle t={t} title="הגדרות" />
      <Card t={t} style={{ marginBottom: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div><div style={{ fontWeight: 700, color: t.text }}>מצב תצוגה</div><div style={{ fontSize: 12.5, color: t.muted }}>כהה או בהיר</div></div>
          <button onClick={() => setDark(!dark)} style={btnStyle(t)}>{dark ? "🌙 כהה" : "☀️ בהיר"}</button>
        </div>
      </Card>
      <Card t={t} style={{ marginBottom: 12 }}>
        <label style={labelStyle(t)}>סכום סימולציה ברירת מחדל</label>
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <span style={{ color: t.accent, fontWeight: 800 }}>$</span>
          <input type="number" value={amount} min={1} onChange={(e) => setAmount(Math.max(1, Number(e.target.value) || 1))} style={{ ...inputStyle(t), width: 130, margin: 0 }} />
        </div>
      </Card>
      <Card t={t} style={{ marginBottom: 12 }}>
        <div style={{ fontWeight: 700, color: t.text, marginBottom: 8 }}>שפה</div>
        <div style={{ display: "flex", gap: 6 }}><Chip t={t} color={t.accent} active>עברית (RTL)</Chip><Chip t={t}>English (בקרוב)</Chip></div>
      </Card>
      <Card t={t}>
        <div style={{ fontWeight: 700, color: t.text, marginBottom: 8 }}>מצב נתונים</div>
        <div style={{ fontSize: 13, color: t.muted, lineHeight: 1.6 }}>
          המערכת פועלת במצב <b style={{ color: t.warn }}>נתוני הדגמה בלבד</b>. אין חיבור לספקי מחירים, חדשות או רשתות חברתיות אמיתיים.
          אין מסחר אמיתי, אין חיבור לברוקר, בנק, כרטיס אשראי או ארנק.
        </div>
      </Card>
    </div>
  );
}

/* ============================== About ================================== */
function About({ t }) {
  return (
    <div>
      <SectionTitle t={t} title="אודות והבהרת סיכונים" />
      <Card t={t} style={{ marginBottom: 12 }}>
        <div style={{ fontWeight: 800, color: t.text, fontSize: 16, marginBottom: 8 }}>MARKET RADAR AI</div>
        <p style={{ fontSize: 14, color: t.muted, lineHeight: 1.7, margin: 0 }}>
          מערכת מודיעין פיננסית וסימולטור לימודי. המערכת עוקבת אחר אמירות של אישים משפיעים, מזהה אירועים אפשריים,
          מקשרת אותם לסקטורים ולנכסים, ומראה מה <b style={{ color: t.text }}>קרה בפועל</b> למחיר לאחר שעה, 3 שעות, יום, שבוע וחודש — כולל שווי סכום מדומה בכל שלב.
        </p>
      </Card>
      <Card t={t} style={{ marginBottom: 12, borderColor: t.warn + "55" }}>
        <div style={{ fontWeight: 700, color: t.warn, marginBottom: 8 }}>⚠️ הבהרת סיכונים</div>
        <ul style={{ fontSize: 13.5, color: t.muted, lineHeight: 1.8, paddingInlineStart: 18, margin: 0 }}>
          <li>כל הנתונים כאן הם <b>נתוני הדגמה בלבד</b> — לא נתוני שוק אמיתיים.</li>
          <li>אין באפליקציה מסחר אמיתי, קנייה או מכירה של נכסים.</li>
          <li>קשר בזמן בין פרסום לתנועת מחיר אינו מוכיח סיבתיות.</li>
          <li>ביצועי עבר אינם מבטיחים תשואה עתידית. אין כאן ייעוץ השקעות.</li>
          <li>המערכת אינה משתמשת במונחים כמו "רווח בטוח" או "תשואה מובטחת".</li>
        </ul>
      </Card>
      <Card t={t}>
        <div style={{ fontWeight: 700, color: t.text, marginBottom: 8 }}>מוכן לחיבור עתידי</div>
        <div style={{ fontSize: 13, color: t.muted, lineHeight: 1.7 }}>
          הארכיטקטורה כוללת 11 שכבות Provider ניתנות להחלפה. בגרסה זו כולן פועלות כ־Mock ומוצגות במסך "חיבורים".
          בפרויקט המלא (Next.js + Supabase) ניתן לחבר אותן לנתונים אמיתיים ולעבור בין המצבים DEMO / HYBRID / LIVE.
        </div>
      </Card>
    </div>
  );
}

/* ----------------------------- styles ----------------------------------- */
const inputStyle = (t) => ({ width: "100%", padding: "11px 14px", borderRadius: 12, border: `1px solid ${t.border}`, background: t.surface2, color: t.text, fontSize: 14, outline: "none", fontFamily: "inherit", boxSizing: "border-box", margin: 0 });
const selectStyle = (t) => ({ padding: "9px 12px", borderRadius: 10, border: `1px solid ${t.border}`, background: t.surface2, color: t.text, fontSize: 13.5, outline: "none", fontFamily: "inherit" });
const labelStyle = (t) => ({ display: "block", fontSize: 12, color: t.muted, marginBottom: 6, fontWeight: 600 });
const btnStyle = (t) => ({ padding: "9px 16px", borderRadius: 10, border: `1px solid ${t.border}`, background: t.chip, color: t.text, fontSize: 13.5, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" });
const thStyle = (t) => ({ textAlign: "right", padding: "10px 8px", borderBottom: `1px solid ${t.border}`, fontWeight: 600, fontSize: 12 });
const tdStyle = (t) => ({ textAlign: "right", padding: "9px 8px", borderBottom: `1px solid ${t.border}` });

/* ==================== SMART SCAN COMMAND (demo) ======================== */
const DEMO_SCAN_STAGES = [
  "מפרש את הפקודה", "מחפש ציוצים ומקורות", "מסיר כפילויות", "בודק אמינות",
  "מנתח משמעות", "מזהה סקטורים", "מזהה חברות", "בודק מחירי שוק", "מחשב תוצאות", "מסיים",
];
const DEMO_ALIASES = [
  ["אילון מאסק", ["elon", "musk", "מאסק", "אילון"]],
  ["דונלד טראמפ", ["trump", "טראמפ", "דונלד"]],
  ["בנימין נתניהו", ["netanyahu", "נתניהו", "ביבי", "בנימין"]],
  ["ג'נסן huang", ["jensen", "huang", "nvidia", "אנבידיה"]],
  ["טים קוק", ["tim cook", "קוק", "apple", "אפל"]],
  ["סם אלטמן", ["altman", "אלטמן", "openai"]],
];
const DEMO_TOPIC_SECTORS = {
  ai: ["בינה מלאכותית", "שבבים", "מרכזי נתונים", "ענן"],
  defense: ["ביטחון", "חלל", "סייבר"],
  energy: ["נפט", "אנרגיה", "גז", "גרעין"],
  crypto: ["קריפטו", "תשלומים"],
};
function parseDemoCommand(text) {
  const t = (text || "").toLowerCase();
  const people = DEMO_ALIASES.filter(([, m]) => m.some((x) => t.includes(x))).map(([c]) => c);
  const sectorSet = new Set();
  Object.entries(DEMO_TOPIC_SECTORS).forEach(([k, secs]) => {
    const kw = { ai: ["ai", "בינה", "שבב"], defense: ["ביטחון", "בטחון", "צבא", "מלחמה", "טילים"], energy: ["אנרגיה", "נפט", "גז", "חשמל"], crypto: ["קריפטו", "ביטקוין", "מטבע"] }[k];
    if (kw.some((w) => t.includes(w))) secs.forEach((s) => sectorSet.add(s));
  });
  const DAY = 86400000;
  let cutoff = new Date(NOW.getTime() - DAY), label = "24 שעות אחרונות";
  const startOfDay = () => { const d = new Date(NOW); d.setHours(0, 0, 0, 0); return d; };
  if (/היום|מהבוקר/.test(t)) { cutoff = startOfDay(); label = "מתחילת היום"; }
  else if (/24 השעות|24 שעות|ב-?24/.test(t)) { cutoff = new Date(NOW.getTime() - DAY); label = "24 שעות אחרונות"; }
  else if (/השבוע האחרון|7 ימים|7 הימים|שבוע/.test(t)) { cutoff = new Date(NOW.getTime() - 7 * DAY); label = "7 ימים אחרונים"; }
  else if (/החודש|30 ימים|30 הימים|חודש/.test(t)) { cutoff = new Date(NOW.getTime() - 30 * DAY); label = "30 ימים אחרונים"; }
  const tweets = /ציוץ|ציוצים|tweet|פוסט/.test(t);
  return {
    people, sectors: [...sectorSet], cutoff, cutoffLabel: label,
    onlyNotReacted: /לא הגיב|עדיין לא/.test(t),
    onlyMoved: /תנועה|זזו|יצרו תנועה/.test(t) && !/לא הגיב/.test(t),
    tweets, raw: text,
  };
}
function runDemoScan(p) {
  return SIGNALS.filter((s) => {
    if (s.published < p.cutoff) return false;
    if (p.people.length && !p.people.some((n) => s.person.name.includes(n) || n.includes(s.person.name.split(" ")[0]))) return false;
    if (p.sectors.length && !s.sectors.some((sec) => p.sectors.includes(sec))) return false;
    if (p.onlyNotReacted) { const m = reactionMetrics(s); if (Math.abs((s.currentPrice - s.entryPrice) / s.entryPrice * 100) >= 3 || m.maxRet >= 3) return false; }
    if (p.onlyMoved) { if (Math.abs((s.currentPrice - s.entryPrice) / s.entryPrice * 100) < 3) return false; }
    return true;
  }).slice(0, 40);
}
function describeDemo(p) {
  const who = p.people.length ? p.people.join(", ") : "כל האנשים במעקב";
  const topics = p.sectors.length ? ` · נושאים: ${p.sectors.slice(0, 3).join(", ")}` : "";
  const extra = p.onlyNotReacted ? " · רק מניות שלא הגיבו" : p.onlyMoved ? " · רק מה שיצר תנועה" : "";
  return `סריקת ${p.tweets ? "ציוצים ומקורות" : "מקורות"} של ${who} · ${p.cutoffLabel}${extra}`;
}

const EXAMPLES = [
  "מה אילון מאסק אמר היום?", "מה טראמפ אמר השבוע?", "מה ביבי אמר ב-24 השעות האחרונות?",
  "אילו ציוצים מהשבוע השפיעו על מניות?", "אילו חברות יכולות להרוויח מהחדשות של היום?",
  "אילו מניות עדיין לא הגיבו?", "מה היו האותות החזקים ביותר השבוע?",
];
const QUICK_RANGES = [["היום", "היום"], ["24 שעות", "ב-24 השעות האחרונות"], ["7 ימים", "בשבוע האחרון"], ["30 ימים", "בחודש האחרון"]];

function CommandBar({ t, onRun, history, rerun }) {
  const [text, setText] = useState("");
  const [showHist, setShowHist] = useState(false);
  const SR = typeof window !== "undefined" && (window.SpeechRecognition || window.webkitSpeechRecognition);
  const [listening, setListening] = useState(false);
  const mic = () => {
    if (!SR) return;
    const rec = new SR(); rec.lang = "he-IL"; rec.interimResults = false;
    rec.onresult = (e) => { setText(e.results[0][0].transcript); setListening(false); };
    rec.onend = () => setListening(false); rec.onerror = () => setListening(false);
    setListening(true); rec.start();
  };
  const setRange = (phrase) => setText((prev) => `${prev.replace(/היום|בשבוע האחרון|בחודש האחרון|ב-24 השעות האחרונות/g, "").trim()} ${phrase}`.trim());
  return (
    <Card t={t} glow style={{ marginBottom: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <span style={{ fontSize: 18 }}>🛰️</span>
        <span style={{ fontWeight: 800, color: t.text }}>סריקה חכמה</span>
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <input value={text} onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && text.trim()) onRun(text.trim()); }}
          placeholder="כתוב פקודה, לדוגמה: בדוק ציוצים מהשבוע האחרון"
          style={{ ...inputStyle(t), flex: 1, minWidth: 180 }} />
        <button onClick={() => text.trim() && onRun(text.trim())} style={{ ...btnStyle(t), background: t.accent, color: "#06121f", border: "none", fontWeight: 800 }}>סרוק עכשיו</button>
        {SR && <button onClick={mic} title="דיבור" style={{ ...btnStyle(t), padding: "9px 12px", background: listening ? t.neg : t.chip, color: listening ? "#fff" : t.text }}>🎤</button>}
        <button onClick={() => setText("")} style={{ ...btnStyle(t), padding: "9px 12px" }}>נקה</button>
        <button onClick={() => setShowHist(!showHist)} style={{ ...btnStyle(t), padding: "9px 12px" }}>חיפושים אחרונים</button>
      </div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 10 }}>
        {QUICK_RANGES.map(([label, phrase]) => <Chip key={label} t={t} color={t.accent2} onClick={() => setRange(phrase)}>{label}</Chip>)}
      </div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
        {EXAMPLES.slice(0, 4).map((ex) => <Chip key={ex} t={t} onClick={() => { setText(ex); onRun(ex); }}>{ex}</Chip>)}
      </div>
      {showHist && (
        <div style={{ marginTop: 10, borderTop: `1px solid ${t.border}`, paddingTop: 10 }}>
          <div style={{ fontSize: 12, color: t.faint, marginBottom: 6 }}>חיפושים אחרונים</div>
          {history.length === 0 ? <div style={{ fontSize: 12.5, color: t.faint }}>אין עדיין חיפושים.</div> :
            history.map((h, i) => (
              <div key={i} onClick={() => { setShowHist(false); rerun(h.text); }} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", cursor: "pointer", fontSize: 12.5, color: t.text }}>
                <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{h.text}</span>
                <span style={{ color: t.faint }}>{h.count} תוצאות</span>
              </div>
            ))}
        </div>
      )}
    </Card>
  );
}

function ScanProgress({ t, stage, progress }) {
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 40, background: t.bg + "cc", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <Card t={t} glow style={{ width: "100%", maxWidth: 420 }}>
        <div style={{ fontWeight: 800, color: t.text, marginBottom: 12 }}>מבצע סריקה…</div>
        <div style={{ height: 8, background: t.border, borderRadius: 8, overflow: "hidden", marginBottom: 12 }}>
          <div style={{ width: `${progress}%`, height: "100%", background: t.accent, transition: "width .2s" }} />
        </div>
        <div style={{ fontSize: 13.5, color: t.text }}>{stage}</div>
        <div style={{ fontSize: 12, color: t.faint, marginTop: 4 }}>{progress}%</div>
        <div style={{ display: "grid", gap: 4, marginTop: 12 }}>
          {DEMO_SCAN_STAGES.map((s, i) => (
            <div key={s} style={{ fontSize: 11.5, color: DEMO_SCAN_STAGES.indexOf(stage) >= i ? t.pos : t.faint }}>
              {DEMO_SCAN_STAGES.indexOf(stage) > i ? "✓" : DEMO_SCAN_STAGES.indexOf(stage) === i ? "▸" : "○"} {s}
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

function CommandResults({ t, payload, amount, go }) {
  const { parsed, results, text } = payload;
  const verified = results.filter((s) => s.verif === "מאומת").length;
  const strong = results.filter((s) => s.score >= 60).length;
  return (
    <div>
      <BackBar t={t} onBack={() => go("dashboard")} label="חזרה" />
      <SectionTitle t={t} title="תוצאות הסריקה" sub={describeDemo(parsed)} />
      <Card t={t} style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 12.5, color: t.muted, marginBottom: 8 }}>מה חיפשת: “{text}”</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(90px,1fr))", gap: 8, fontSize: 12 }}>
          <div><div style={{ color: t.faint }}>טווח</div><b style={{ color: t.text }}>{parsed.cutoffLabel}</b></div>
          <div><div style={{ color: t.faint }}>אנשים</div><b style={{ color: t.text }}>{parsed.people.length || "הכל"}</b></div>
          <div><div style={{ color: t.faint }}>תוצאות</div><b style={{ color: t.text }}>{results.length}</b></div>
          <div><div style={{ color: t.faint }}>מאומתות</div><b style={{ color: t.pos }}>{verified}</b></div>
          <div><div style={{ color: t.faint }}>אותות חזקים</div><b style={{ color: t.accent }}>{strong}</b></div>
        </div>
        {parsed.tweets && (
          <div style={{ marginTop: 10, fontSize: 11.5, color: t.warn, background: t.warn + "18", border: `1px solid ${t.warn}44`, borderRadius: 8, padding: "6px 10px" }}>
            X API אינו מחובר ולכן לא ניתן לאמת את כל הציוצים ישירות. במצב הדגמה נעשה שימוש במקורות לדוגמה בלבד.
          </div>
        )}
      </Card>
      {results.length === 0
        ? <EmptyState t={t} text="לא נמצאו פרסומים משמעותיים חדשים לפי הפקודה." />
        : results.map((s) => <WhoSaidCard key={s.id} s={s} t={t} amount={amount} go={go} />)}
    </div>
  );
}

/* ----------------------------- App shell -------------------------------- */
const NAV = [
  ["dashboard", "בית", "🏠"], ["signals", "אותות", "📡"], ["people", "אנשים", "👥"],
  ["sim", "סימולציה", "💵"], ["sectors", "סקטורים", "🗂️"], ["assets", "נכסים", "📈"],
  ["compare", "השוואות", "⚖️"], ["history", "היסטוריה", "🕰️"], ["historical", "אירועים", "📜"],
  ["scans", "סריקות", "🛰️"], ["alerts", "התראות", "🔔"], ["connections", "חיבורים", "🔌"], ["settings", "הגדרות", "⚙️"], ["about", "אודות", "ℹ️"],
];
const MODE_BADGE = { DEMO: ["מצב הדגמה", "#F5B841"], HYBRID: ["מצב משולב", "#5B8DEF"], LIVE: ["מצב נתונים חיים", "#35D07F"] };

export default function App() {
  const [dark, setDark] = useState(true);
  const [amount, setAmount] = useState(200);
  const [view, setView] = useState("dashboard");
  const [mode, setMode] = useState("DEMO");
  const [selPerson, setSelPerson] = useState(null);
  const [selSignal, setSelSignal] = useState(null);
  const [cmdRunning, setCmdRunning] = useState(false);
  const [cmdProgress, setCmdProgress] = useState(0);
  const [cmdStage, setCmdStage] = useState(DEMO_SCAN_STAGES[0]);
  const [cmdResults, setCmdResults] = useState(null);
  const [cmdHistory, setCmdHistory] = useState([]);
  const t = dark ? THEMES.dark : THEMES.light;

  const runCommand = (text) => {
    const parsed = parseDemoCommand(text);
    setCmdRunning(true); setCmdProgress(0); setCmdStage(DEMO_SCAN_STAGES[0]);
    let i = 0;
    const tick = () => {
      setCmdStage(DEMO_SCAN_STAGES[i]);
      setCmdProgress(Math.round((i / (DEMO_SCAN_STAGES.length - 1)) * 100));
      i++;
      if (i < DEMO_SCAN_STAGES.length) setTimeout(tick, 200);
      else {
        const results = runDemoScan(parsed);
        setCmdResults({ parsed, results, text });
        setCmdHistory((h) => [{ text, count: results.length, at: Date.now() }, ...h].slice(0, 8));
        setCmdRunning(false);
        setView("cmdResults");
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    };
    setTimeout(tick, 150);
  };

  const go = (v, payload) => {
    if (v === "person") setSelPerson(payload);
    if (v === "signal") setSelSignal(payload);
    setView(v);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  useEffect(() => { document.body.style.background = t.bg; }, [t.bg]);

  let content;
  if (view === "dashboard") content = <Dashboard t={t} amount={amount} setAmount={setAmount} go={go} mode={mode} />;
  else if (view === "signals") content = <Signals t={t} amount={amount} go={go} />;
  else if (view === "signal") content = <SignalDetail s={selSignal} t={t} amount={amount} go={go} />;
  else if (view === "people") content = <People t={t} amount={amount} go={go} />;
  else if (view === "person") content = <PersonDetail p={selPerson} t={t} amount={amount} go={go} />;
  else if (view === "sim") content = <Simulator t={t} amount={amount} setAmount={setAmount} go={go} />;
  else if (view === "sectors") content = <Sectors t={t} amount={amount} go={go} />;
  else if (view === "assets") content = <Assets t={t} amount={amount} />;
  else if (view === "compare") content = <Compare t={t} amount={amount} />;
  else if (view === "history") content = <History t={t} amount={amount} go={go} />;
  else if (view === "historical") content = <HistoricalEvents t={t} amount={amount} go={go} />;
  else if (view === "scans") content = <RecentScans t={t} go={go} />;
  else if (view === "cmdResults") content = <CommandResults t={t} payload={cmdResults} amount={amount} go={go} />;
  else if (view === "alerts") content = <Alerts t={t} go={go} />;
  else if (view === "connections") content = <Connections t={t} mode={mode} setMode={setMode} />;
  else if (view === "settings") content = <Settings t={t} amount={amount} setAmount={setAmount} dark={dark} setDark={setDark} />;
  else if (view === "about") content = <About t={t} />;

  const activeNav = { signal: "signals", person: "people" }[view] || view;
  const [badgeLabel, badgeColor] = MODE_BADGE[mode];

  return (
    <div dir="rtl" style={{ minHeight: "100vh", background: t.bg, color: t.text, fontFamily: "'Heebo', 'Assistant', -apple-system, system-ui, sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Heebo:wght@400;600;700;800;900&display=swap');
        * { -webkit-tap-highlight-color: transparent; }
        ::-webkit-scrollbar { width: 8px; height: 8px; }
        ::-webkit-scrollbar-thumb { background: ${t.border}; border-radius: 8px; }
        input[type=number]::-webkit-outer-spin-button, input[type=number]::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
        input[type=number] { -moz-appearance: textfield; }
        .demo-inline { font-size: 11.5px; color: ${t.warn}; background: ${t.warn}18; border: 1px solid ${t.warn}44; padding: 6px 12px; border-radius: 8px; text-align:center; margin-bottom: 12px; font-weight:600; }
        .radar-sweep { background: conic-gradient(from 0deg, transparent 0deg, ${t.accent}22 40deg, transparent 80deg); animation: spin 6s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
        @media (prefers-reduced-motion: reduce) { .radar-sweep { animation: none !important; } }
        button:focus-visible, a:focus-visible, input:focus-visible, select:focus-visible { outline: 2px solid ${t.accent}; outline-offset: 2px; }
      `}</style>

      <header style={{ position: "sticky", top: 0, zIndex: 20, background: t.bg + "ee", backdropFilter: "blur(10px)", borderBottom: `1px solid ${t.border}` }}>
        <div style={{ maxWidth: 1080, margin: "0 auto", padding: "12px 16px", display: "flex", alignItems: "center", gap: 12 }}>
          <div onClick={() => go("dashboard")} style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
            <span style={{ fontSize: 22 }}>📡</span>
            <span style={{ fontWeight: 900, fontSize: 17, letterSpacing: -0.3 }}>MARKET RADAR <span style={{ color: t.accent }}>AI</span></span>
          </div>
          <span onClick={() => go("connections")} style={{ marginInlineStart: "auto", cursor: "pointer", fontSize: 11.5, fontWeight: 800, color: "#06121f", background: badgeColor, padding: "4px 10px", borderRadius: 999 }}>{badgeLabel}</span>
          <button onClick={() => setDark(!dark)} style={{ ...btnStyle(t), padding: "7px 12px" }}>{dark ? "☀️" : "🌙"}</button>
        </div>
        <div style={{ background: t.warn + "22", color: t.warn, textAlign: "center", fontSize: 11.5, fontWeight: 700, padding: "4px 8px", borderTop: `1px solid ${t.warn}33` }}>
          נתוני הדגמה בלבד — לא נתוני שוק אמיתיים · SIMULATION ONLY · אין מסחר אמיתי
        </div>
      </header>

      <main style={{ maxWidth: 1080, margin: "0 auto", padding: "18px 16px 96px" }}>
        {!["signal", "person", "cmdResults", "settings", "about", "connections"].includes(view) && (
          <CommandBar t={t} onRun={runCommand} history={cmdHistory} rerun={runCommand} />
        )}
        {content}
      </main>

      {cmdRunning && <ScanProgress t={t} stage={cmdStage} progress={cmdProgress} />}

      <nav style={{ position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 20, background: t.surface + "f5", backdropFilter: "blur(10px)", borderTop: `1px solid ${t.border}`, display: "flex", overflowX: "auto", padding: "6px 8px", gap: 2 }}>
        {NAV.map(([key, label, icon]) => {
          const active = activeNav === key;
          return (
            <button key={key} onClick={() => go(key)} style={{ flex: "0 0 auto", display: "flex", flexDirection: "column", alignItems: "center", gap: 2, background: "transparent", border: "none", cursor: "pointer", padding: "6px 12px", borderRadius: 10, minWidth: 56, color: active ? t.accent : t.muted, fontFamily: "inherit" }}>
              <span style={{ fontSize: 18, filter: active ? "none" : "grayscale(.4)" }}>{icon}</span>
              <span style={{ fontSize: 10.5, fontWeight: active ? 800 : 600 }}>{label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
