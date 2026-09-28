import { safeEqual } from "@/server/crypto/hash";
import { logger } from "@/server/observability/logger";
import { getRuntime } from "@/server/runtime";

export const dynamic = "force-dynamic";

/** Scheduled maintenance (Vercel Cron): webhook retries and expiry purges. */
export async function GET(request: Request) {
  const runtime = getRuntime();
  const secret = runtime.config.cronSecret;
  const provided = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  if (!secret || !safeEqual(provided, secret)) return new Response("Unauthorized", { status: 401 });
  await runtime.ready;
  const delivered = await runtime.webhooks.processDue(100);
  await runtime.store.purgeExpired(new Date().toISOString());
  logger.info("maintenance completed", { webhookDeliveriesProcessed: delivered });
  return Response.json({ ok: true, webhook_deliveries_processed: delivered });
}
