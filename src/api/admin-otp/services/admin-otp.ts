import crypto from "crypto";
import type { Core } from "@strapi/strapi";
import { errors } from "@strapi/utils";
import sessionAuth = require("../../../utils/strapi-session-auth");

const { ApplicationError, ValidationError } = errors;

const STORE_NAME = "admin-otp-login";
const STORE_KEY_PREFIX = "challenge:";
const RATE_LIMIT_KEY_PREFIX = "rate-limit:";
const OTP_DIGITS = 6;
const OTP_TTL_SECONDS = 5 * 60;
const MAX_ATTEMPTS = 5;
const MAX_RESENDS = 3;
const DEFAULT_RATE_LIMIT_WINDOW_SECONDS = 15 * 60;
const DEFAULT_LOGIN_IP_LIMIT = 10;
const DEFAULT_LOGIN_EMAIL_LIMIT = 5;
const DEFAULT_VERIFY_IP_LIMIT = 20;
const DEFAULT_VERIFY_EMAIL_LIMIT = 10;
const DEFAULT_RESEND_IP_LIMIT = 10;
const DEFAULT_RESEND_EMAIL_LIMIT = 5;

type AdminOtpChallenge = {
  id: string;
  userId: number;
  email: string;
  deviceId: string;
  rememberMe: boolean;
  salt: string;
  hash: string;
  attempts: number;
  resendCount: number;
  expiresAt: string;
};

type SessionResult = {
  refreshToken: string;
  cookieOptions: Record<string, unknown>;
  accessToken: string;
  user: unknown;
};

type RequestContext = {
  clientIp?: string;
};

type VerifyContext = RequestContext & {
  secureRequest: boolean;
};

type StrapiStore = ReturnType<Core.Strapi["store"]>;

type RateLimitAction = "login" | "verify" | "resend";
type RateLimitScope = "ip" | "email";

type RateLimitEntry = {
  count: number;
  resetAt: string;
};

const now = () => Date.now();

const shouldLogTimings = () =>
  process.env.ADMIN_OTP_DEBUG_TIMINGS === "true" || process.env.NODE_ENV !== "production";

const logDuration = (strapi: Core.Strapi, label: string, startedAt: number, meta?: Record<string, unknown>) => {
  if (!shouldLogTimings()) {
    return;
  }

  const durationMs = Date.now() - startedAt;
  const suffix = meta && Object.keys(meta).length > 0 ? ` ${JSON.stringify(meta)}` : "";
  strapi.log.info(`[admin-otp] ${label} completed in ${durationMs}ms${suffix}`);
};

const normalizeEmail = (email: unknown) => {
  if (typeof email !== "string") {
    return "";
  }

  return email.trim().toLowerCase();
};

const normalizeIp = (ip: unknown) => {
  if (typeof ip !== "string") {
    return "";
  }

  return ip.trim();
};

const ensureString = (value: unknown, message: string) => {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new ValidationError(message);
  }

  return value.trim();
};

const ensureOtpFormat = (value: unknown) => {
  const code = ensureString(value, "OTP code is required");

  if (!/^\d{6}$/.test(code)) {
    throw new ValidationError("OTP code must be a 6-digit number");
  }

  return code;
};

const parsePositiveInt = (value: string | undefined, fallback: number) => {
  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return Math.floor(parsed);
};

const createOtpCode = () =>
  crypto.randomInt(0, 10 ** OTP_DIGITS).toString().padStart(OTP_DIGITS, "0");

const createOtpHash = (challengeId: string, code: string, salt: string) =>
  new Promise<string>((resolve, reject) => {
    crypto.scrypt(`${challengeId}:${code}`, salt, 64, (error, derivedKey) => {
      if (error) {
        reject(error);
        return;
      }

      resolve(derivedKey.toString("hex"));
    });
  });

const getStore = (strapi: Core.Strapi) =>
  strapi.store({
    type: "plugin",
    name: STORE_NAME,
  });

const getStoreKey = (challengeId: string) => `${STORE_KEY_PREFIX}${challengeId}`;

