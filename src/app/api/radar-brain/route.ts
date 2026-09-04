import { NextResponse } from "next/server";
import { PERMANENT_ROLES } from "@/lib/agents/roles";
import { DEFAULT_LIMITS } from "@/lib/agents/governor";
import { providerStatuses } from "@/lib/providers/registry";
import { allSyncStates } from "@/lib/providers/syncState";
import { SAFETY } from "@/lib/safety";

export const dynamic = "force-dynamic";

export async function GET() {
  const providers = await providerStatuses();
  const lastLiveScan = allSyncStates().map((s) => s.lastSuccessfulSyncAt).filter(Boolean).sort().pop() || null;
  return NextResponse.json({
    safety: SAFETY,
    permanentAgents: PERMANENT_ROLES,
    limits: DEFAULT_LIMITS,
    activeInvestigations: [],       // populated by the background radar when running (no fabrication)
    temporaryAgents: [],
    providerStatus: providers.map((p) => ({ key: p.key, label: p.label, connected: p.connected })),
    lastLiveScan,
    note: "רשימת הסוכנים הקבועים והמגבלות. חקירות פעילות מופיעות כאן כשמנוע הרדאר רץ ברקע.",
  });
}
