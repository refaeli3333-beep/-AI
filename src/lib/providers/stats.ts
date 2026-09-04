/**
 * Per-provider request statistics, shared by every module in the registry.
 * Only records what actually happened: a success is written after a real 2xx
 * response, an error after a real failure. Nothing here is ever inferred from
 * the presence of an environment variable.
 */
export interface ProviderStatsSnapshot {
  requests: number; errors: number;
  lastError: string | null; lastSuccessAt: string | null; rateLimited: boolean;
}

export class ProviderStats {
  private requests = 0;
  private errors = 0;
  private lastError: string | null = null;
  private lastSuccessAt: string | null = null;
  private rateLimited = false;

  success() { this.requests++; this.lastSuccessAt = new Date().toISOString(); this.rateLimited = false; }
  failure(message: string, rateLimited = false) {
    this.requests++; this.errors++; this.lastError = message;
    if (rateLimited) this.rateLimited = true;
  }
  snapshot(): ProviderStatsSnapshot {
    return { requests: this.requests, errors: this.errors, lastError: this.lastError,
      lastSuccessAt: this.lastSuccessAt, rateLimited: this.rateLimited };
  }
}

/** Minimum spacing between calls for providers with strict rate limits (e.g. GDELT: 1 req / 5s). */
export class MinInterval {
  private last = 0;
  constructor(private ms: number) {}
  ready(now = Date.now()) { return now - this.last >= this.ms; }
  msUntilReady(now = Date.now()) { return Math.max(0, this.ms - (now - this.last)); }
  mark(now = Date.now()) { this.last = now; }
}

/** fetch with a hard timeout so one hanging provider can never stall a scan. */
export async function fetchWithTimeout(url: string, init: RequestInit = {}, timeoutMs = 12_000): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try { return await fetch(url, { ...init, signal: ctrl.signal }); }
  finally { clearTimeout(timer); }
}

/** SEC and several public feeds require a descriptive User-Agent with contact info. */
export const PUBLIC_UA = process.env.PUBLIC_USER_AGENT || "MarketRadarAI/0.2 (simulation-only research tool)";