const getRateLimitKey = (action: RateLimitAction, scope: RateLimitScope, identifier: string) => {
  const hash = crypto.createHash("sha256").update(identifier).digest("hex");
  return `${RATE_LIMIT_KEY_PREFIX}${action}:${scope}:${hash}`;
};

const getExpirySeconds = () => parsePositiveInt(process.env.ADMIN_OTP_TTL_SECONDS, OTP_TTL_SECONDS);

const getRateLimitWindowSeconds = () =>
  parsePositiveInt(process.env.ADMIN_OTP_RATE_LIMIT_WINDOW_SECONDS, DEFAULT_RATE_LIMIT_WINDOW_SECONDS);

const getRateLimitLimit = (action: RateLimitAction, scope: RateLimitScope) => {
  const key = `ADMIN_OTP_${action.toUpperCase()}_${scope.toUpperCase()}_LIMIT`;

  if (action === "login" && scope === "ip") {
    return parsePositiveInt(process.env[key], DEFAULT_LOGIN_IP_LIMIT);
  }

  if (action === "login" && scope === "email") {
    return parsePositiveInt(process.env[key], DEFAULT_LOGIN_EMAIL_LIMIT);
  }

  if (action === "verify" && scope === "ip") {
    return parsePositiveInt(process.env[key], DEFAULT_VERIFY_IP_LIMIT);
  }

  if (action === "verify" && scope === "email") {
    return parsePositiveInt(process.env[key], DEFAULT_VERIFY_EMAIL_LIMIT);
  }

  if (action === "resend" && scope === "ip") {
    return parsePositiveInt(process.env[key], DEFAULT_RESEND_IP_LIMIT);
  }

  return parsePositiveInt(process.env[key], DEFAULT_RESEND_EMAIL_LIMIT);
};

const deleteChallenge = async (store: StrapiStore, challengeId: string) => {
  await store.delete({ key: getStoreKey(challengeId) });
};

const getChallenge = async (store: StrapiStore, challengeId: string) => {
  const challenge = (await store.get({
    key: getStoreKey(challengeId),
  })) as AdminOtpChallenge | null;

  if (!challenge) {
    throw new ApplicationError("OTP session not found. Please log in again.");
  }

  if (new Date(challenge.expiresAt).getTime() <= Date.now()) {
    await deleteChallenge(store, challengeId);
    throw new ApplicationError("OTP expired. Please log in again.");
  }

  return challenge;
};

const registerRateLimitHit = async (
  store: StrapiStore,
  action: RateLimitAction,
  scope: RateLimitScope,
  identifier: string
) => {
  if (!identifier) {
    return;
  }

  const limit = getRateLimitLimit(action, scope);
  const windowSeconds = getRateLimitWindowSeconds();
  const key = getRateLimitKey(action, scope, identifier);
  const existing = (await store.get({ key })) as RateLimitEntry | null;
  const startedAt = Date.now();

  if (!existing || new Date(existing.resetAt).getTime() <= startedAt) {
    await store.set({
      key,
      value: {
        count: 1,
        resetAt: new Date(startedAt + windowSeconds * 1000).toISOString(),
      } satisfies RateLimitEntry,
    });
    return;
  }

  if (existing.count >= limit) {
    throw new ApplicationError("Too many authentication attempts. Please wait a few minutes and try again.");
  }

  await store.set({
    key,
    value: {
      ...existing,
      count: existing.count + 1,
    } satisfies RateLimitEntry,
  });
};

const sendOtpEmail = async (strapi: Core.Strapi, email: string, code: string) => {
  const startedAt = now();
  await strapi.plugin("email").service("email").send({
    to: email,
    subject: "Your admin login OTP code",
    text: `Your OTP code is ${code}. It expires in ${Math.floor(getExpirySeconds() / 60)} minutes.`,
    html: `
      <p>Your admin login OTP code is <strong>${code}</strong>.</p>
      <p>This code expires in ${Math.floor(getExpirySeconds() / 60)} minutes.</p>
      <p>If you did not try to sign in, please change your password immediately.</p>
    `,
  });
  logDuration(strapi, "sendOtpEmail", startedAt);
};

