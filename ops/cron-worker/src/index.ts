/**
 * PMS Cron Worker
 *
 * Cloudflare Worker that triggers iCal sync on your Vercel-hosted PMS.
 * Runs on a cron schedule (every 30 minutes) via Cloudflare Cron Triggers.
 *
 * Environment Secrets (set via `npx wrangler secret put`):
 *   - SYNC_URL:    Full URL to your sync endpoint (e.g. https://your-app.vercel.app/api/cron/sync)
 *   - CRON_SECRET: Must match the CRON_SECRET in your Vercel .env
 */

export interface Env {
    SYNC_URL: string;
    CRON_SECRET: string;
}

export default {
    // Cron Trigger handler
    async scheduled(
        _event: ScheduledEvent,
        env: Env,
        ctx: ExecutionContext
    ): Promise<void> {
        ctx.waitUntil(triggerSync(env));
    },

    // Optional: also allow manual trigger via HTTP
    async fetch(
        _request: Request,
        env: Env,
        _ctx: ExecutionContext
    ): Promise<Response> {
        try {
            const result = await triggerSync(env);
            return new Response(JSON.stringify(result), {
                headers: { "Content-Type": "application/json" },
            });
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : String(err);
            return new Response(JSON.stringify({ error: message }), {
                status: 500,
                headers: { "Content-Type": "application/json" },
            });
        }
    },
};

async function triggerSync(env: Env) {
    const url = env.SYNC_URL;
    const secret = env.CRON_SECRET;

    if (!url || !secret) {
        throw new Error("Missing SYNC_URL or CRON_SECRET environment variables");
    }

    console.log(`[cron] Triggering sync at ${new Date().toISOString()}`);

    const res = await fetch(url, {
        method: "GET",
        headers: {
            "x-cron-secret": secret,
            "User-Agent": "PMS-Cron-Worker/1.0",
        },
    });

    if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`Sync failed: ${res.status} ${text}`);
    }

    const result = await res.json();
    console.log(`[cron] Sync result:`, JSON.stringify(result));
    return result;
}
