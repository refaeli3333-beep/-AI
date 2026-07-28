import { AssetLite, SECTOR_CHAIN } from "../analysis/investigate";

// Real tickers with sector / sub-sector for mapping. Prices come from the market
// provider at runtime; entry/current here are only placeholders for DEMO scoring.
export const ASSET_UNIVERSE: AssetLite[] = [
  { id: 1, symbol: "NVDA", name: "NVIDIA", sector: "chips", entry: 120, current: 138, vol: 0.4, marketCap: 3000, type: "stock" },
  { id: 2, symbol: "AMD", name: "AMD", sector: "chips", entry: 150, current: 165, vol: 0.45, marketCap: 260, type: "stock" },
  { id: 3, symbol: "AVGO", name: "Broadcom", sector: "chips", entry: 160, current: 175, vol: 0.35, marketCap: 700, type: "stock" },
  { id: 4, symbol: "TSM", name: "TSMC", sector: "chips", entry: 170, current: 190, vol: 0.33, marketCap: 900, type: "stock" },
  { id: 5, symbol: "ASML", name: "ASML", sector: "chip_equipment", sub: "chip_equipment", entry: 900, current: 980, vol: 0.34, marketCap: 380, type: "stock" },
  { id: 6, symbol: "AMAT", name: "Applied Materials", sector: "chip_equipment", sub: "chip_equipment", entry: 200, current: 215, vol: 0.36, marketCap: 170, type: "stock" },
  { id: 7, symbol: "LRCX", name: "Lam Research", sector: "chip_equipment", sub: "chip_equipment", entry: 90, current: 98, vol: 0.38, marketCap: 110, type: "stock" },
  { id: 8, symbol: "MU", name: "Micron", sector: "memory", sub: "memory", entry: 110, current: 125, vol: 0.5, marketCap: 130, type: "stock" },
  { id: 9, symbol: "VRT", name: "Vertiv", sector: "cooling", sub: "cooling", entry: 90, current: 110, vol: 0.55, marketCap: 40, type: "stock" },
  { id: 10, symbol: "ETN", name: "Eaton", sector: "power", sub: "power", entry: 300, current: 330, vol: 0.3, marketCap: 130, type: "stock" },
  { id: 11, symbol: "GEV", name: "GE Vernova", sector: "power", sub: "power", entry: 300, current: 360, vol: 0.45, marketCap: 90, type: "stock" },
  { id: 12, symbol: "GLW", name: "Corning", sector: "fiber", sub: "fiber", entry: 40, current: 46, vol: 0.32, marketCap: 40, type: "stock" },
  { id: 13, symbol: "DELL", name: "Dell", sector: "servers", sub: "servers", entry: 110, current: 125, vol: 0.42, marketCap: 90, type: "stock" },
  { id: 14, symbol: "SMCI", name: "Super Micro", sector: "servers", sub: "servers", entry: 40, current: 48, vol: 0.7, marketCap: 25, type: "stock" },
  { id: 15, symbol: "EQIX", name: "Equinix", sector: "datacenter", sub: "datacenter", entry: 800, current: 860, vol: 0.28, marketCap: 80, type: "stock" },
  { id: 16, symbol: "CRWD", name: "CrowdStrike", sector: "cyber", sub: "cyber", entry: 300, current: 340, vol: 0.5, marketCap: 80, type: "stock" },
  { id: 17, symbol: "PANW", name: "Palo Alto Networks", sector: "cyber", sub: "cyber", entry: 180, current: 200, vol: 0.4, marketCap: 120, type: "stock" },
  { id: 18, symbol: "MSFT", name: "Microsoft", sector: "datacenter", entry: 420, current: 450, vol: 0.25, marketCap: 3200, type: "stock" },
  { id: 19, symbol: "LMT", name: "Lockheed Martin", sector: "defense", entry: 450, current: 470, vol: 0.22, marketCap: 110, type: "stock" },
  { id: 20, symbol: "RTX", name: "RTX", sector: "defense", entry: 100, current: 108, vol: 0.24, marketCap: 150, type: "stock" },
  { id: 21, symbol: "NOC", name: "Northrop Grumman", sector: "defense", entry: 480, current: 500, vol: 0.23, marketCap: 70, type: "stock" },
  { id: 22, symbol: "ESLT", name: "Elbit Systems", sector: "defense", entry: 200, current: 220, vol: 0.3, marketCap: 12, type: "stock" },
  { id: 23, symbol: "RKLB", name: "Rocket Lab", sector: "space", sub: "space", entry: 6, current: 9, vol: 0.8, marketCap: 4, type: "stock" },
  { id: 24, symbol: "XOM", name: "ExxonMobil", sector: "oil", sub: "oil", entry: 110, current: 118, vol: 0.28, marketCap: 470, type: "stock" },
  { id: 25, symbol: "CVX", name: "Chevron", sector: "oil", sub: "oil", entry: 150, current: 158, vol: 0.27, marketCap: 290, type: "stock" },
  { id: 26, symbol: "CCJ", name: "Cameco", sector: "nuclear", sub: "nuclear", entry: 45, current: 52, vol: 0.5, marketCap: 22, type: "stock" },
  { id: 27, symbol: "COIN", name: "Coinbase", sector: "crypto", entry: 200, current: 240, vol: 0.7, marketCap: 60, type: "stock" },
  { id: 28, symbol: "SQ", name: "Block", sector: "payments", sub: "payments", entry: 60, current: 68, vol: 0.55, marketCap: 40, type: "stock" },
];

const SUB_ROLE: Record<string, string> = {
  chip_equipment: "component", memory: "component", fiber: "component",
  servers: "supplier", cooling: "infrastructure", power: "infrastructure",
  datacenter: "infrastructure", cyber: "indirect", space: "indirect",
  oil: "direct_beneficiary", gas: "indirect", nuclear: "indirect", payments: "indirect",
};
// primary sector key -> the ticker sector that is the "direct beneficiary"
const PRIMARY_DIRECT: Record<string, string> = {
  ai: "chips", datacenter: "datacenter", defense: "defense", energy: "oil", crypto: "crypto",
};

export interface MappedAsset { asset: AssetLite; role: string; }

// Map detected canonical sectors to a de-duplicated candidate list across the chain.
export function mapAssets(sectors: string[]): MappedAsset[] {
  const seen = new Set<number>(); const out: MappedAsset[] = [];
  const add = (a: AssetLite, role: string) => { if (!seen.has(a.id)) { seen.add(a.id); out.push({ asset: a, role }); } };
  for (const sec of sectors) {
    const directSector = PRIMARY_DIRECT[sec] || sec;
    ASSET_UNIVERSE.filter((a) => a.sector === directSector).forEach((a) => add(a, "direct_beneficiary"));
    (SECTOR_CHAIN[sec] || []).forEach((sub) => {
      ASSET_UNIVERSE.filter((a) => a.sub === sub || a.sector === sub).forEach((a) => add(a, SUB_ROLE[sub] || "related"));
    });
  }
  return out;
}
