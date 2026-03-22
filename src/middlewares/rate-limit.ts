import type { Core } from "@strapi/strapi";

type Bucket = {
  count: number;
  resetAt: number;
};

const buckets = new Map<string, Bucket>();

function getClientIp(ctx: any) {
  const forwarded = ctx.request.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.length > 0) {
    return forwarded.split(",")[0]?.trim() || "unknown";
  }

  return ctx.request.ip || ctx.ip || "unknown";
}

export default (config: { max?: number; windowMs?: number; paths?: string[] } = {}, _context: { strapi: Core.Strapi }) => {
  const max = config.max ?? 100;
  const windowMs = config.windowMs ?? 60_000;
  const paths = config.paths?.length ? config.paths : ["/api"];

  return async (ctx: any, next: () => Promise<void>) => {
    if (!paths.some((path) => ctx.path.startsWith(path))) {
      return next();
    }

    const now = Date.now();
    const ip = getClientIp(ctx);
    const key = `${ip}:${ctx.path.split("?")[0]}`;
    const current = buckets.get(key);

    if (!current || current.resetAt <= now) {
      buckets.set(key, {
        count: 1,
        resetAt: now + windowMs
      });

      ctx.set("X-RateLimit-Limit", String(max));
      ctx.set("X-RateLimit-Remaining", String(max - 1));
      ctx.set("X-RateLimit-Reset", String(Math.ceil((now + windowMs) / 1000)));

      return next();
    }

    if (current.count >= max) {
      const retryAfterSeconds = Math.max(1, Math.ceil((current.resetAt - now) / 1000));

      ctx.set("X-RateLimit-Limit", String(max));
      ctx.set("X-RateLimit-Remaining", "0");
      ctx.set("X-RateLimit-Reset", String(Math.ceil(current.resetAt / 1000)));
      ctx.set("Retry-After", String(retryAfterSeconds));
      ctx.status = 429;
      ctx.body = {
        error: "Too Many Requests",
        message: "Rate limit exceeded. Please try again later."
      };
      return;
    }

    current.count += 1;
    buckets.set(key, current);

    ctx.set("X-RateLimit-Limit", String(max));
    ctx.set("X-RateLimit-Remaining", String(Math.max(0, max - current.count)));
    ctx.set("X-RateLimit-Reset", String(Math.ceil(current.resetAt / 1000)));

    await next();
  };
};
