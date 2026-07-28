// Curated knowledge base: needs → technologies → components → companies, with
// capability evidence. Every company link carries at least one evidence pointer.
// Real company names; evidence URLs are the companies' own public pages/filings.
// Nothing here is invented at runtime — the engine only traverses this graph.

export interface Technology { id: string; name: string; category: string; description: string; }
export interface Component { id: string; name: string; technologyId: string; description: string; }
export interface Capability {
  companyTicker: string; technologyId?: string; componentId?: string;
  capabilityType: "manufactures" | "supplies" | "operates" | "designs" | "services";
  productName: string; evidenceUrl: string; evidenceType: string; confidence: number;
}
export interface CompanyEdge {
  source: string; target: string;
  type: "SUPPLIES" | "BUYS_FROM" | "COMPETES_WITH" | "PARTNERS_WITH" | "DEPENDS_ON";
  description: string; evidenceUrl: string; confidence: number;
}

export const TECHNOLOGIES: Technology[] = [
  { id: "gpu", name: "AI Accelerators (GPU)", category: "compute", description: "מאיצי חישוב לעומסי בינה מלאכותית" },
  { id: "hbm", name: "High-Bandwidth Memory", category: "memory", description: "זיכרון מהיר צמוד למאיץ" },
  { id: "advpkg", name: "Advanced Packaging", category: "manufacturing", description: "אריזה מתקדמת (CoWoS)" },
  { id: "fabtool", name: "Semiconductor Equipment", category: "manufacturing", description: "ציוד לייצור שבבים" },
  { id: "optical", name: "Optical Interconnect", category: "networking", description: "קישוריות אופטית מהירה" },
  { id: "switch", name: "Datacenter Networking", category: "networking", description: "מתגים ורשתות מרכזי נתונים" },
  { id: "cooling", name: "Thermal / Cooling", category: "infrastructure", description: "קירור וניהול תרמי" },
  { id: "power", name: "Power & Electrical", category: "infrastructure", description: "אספקת חשמל, שנאים, UPS" },
  { id: "dcreit", name: "Data Center Real Estate", category: "infrastructure", description: "תשתית פיזית של מרכזי נתונים" },
  { id: "cyber", name: "Cybersecurity", category: "software", description: "אבטחת מידע" },
  { id: "storage", name: "Storage", category: "infrastructure", description: "אחסון נתונים" },
  // defense
  { id: "missiles", name: "Missiles / Interceptors", category: "defense", description: "טילים ויירוט" },
  { id: "radar", name: "Radar / Sensors", category: "defense", description: "מכ\"ם וחיישנים" },
  { id: "milcomms", name: "Military Communications", category: "defense", description: "תקשורת צבאית" },
  { id: "drones", name: "Drones / UAV", category: "defense", description: "רחפנים ומל\"טים" },
  { id: "satellite", name: "Satellites", category: "space", description: "לוויינים" },
  // energy
  { id: "turbine", name: "Turbines / Generation", category: "energy", description: "טורבינות וייצור חשמל" },
  { id: "grid", name: "Grid & Transformers", category: "energy", description: "רשת חשמל ושנאים" },
  { id: "battery", name: "Battery Storage", category: "energy", description: "אגירה בסוללות" },
  { id: "uranium", name: "Nuclear Fuel", category: "energy", description: "דלק גרעיני" },
];

export const COMPONENTS: Component[] = [
  { id: "ai_chip", name: "AI accelerator chip", technologyId: "gpu", description: "מאיץ AI" },
  { id: "hbm_stack", name: "HBM memory stack", technologyId: "hbm", description: "מחסנית HBM" },
  { id: "litho", name: "Lithography tool", technologyId: "fabtool", description: "מכונת ליתוגרפיה" },
  { id: "optical_transceiver", name: "Optical transceiver", technologyId: "optical", description: "משדר אופטי" },
  { id: "switch_asic", name: "Networking switch", technologyId: "switch", description: "מתג רשת" },
  { id: "cdu", name: "Liquid cooling unit", technologyId: "cooling", description: "יחידת קירור נוזלי" },
  { id: "transformer", name: "Power transformer / UPS", technologyId: "power", description: "שנאי / UPS" },
  { id: "interceptor", name: "Interceptor missile", technologyId: "missiles", description: "טיל יירוט" },
  { id: "radar_unit", name: "Radar array", technologyId: "radar", description: "מערך מכ\"ם" },
  { id: "grid_transformer", name: "Grid transformer", technologyId: "grid", description: "שנאי רשת" },
  { id: "battery_pack", name: "Grid battery pack", technologyId: "battery", description: "מארז סוללות" },
];

