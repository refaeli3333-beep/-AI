import { QuotaStatus } from "../providers/types";

// In-memory quota tracker (swap the store for Supabase api_usage in production).
const store = new Map<string, { used: number; rateLimited: boolean; day: string }>();
const today = () => new Date().toISOString().slice(0, 10);

export class QuotaTracker {
  constructor(private provider: string, private dailyQuota: number) {}
  private slot() {
    const d = today();
    let s = store.get(this.provider);
    if (!s || s.day !== d) { s = { used: 0, rateLimited: false, day: d }; store.set(this.provider, s); }
    return s;
  }
  async increment(n = 1, rateLimited = false) {
    const s = this.slot(); s.used += n; if (rateLimited) s.rateLimited = true;
  }
  async status(): Promise<QuotaStatus> {
    const s = this.slot();
    const remaining = Math.max(0, this.dailyQuota - s.used);
    return {
      provider: this.provider, used: s.used, dailyQuota: this.dailyQuota,
      remaining, rateLimited: s.rateLimited, exhausted: remaining <= 0,
    };
  }
  // true when < 20% of the daily quota remains → throttle low-priority people
  async lowRemaining(): Promise<boolean> {
    const st = await this.status();
    return st.remaining / st.dailyQuota < 0.2;
  }
}
