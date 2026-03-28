import type { Core } from "@strapi/strapi";

import sessionAuth = require("../../../utils/strapi-session-auth");

const getService = (strapi: Core.Strapi) =>
  strapi.service("api::admin-otp.admin-otp");

const setRefreshCookie = (ctx: any, refreshToken: string, cookieOptions: Record<string, unknown>) => {
  ctx.cookies.set(sessionAuth.REFRESH_COOKIE_NAME, refreshToken, cookieOptions);
};

export default {
  async login(ctx: any) {
    const service = getService(strapi as Core.Strapi);
    const result = await service.createChallenge(ctx.request.body ?? {});

    ctx.body = { data: result };
  },

  async resend(ctx: any) {
    const service = getService(strapi as Core.Strapi);
    const result = await service.resendChallenge(ctx.request.body ?? {});

    ctx.body = { data: result };
  },

  async verify(ctx: any) {
    const service = getService(strapi as Core.Strapi);
    const result = await service.verifyChallenge(ctx.request.body ?? {}, {
      secureRequest: ctx.request.secure,
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
