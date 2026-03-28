import crypto from "crypto";
import type { Core } from "@strapi/strapi";
import { errors } from "@strapi/utils";
import sessionAuth = require("../../../utils/strapi-session-auth");

const { ApplicationError, ValidationError } = errors;

const STORE_NAME = "admin-otp-login";
const STORE_KEY_PREFIX = "challenge:";
const OTP_DIGITS = 6;
const OTP_TTL_SECONDS = 10 * 60;
const MAX_ATTEMPTS = 5;
const MAX_RESENDS = 3;

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

type StrapiStore = ReturnType<Core.Strapi["store"]>;

const normalizeEmail = (email: unknown) => {
  if (typeof email !== "string") {
    return "";
  }

  return email.trim().toLowerCase();
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

const createOtpCode = () =>
  crypto.randomInt(0, 10 ** OTP_DIGITS).toString().padStart(OTP_DIGITS, "0");

const createOtpHash = (challengeId: string, code: string, salt: string) =>
  crypto.scryptSync(`${challengeId}:${code}`, salt, 64).toString("hex");

const getStore = (strapi: Core.Strapi) =>
  strapi.store({
    type: "plugin",
    name: STORE_NAME,
  });

const getStoreKey = (challengeId: string) => `${STORE_KEY_PREFIX}${challengeId}`;

const getExpirySeconds = () => {
  const raw = Number(process.env.ADMIN_OTP_TTL_SECONDS ?? OTP_TTL_SECONDS);

  if (!Number.isFinite(raw) || raw <= 0) {
    return OTP_TTL_SECONDS;
  }

  return Math.floor(raw);
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

const sendOtpEmail = async (strapi: Core.Strapi, email: string, code: string) => {
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
  async createChallenge(body: Record<string, unknown>) {
    const email = normalizeEmail(body.email);
    const password = ensureString(body.password, "Password is required");
    const deviceId =
      typeof body.deviceId === "string" && body.deviceId.trim().length > 0
        ? body.deviceId.trim()
        : sessionAuth.generateDeviceId();
    const rememberMe = Boolean(body.rememberMe);

    if (!email) {
      throw new ValidationError("Email is required");
    }

    const [, user, info] = (await strapi.service("admin::auth").checkCredentials({
      email,
      password,
    })) as [null, { id: number; email: string } | false, { message?: string }?];

    if (!user) {
      throw new ApplicationError(info?.message ?? "Invalid credentials");
    }

    const challengeId = crypto.randomUUID();
    const code = createOtpCode();
    const salt = crypto.randomBytes(16).toString("hex");
    const expiresAt = new Date(Date.now() + getExpirySeconds() * 1000).toISOString();
    const store = getStore(strapi);

    const challenge: AdminOtpChallenge = {
      id: challengeId,
      userId: user.id,
      email,
      deviceId,
      rememberMe,
      salt,
      hash: createOtpHash(challengeId, code, salt),
      attempts: 0,
      resendCount: 0,
      expiresAt,
    };

    await store.set({
      key: getStoreKey(challengeId),
      value: challenge,
    });

    await sendOtpEmail(strapi, email, code);

    return {
      challengeId,
      expiresAt,
      maskedEmail: email,
      rememberMe,
    };
  },

  async resendChallenge(body: Record<string, unknown>) {
    const challengeId = ensureString(body.challengeId, "Challenge ID is required");
    const store = getStore(strapi);
    const current = await getChallenge(store, challengeId);

    if (current.resendCount >= MAX_RESENDS) {
      await deleteChallenge(store, challengeId);
      throw new ApplicationError("Maximum OTP resend attempts exceeded. Please log in again.");
    }

    const code = createOtpCode();
    const salt = crypto.randomBytes(16).toString("hex");
    const nextChallenge: AdminOtpChallenge = {
      ...current,
      salt,
      hash: createOtpHash(challengeId, code, salt),
      resendCount: current.resendCount + 1,
      attempts: 0,
      expiresAt: new Date(Date.now() + getExpirySeconds() * 1000).toISOString(),
    };

    await store.set({
      key: getStoreKey(challengeId),
      value: nextChallenge,
    });

    await sendOtpEmail(strapi, current.email, code);

    return {
      challengeId,
      expiresAt: nextChallenge.expiresAt,
      maskedEmail: current.email,
    };
  },

  async verifyChallenge(
    body: Record<string, unknown>,
    options: { secureRequest: boolean }
  ) {
    const challengeId = ensureString(body.challengeId, "Challenge ID is required");
    const code = ensureOtpFormat(body.code);
    const store = getStore(strapi);
    const challenge = await getChallenge(store, challengeId);

    if (challenge.attempts >= MAX_ATTEMPTS) {
      await deleteChallenge(store, challengeId);
      throw new ApplicationError("Maximum OTP attempts exceeded. Please log in again.");
    }

    const computedHash = createOtpHash(challengeId, code, challenge.salt);
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

      await store.set({
        key: getStoreKey(challengeId),
        value: {
          ...challenge,
          attempts: nextAttempts,
        },
      });

      throw new ApplicationError("Invalid OTP code");
    }

    await deleteChallenge(store, challengeId);

    return createSession(
      strapi,
      challenge.userId,
      challenge.deviceId,
      challenge.rememberMe,
      options.secureRequest
    );
  },
});