// company capabilities — each has a real evidence URL (company IR / product page).
export const CAPABILITIES: Capability[] = [
  { companyTicker: "NVDA", technologyId: "gpu", componentId: "ai_chip", capabilityType: "designs", productName: "Data-center GPUs", evidenceUrl: "https://www.nvidia.com/en-us/data-center/", evidenceType: "official_site", confidence: 95 },
  { companyTicker: "AMD", technologyId: "gpu", componentId: "ai_chip", capabilityType: "designs", productName: "Instinct accelerators", evidenceUrl: "https://www.amd.com/en/products/accelerators.html", evidenceType: "official_site", confidence: 88 },
  { companyTicker: "AVGO", technologyId: "switch", componentId: "switch_asic", capabilityType: "manufactures", productName: "Networking ASICs", evidenceUrl: "https://www.broadcom.com/", evidenceType: "official_site", confidence: 85 },
  { companyTicker: "TSM", technologyId: "advpkg", capabilityType: "manufactures", productName: "Foundry + CoWoS packaging", evidenceUrl: "https://www.tsmc.com/english", evidenceType: "official_site", confidence: 92 },
  { companyTicker: "ASML", technologyId: "fabtool", componentId: "litho", capabilityType: "manufactures", productName: "EUV lithography", evidenceUrl: "https://www.asml.com/", evidenceType: "official_site", confidence: 93 },
  { companyTicker: "AMAT", technologyId: "fabtool", capabilityType: "manufactures", productName: "Deposition/etch equipment", evidenceUrl: "https://www.appliedmaterials.com/", evidenceType: "official_site", confidence: 84 },
  { companyTicker: "LRCX", technologyId: "fabtool", capabilityType: "manufactures", productName: "Etch & deposition", evidenceUrl: "https://www.lamresearch.com/", evidenceType: "official_site", confidence: 83 },
  { companyTicker: "MU", technologyId: "hbm", componentId: "hbm_stack", capabilityType: "manufactures", productName: "HBM memory", evidenceUrl: "https://www.micron.com/products/memory/hbm", evidenceType: "official_site", confidence: 87 },
  { companyTicker: "GLW", technologyId: "optical", componentId: "optical_transceiver", capabilityType: "manufactures", productName: "Optical fiber & components", evidenceUrl: "https://www.corning.com/", evidenceType: "official_site", confidence: 80 },
  { companyTicker: "COHR", technologyId: "optical", componentId: "optical_transceiver", capabilityType: "manufactures", productName: "Optical transceivers", evidenceUrl: "https://www.coherent.com/", evidenceType: "official_site", confidence: 78 },
  { companyTicker: "VRT", technologyId: "cooling", componentId: "cdu", capabilityType: "manufactures", productName: "Liquid cooling & power", evidenceUrl: "https://www.vertiv.com/", evidenceType: "official_site", confidence: 82 },
  { companyTicker: "ETN", technologyId: "power", componentId: "transformer", capabilityType: "manufactures", productName: "Electrical/power management", evidenceUrl: "https://www.eaton.com/", evidenceType: "official_site", confidence: 80 },
  { companyTicker: "GEV", technologyId: "turbine", capabilityType: "manufactures", productName: "Power generation equipment", evidenceUrl: "https://www.gevernova.com/", evidenceType: "official_site", confidence: 79 },
  { companyTicker: "DELL", technologyId: "gpu", capabilityType: "manufactures", productName: "AI servers", evidenceUrl: "https://www.dell.com/en-us/dt/solutions/artificial-intelligence/", evidenceType: "official_site", confidence: 76 },
  { companyTicker: "SMCI", technologyId: "gpu", capabilityType: "manufactures", productName: "AI server systems", evidenceUrl: "https://www.supermicro.com/", evidenceType: "official_site", confidence: 72 },
  { companyTicker: "EQIX", technologyId: "dcreit", capabilityType: "operates", productName: "Data-center capacity", evidenceUrl: "https://www.equinix.com/", evidenceType: "official_site", confidence: 78 },
  { companyTicker: "CRWD", technologyId: "cyber", capabilityType: "supplies", productName: "Endpoint security", evidenceUrl: "https://www.crowdstrike.com/", evidenceType: "official_site", confidence: 74 },
  { companyTicker: "PANW", technologyId: "cyber", capabilityType: "supplies", productName: "Network security", evidenceUrl: "https://www.paloaltonetworks.com/", evidenceType: "official_site", confidence: 74 },
  // defense
  { companyTicker: "LMT", technologyId: "missiles", componentId: "interceptor", capabilityType: "manufactures", productName: "Missile systems", evidenceUrl: "https://www.lockheedmartin.com/", evidenceType: "official_site", confidence: 88 },
  { companyTicker: "RTX", technologyId: "missiles", componentId: "interceptor", capabilityType: "manufactures", productName: "Missiles & radar", evidenceUrl: "https://www.rtx.com/", evidenceType: "official_site", confidence: 86 },
  { companyTicker: "NOC", technologyId: "radar", componentId: "radar_unit", capabilityType: "manufactures", productName: "Radar & sensors", evidenceUrl: "https://www.northropgrumman.com/", evidenceType: "official_site", confidence: 84 },
  { companyTicker: "ESLT", technologyId: "drones", capabilityType: "manufactures", productName: "Drones & defense electronics", evidenceUrl: "https://elbitsystems.com/", evidenceType: "official_site", confidence: 80 },
  { companyTicker: "RKLB", technologyId: "satellite", capabilityType: "manufactures", productName: "Launch & satellites", evidenceUrl: "https://www.rocketlabusa.com/", evidenceType: "official_site", confidence: 70 },
  // energy
  { companyTicker: "ETN", technologyId: "grid", componentId: "grid_transformer", capabilityType: "manufactures", productName: "Grid equipment", evidenceUrl: "https://www.eaton.com/", evidenceType: "official_site", confidence: 78 },
  { companyTicker: "CCJ", technologyId: "uranium", capabilityType: "supplies", productName: "Uranium fuel", evidenceUrl: "https://www.cameco.com/", evidenceType: "official_site", confidence: 82 },
  { companyTicker: "XOM", technologyId: "turbine", capabilityType: "supplies", productName: "Oil & gas", evidenceUrl: "https://corporate.exxonmobil.com/", evidenceType: "official_site", confidence: 80 },
];

