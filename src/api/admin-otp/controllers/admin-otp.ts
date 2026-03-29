import type { Core } from "@strapi/strapi";

import sessionAuth = require("../../../utils/strapi-session-auth");

const getService = (strapi: Core.Strapi) =>
  strapi.service("api::admin-otp.admin-otp");

const setRefreshCookie = (ctx: any, refreshToken: string, cookieOptions: Record<string, unknown>) => {
  ctx.cookies.set(sessionAuth.REFRESH_COOKIE_NAME, refreshToken, cookieOptions);
};

const getClientIp = (ctx: any) => {
  const forwardedFor = ctx.request.headers["x-forwarded-for"];

  if (typeof forwardedFor === "string" && forwardedFor.trim().length > 0) {
    return forwardedFor.split(",")[0].trim();
  }

  if (Array.isArray(forwardedFor) && forwardedFor.length > 0) {
    return String(forwardedFor[0]).trim();
  }

  return String(ctx.request.ip ?? ctx.ip ?? "").trim();
};

export default {
  async login(ctx: any) {
    const service = getService(strapi as Core.Strapi);
    const result = await service.createChallenge(ctx.request.body ?? {}, {
      clientIp: getClientIp(ctx),
    });

    ctx.body = { data: result };
  },

  async resend(ctx: any) {
    const service = getService(strapi as Core.Strapi);
    const result = await service.resendChallenge(ctx.request.body ?? {}, {
      clientIp: getClientIp(ctx),
    });

    ctx.body = { data: result };
  },

  async verify(ctx: any) {
    const service = getService(strapi as Core.Strapi);
    const result = await service.verifyChallenge(ctx.request.body ?? {}, {
      secureRequest: ctx.request.secure,
      clientIp: getClientIp(ctx),
    });

    setRefreshCookie(ctx, result.refreshToken, result.cookieOptions);

    ctx.body = {
      data: {
        token: result.accessToken,
        accessToken: result.accessToken,
        user: result.user,
      },
    };
  },
};
