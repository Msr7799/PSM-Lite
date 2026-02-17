import { syncAllUnits } from "@/lib/sync";

export const runtime = "nodejs";
export const maxDuration = 60; // Vercel max for Hobby

/**
 * GET /api/cron/sync
 * Protected by x-cron-secret header (NOT query param for security).
 */
export async function GET(req: Request) {
  const secret = req.headers.get("x-cron-secret") ?? "";
  const expected = process.env.CRON_SECRET ?? "";

  if (!expected || secret !== expected) {
    return new Response("Unauthorized", { status: 401 });
  }

  const result = await syncAllUnits();
  return Response.json(result);
}
