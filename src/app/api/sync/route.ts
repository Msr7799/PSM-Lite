import { syncAllUnits } from "@/lib/sync";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * POST /api/sync
 * Manual trigger from the UI (no secret required for local/dev use; add auth later).
 */
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const { unitId } = body;
  const result = await syncAllUnits(unitId);
  return Response.json(result);
}
