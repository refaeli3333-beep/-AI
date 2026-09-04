/** Governs temporary sub-agents: prevents infinite spawning, enforces depth/concurrency/budget. */
export interface GovernorLimits { maxAgentDepth: number; maxConcurrentAgents: number; maxTemporaryAgentsPerInvestigation: number; maxTokenBudget: number; }
export const DEFAULT_LIMITS: GovernorLimits = { maxAgentDepth: 3, maxConcurrentAgents: 12, maxTemporaryAgentsPerInvestigation: 8, maxTokenBudget: 200_000 };

export interface TempAgent { id: string; question: string; job: string; depth: number; bornAt: number; maxLifetimeMs: number; done: boolean; }
export interface SpawnRequest { question: string; job: string; depth: number; maxLifetimeMs?: number; }
export interface SpawnResult { ok: boolean; agent?: TempAgent; reason?: string; }

export class AgentGovernor {
  private active = new Map<string, TempAgent>();
  private spawnedThisInvestigation = 0;
  private tokensUsed = 0;
  constructor(private limits: GovernorLimits = DEFAULT_LIMITS) {}

  get activeCount() { return [...this.active.values()].filter((a) => !a.done).length; }
  get totalSpawned() { return this.spawnedThisInvestigation; }
  get tokens() { return this.tokensUsed; }

  canSpawn(req: SpawnRequest): { ok: boolean; reason?: string } {
    if (!req.question || !req.question.trim()) return { ok: false, reason: "no_research_question" };  // never spawn without a question
    if (!req.job || !req.job.trim()) return { ok: false, reason: "no_specific_job" };
    if (req.depth > this.limits.maxAgentDepth) return { ok: false, reason: "max_depth_exceeded" };
    if (this.activeCount >= this.limits.maxConcurrentAgents) return { ok: false, reason: "max_concurrency_reached" };
    if (this.spawnedThisInvestigation >= this.limits.maxTemporaryAgentsPerInvestigation) return { ok: false, reason: "max_temporary_agents_reached" };
    if (this.tokensUsed >= this.limits.maxTokenBudget) return { ok: false, reason: "token_budget_exhausted" };
    return { ok: true };
  }

  spawn(req: SpawnRequest): SpawnResult {
    const gate = this.canSpawn(req);
    if (!gate.ok) return { ok: false, reason: gate.reason };
    const agent: TempAgent = { id: `tmp_${Date.now()}_${this.spawnedThisInvestigation}`, question: req.question, job: req.job,
      depth: req.depth, bornAt: Date.now(), maxLifetimeMs: req.maxLifetimeMs ?? 60_000, done: false };
    this.active.set(agent.id, agent);
    this.spawnedThisInvestigation++;
    return { ok: true, agent };
  }

  /** Every temporary agent must return evidence + confidence, then be destroyed. */
  complete(id: string, result: { evidence: any[]; confidence: number; tokens?: number }): boolean {
    const a = this.active.get(id); if (!a) return false;
    this.tokensUsed += result.tokens ?? 0;
    a.done = true; this.active.delete(id);   // destroyed after task
    return true;
  }

  /** Reap agents past their max lifetime (prevents leaks/infinite life). */
  reapExpired(now = Date.now()): string[] {
    const reaped: string[] = [];
    for (const [id, a] of this.active) if (now - a.bornAt > a.maxLifetimeMs) { this.active.delete(id); reaped.push(id); }
    return reaped;
  }
}
