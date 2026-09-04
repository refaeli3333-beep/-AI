/** Hard safety flags. SIMULATION ONLY — the app never trades, routes orders, or uses real money. */
export const SAFETY = {
  SIMULATION_ONLY: true,
  LIVE_TRADING: false,
  REAL_MONEY: false,
  LEVERAGE: false,
  BROKER_CONNECTED: false,
  ORDER_ROUTING: false,
} as const;

/** Throws if any unsafe flag were ever flipped. Call at app/orchestration entry points. */
export function assertSimulationOnly(): void {
  if (!SAFETY.SIMULATION_ONLY || SAFETY.LIVE_TRADING || SAFETY.REAL_MONEY || SAFETY.LEVERAGE || SAFETY.BROKER_CONNECTED || SAFETY.ORDER_ROUTING)
    throw new Error("SAFETY VIOLATION: simulation-only invariant broken");
}
