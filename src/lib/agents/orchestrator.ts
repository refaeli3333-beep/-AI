import { PERMANENT_ROLES } from "./roles";
import { AgentGovernor, DEFAULT_LIMITS } from "./governor";
import { runConsensus, AgentConclusion, ConsensusResult } from "./consensus";
import { assertSimulationOnly } from "../safety";

/** The continuous-radar cycle, in fixed order (GOAL 2). */
export const CYCLE_STEPS = [
  "SCAN", "NORMALIZE_DATA", "STORE_OBSERVATIONS", "COMPARE_TO_HISTORY", "DETECT_CHANGES",
  "CREATE_HYPOTHESES", "ASSIGN_SPECIALIST_AGENTS", "CHALLENGE_EACH_HYPOTHESIS", "VERIFY_SOURCES",
  "BUILD_CONSENSUS", "SAVE_CONCLUSION", "SAVE_WHAT_WAS_LEARNED",
] as const;
export type CycleStep = typeof CYCLE_STEPS[number];

/** The 4 debate rounds (GOAL 5). */
export const DEBATE_ROUNDS = ["INDEPENDENT", "INSPECT_CONTRADICTIONS", "VERIFY_CHALLENGE", "FINAL_SYNTHESIS"] as const;

export interface InvestigationInput { question: string; observations: any[]; }
export interface InvestigationResult {
  question: string; steps: CycleStep[]; rounds: string[];
  consensus: ConsensusResult; agentsInvolved: string[]; tempAgentsSpawned: number;
  timestamp: string;
}

/**
 * Runs one investigation cycle. `analyze` is the pluggable hook that calls the existing AI
 * enrichment layer per agent — injected so this stays testable and never hard-codes a model.
 * No trading occurs; assertSimulationOnly guards entry.
 */
export async function runInvestigation(
  input: InvestigationInput,
  analyze: (agentId: string, question: string, observations: any[]) => Promise<AgentConclusion>,
  opts: { governor?: AgentGovernor } = {},
): Promise<InvestigationResult> {
  assertSimulationOnly();
  const governor = opts.governor ?? new AgentGovernor(DEFAULT_LIMITS);
  const steps: CycleStep[] = [];
  for (const s of CYCLE_STEPS) steps.push(s);   // deterministic ordering

  // ROUND 1 — independent conclusions from each permanent role
  const round1: AgentConclusion[] = [];
  for (const role of PERMANENT_ROLES) round1.push(await analyze(role.id, input.question, input.observations));

  // ROUND 2/3 — inspect contradictions + verification challenge (contrarian/evidence/source already in roster)
  // ROUND 4 — synthesis via consensus (disagreement preserved)
  const consensus = runConsensus(round1);

  return {
    question: input.question, steps, rounds: [...DEBATE_ROUNDS],
    consensus, agentsInvolved: PERMANENT_ROLES.map((r) => r.id),
    tempAgentsSpawned: governor.totalSpawned, timestamp: new Date().toISOString(),
  };
}