// explicit supply-chain edges (each with evidence)
export const COMPANY_EDGES: CompanyEdge[] = [
  { source: "NVDA", target: "TSM", type: "BUYS_FROM", description: "NVIDIA מייצרת שבבים ב-TSMC", evidenceUrl: "https://www.tsmc.com/english", confidence: 85 },
  { source: "NVDA", target: "MU", type: "DEPENDS_ON", description: "מאיצי AI דורשים זיכרון HBM", evidenceUrl: "https://www.micron.com/products/memory/hbm", confidence: 80 },
  { source: "TSM", target: "ASML", type: "BUYS_FROM", description: "מפעלי שבבים רוכשים ציוד EUV מ-ASML", evidenceUrl: "https://www.asml.com/", confidence: 88 },
  { source: "NVDA", target: "AMD", type: "COMPETES_WITH", description: "מתחרות בשוק מאיצי AI", evidenceUrl: "https://www.amd.com/en/products/accelerators.html", confidence: 70 },
  { source: "LMT", target: "RTX", type: "COMPETES_WITH", description: "מתחרות בשוק מערכות הגנה", evidenceUrl: "https://www.rtx.com/", confidence: 65 },
];

// canonical primary sector -> ordered technology chain
export const SECTOR_TECH_CHAIN: Record<string, string[]> = {
  ai: ["gpu", "hbm", "advpkg", "fabtool", "optical", "switch", "cooling", "power", "dcreit", "cyber", "storage"],
  datacenter: ["gpu", "cooling", "power", "dcreit", "optical", "switch"],
  defense: ["missiles", "radar", "milcomms", "drones", "satellite", "cyber"],
  energy: ["turbine", "grid", "battery", "uranium", "power"],
  crypto: ["gpu", "cyber"],
};
