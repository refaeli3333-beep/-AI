import { NextRequest, NextResponse } from "next/server";
import { getRun } from "@/lib/command/runner";

export const dynamic = "force-dynamic";

// GET /api/scan-command/:runId
export async function GET(_req: NextRequest, { params }: { params: { runId: string } }) {
  const run = getRun(params.runId);
  if (!run) return NextResponse.json({ error: "run not found" }, { status: 404 });
  return NextResponse.json({
    status: run.status, progress: run.progress, stage: run.stage,
    parsedCommand: run.parsed, providersUsed: run.providersUsed, providerNotes: run.providerNotes,
    resultCount: run.resultCount, signalCount: run.signalCount,
    verifiedCount: run.verifiedCount, rejectedCount: run.rejectedCount,
    results: run.results, errors: run.errors,
  });
}
