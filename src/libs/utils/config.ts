import mongoose from "mongoose";
import Errors, { HttpCode, Message } from "./Errors";

export const AUTH_TIMER = 24;
export const MORGAN_FORMAT = `:method :url :response-time [:status] \n`;

export const BOOKING_HOURS = Array.from({ length: 24 }, (_, i) =>
  `${i.toString().padStart(2, "0")}:00`
)

// an unpaid (PENDING) booking only blocks its slot for this long
export const PENDING_HOLD_MINUTES = 60;
export const MAX_PAGE_LIMIT = 100;

/** CORS: only origins on the allow-list get credentialed access; any other browser origin gets no CORS headers.
 *  CORS_ORIGINS="https://a.com,https://b.com". When unset, the local dev frontends are allowed outside production
 *  and nothing cross-origin is allowed in production. Requests without an Origin header (curl, same-origin) are unaffected. */
export const LOCAL_DEV_ORIGINS = [
  "http://localhost:3000",
  "http://localhost:3001",
  "http://127.0.0.1:3000",
  "http://127.0.0.1:3001",
];
const configuredOrigins = (process.env.CORS_ORIGINS ?? "")
  .split(",")
  .map((o) => o.trim().replace(/\/+$/, ""))
  .filter(Boolean);
export const allowedOrigins = (): string[] =>
  configuredOrigins.length ? configuredOrigins : process.env.NODE_ENV === "production" ? [] : LOCAL_DEV_ORIGINS;
export const corsOptions = {
  credentials: true,
  exposedHeaders: ["X-Total-Count", "X-Unread-Count"],
  origin: (origin: string | undefined, cb: (err: Error | null, allow?: boolean) => void) =>
    cb(null, !origin || allowedOrigins().includes(origin)),
};

/** auth cookies: always httpOnly; SameSite and Secure come from the environment */
const SAME_SITE_VALUES = ["lax", "strict", "none"] as const;
export type SameSite = (typeof SAME_SITE_VALUES)[number];
export const cookieSettings = () => {
  const raw = (process.env.COOKIE_SAMESITE ?? "lax").toLowerCase();
  const sameSite: SameSite = (SAME_SITE_VALUES as readonly string[]).includes(raw) ? (raw as SameSite) : "lax";
  const secureEnv = process.env.COOKIE_SECURE;
  let secure = secureEnv === undefined || secureEnv === "" ? process.env.NODE_ENV === "production" : secureEnv === "true";
  if (sameSite === "none") secure = true; // browsers reject SameSite=None without Secure
  return { sameSite, secure };
};
export const authCookieOptions = () => ({
  maxAge: AUTH_TIMER * 3600 * 1000,
  httpOnly: true,
  ...cookieSettings(),
});
export const clearCookieOptions = () => ({ httpOnly: true, ...cookieSettings() });

/** TRUST_PROXY: "true", a hop count ("1"), or an Express value such as "loopback". Unset = do not trust proxies. */
export const parseTrustProxy = (value = process.env.TRUST_PROXY): boolean | number | string | undefined => {
  if (value === undefined || value.trim() === "") return undefined;
  const v = value.trim();
  if (v === "true") return true;
  if (v === "false") return false;
  if (/^\d+$/.test(v)) return Number(v);
  return v;
};

/** JSON / form bodies are small; file uploads have their own limits in multer */
export const BODY_LIMIT = "100kb";

export const isValidObjectIdString = (target: any): boolean =>
  typeof target === "string" && /^[0-9a-fA-F]{24}$/.test(target);

export const shapeIntoMongooseObjectId = (target: any) => {
  if (typeof target === "string") {
    if (!isValidObjectIdString(target))
      throw new Errors(HttpCode.BAD_REQUEST, Message.INVALID_ID);
    return new mongoose.Types.ObjectId(target);
  }
  if (target && typeof target.toHexString === "function") return target;
  throw new Errors(HttpCode.BAD_REQUEST, Message.INVALID_ID);
};

export const parsePagination = (page: any, limit: any, defaultLimit: number) => ({
  page: Math.max(1, Math.floor(Number(page)) || 1),
  limit: Math.min(
    MAX_PAGE_LIMIT,
    Math.max(1, Math.floor(Number(limit)) || defaultLimit)
  ),
});

// admin lists stay a plain array; they are only paged when the client sends page and/or limit
export const wantsPaging = (query: any): boolean =>
  query?.page !== undefined || query?.limit !== undefined;

export const escapeRegex = (text: string) =>
  text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export const isNonEmptyString = (v: any): v is string =>
  typeof v === "string" && v.trim().length > 0;

export const toOptionalNumber = (v: any): number | undefined =>
  v !== undefined && v !== "" && Number.isFinite(Number(v)) ? Number(v) : undefined;
