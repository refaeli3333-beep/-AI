// $200 simulation math (SIMULATION ONLY). Fractional units allowed; no whole-share rounding.
export interface SimResult { units: number; currentValue: number; profitLoss: number; profitLossPercent: number; }

export function simulate(amount: number, entryPrice: number, currentPrice: number): SimResult {
  if (!entryPrice || entryPrice <= 0) throw new Error("entryPrice must be > 0");
  const units = amount / entryPrice;
  const currentValue = units * currentPrice;
  const profitLoss = currentValue - amount;
  const profitLossPercent = (profitLoss / amount) * 100;
  return { units, currentValue, profitLoss, profitLossPercent };
}

export interface PricePoint { key: string; price: number; }

// reaction metrics over a price path relative to the entry price
export function reactionMetrics(path: PricePoint[]) {
  const entry = path[0].price;
  const cross = (thr: number) => path.slice(1).find((p) => Math.abs((p.price - entry) / entry * 100) >= thr) || null;
  let peak = path[0], trough = path[0], peakIdx = 0;
  path.forEach((p, i) => { if (p.price > peak.price) { peak = p; peakIdx = i; } if (p.price < trough.price) trough = p; });
  const cur = path[path.length - 1].price;
  const maxRet = (peak.price - entry) / entry * 100;
  const maxLoss = (trough.price - entry) / entry * 100;
  const gainWindow = peak.price - entry;
  const erased = maxRet > 3 && cur < entry + gainWindow * 0.4;
  const gainHeld = maxRet > 2 && cur >= entry + gainWindow * 0.6;
  let returnedToEntry = false;
  for (let i = peakIdx + 1; i < path.length; i++) if (path[i].price <= entry * 1.005) { returnedToEntry = true; break; }
  return { t1: cross(1), t3: cross(3), t5: cross(5), peak, trough, maxRet, maxLoss, erased, gainHeld, returnedToEntry };
}