const createSession = async (
  strapi: Core.Strapi,
  userId: number,
  deviceId: string,
  rememberMe: boolean,
  secureRequest: boolean
): Promise<SessionResult> => {
  const sessionManager = sessionAuth.getSessionManager();

  if (!sessionManager) {
    throw new ApplicationError("Admin session manager is not available");
  }

  const { token: refreshToken, absoluteExpiresAt } = await sessionManager("admin").generateRefreshToken(
    String(userId),
    deviceId,
    {
      type: rememberMe ? "refresh" : "session",
    }
  );

  const cookieOptions = sessionAuth.buildCookieOptionsWithExpiry(
    rememberMe ? "refresh" : "session",
    absoluteExpiresAt,
    secureRequest
  );

  const accessResult = await sessionManager("admin").generateAccessToken(refreshToken);

  if ("error" in accessResult) {
    throw new ApplicationError("Failed to generate admin access token");
  }

  const userService = strapi.service("admin::user");
  const user = await strapi.db.query("admin::user").findOne({
    where: { id: userId },
  });

  if (!user) {
    throw new ApplicationError("Admin user no longer exists");
  }

  return {
    refreshToken,
    cookieOptions,
    accessToken: accessResult.token,
    user: userService.sanitizeUser(user),
  };
};

export default ({ strapi }: { strapi: Core.Strapi }) => ({
  async createChallenge(body: Record<string, unknown>, context: RequestContext = {}) {
    const requestStartedAt = now();
    const email = normalizeEmail(body.email);
    const password = ensureString(body.password, "Password is required");
    const clientIp = normalizeIp(context.clientIp);
    const deviceId =
      typeof body.deviceId === "string" && body.deviceId.trim().length > 0
        ? body.deviceId.trim()
        : sessionAuth.generateDeviceId();
    const rememberMe = Boolean(body.rememberMe);
    const store = getStore(strapi);

    if (!email) {
      throw new ValidationError("Email is required");
    }

    await registerRateLimitHit(store, "login", "ip", clientIp);
    await registerRateLimitHit(store, "login", "email", email);

    const credentialsStartedAt = now();
    const [, user, info] = (await strapi.service("admin::auth").checkCredentials({
      email,
      password,
    })) as [null, { id: number; email: string } | false, { message?: string }?];
    logDuration(strapi, "checkCredentials", credentialsStartedAt);

    if (!user) {
      throw new ApplicationError(info?.message ?? "Invalid credentials");
    }

    const challengeId = crypto.randomUUID();
    const code = createOtpCode();
    const salt = crypto.randomBytes(16).toString("hex");
    const expiresAt = new Date(Date.now() + getExpirySeconds() * 1000).toISOString();
    const hashStartedAt = now();
    const hash = await createOtpHash(challengeId, code, salt);
    logDuration(strapi, "createOtpHash", hashStartedAt, { challengeId });

    const challenge: AdminOtpChallenge = {
      id: challengeId,
      userId: user.id,
      email,
      deviceId,
      rememberMe,
      salt,
      hash,
      attempts: 0,
      resendCount: 0,
      expiresAt,
    };

    const storeStartedAt = now();
    await store.set({
      key: getStoreKey(challengeId),
      value: challenge,
    });
    logDuration(strapi, "storeChallenge", storeStartedAt, { challengeId });

    await sendOtpEmail(strapi, email, code);
    logDuration(strapi, "createChallenge", requestStartedAt, { challengeId });

    return {
      challengeId,
      expiresAt,
      maskedEmail: email,
      rememberMe,
    };
  },

  async resendChallenge(body: Record<string, unknown>, context: RequestContext = {}) {
    const requestStartedAt = now();
    const challengeId = ensureString(body.challengeId, "Challenge ID is required");
    const clientIp = normalizeIp(context.clientIp);
    const store = getStore(strapi);

    await registerRateLimitHit(store, "resend", "ip", clientIp);

    const loadStartedAt = now();
    const current = await getChallenge(store, challengeId);
    logDuration(strapi, "loadChallengeForResend", loadStartedAt, { challengeId });

    await registerRateLimitHit(store, "resend", "email", current.email);

    if (current.resendCount >= MAX_RESENDS) {
      await deleteChallenge(store, challengeId);
      throw new ApplicationError("Maximum OTP resend attempts exceeded. Please log in again.");
    }

    const code = createOtpCode();
    const salt = crypto.randomBytes(16).toString("hex");
    const hashStartedAt = now();
    const hash = await createOtpHash(challengeId, code, salt);
    logDuration(strapi, "createOtpHashForResend", hashStartedAt, { challengeId });

    const nextChallenge: AdminOtpChallenge = {
      ...current,
      salt,
      hash,
      resendCount: current.resendCount + 1,
      attempts: 0,
      expiresAt: new Date(Date.now() + getExpirySeconds() * 1000).toISOString(),
    };

    const storeStartedAt = now();
    await store.set({
      key: getStoreKey(challengeId),
      value: nextChallenge,
    });
    logDuration(strapi, "storeResentChallenge", storeStartedAt, { challengeId });

    await sendOtpEmail(strapi, current.email, code);
    logDuration(strapi, "resendChallenge", requestStartedAt, { challengeId });

    return {
      challengeId,
      expiresAt: nextChallenge.expiresAt,
      maskedEmail: current.email,
    };
  },

  async verifyChallenge(body: Record<string, unknown>, context: VerifyContext) {
    const requestStartedAt = now();
    const challengeId = ensureString(body.challengeId, "Challenge ID is required");
    const code = ensureOtpFormat(body.code);
    const clientIp = normalizeIp(context.clientIp);
    const store = getStore(strapi);

    await registerRateLimitHit(store, "verify", "ip", clientIp);

    const loadStartedAt = now();
    const challenge = await getChallenge(store, challengeId);
    logDuration(strapi, "loadChallengeForVerify", loadStartedAt, { challengeId });

    await registerRateLimitHit(store, "verify", "email", challenge.email);

    if (challenge.attempts >= MAX_ATTEMPTS) {
      await deleteChallenge(store, challengeId);
      throw new ApplicationError("Maximum OTP attempts exceeded. Please log in again.");
    }

    const hashStartedAt = now();
    const computedHash = await createOtpHash(challengeId, code, challenge.salt);
    logDuration(strapi, "createOtpHashForVerify", hashStartedAt, { challengeId });

    const isValid = crypto.timingSafeEqual(
      Buffer.from(computedHash, "hex"),
      Buffer.from(challenge.hash, "hex")
    );

    if (!isValid) {
      const nextAttempts = challenge.attempts + 1;

      if (nextAttempts >= MAX_ATTEMPTS) {
        await deleteChallenge(store, challengeId);
        throw new ApplicationError("Maximum OTP attempts exceeded. Please log in again.");
      }

      const storeStartedAt = now();
      await store.set({
        key: getStoreKey(challengeId),
        value: {
          ...challenge,
          attempts: nextAttempts,
        },
      });
      logDuration(strapi, "storeFailedAttempt", storeStartedAt, {
        challengeId,
        attempts: nextAttempts,
      });

      throw new ApplicationError("Invalid OTP code");
    }

    const deleteStartedAt = now();
    await deleteChallenge(store, challengeId);
    logDuration(strapi, "deleteChallengeAfterVerify", deleteStartedAt, { challengeId });

    const sessionStartedAt = now();
    const session = await createSession(
      strapi,
      challenge.userId,
      challenge.deviceId,
      challenge.rememberMe,
      context.secureRequest
    );
    logDuration(strapi, "createSession", sessionStartedAt, { challengeId });
    logDuration(strapi, "verifyChallenge", requestStartedAt, { challengeId });

    return session;
  },
});
