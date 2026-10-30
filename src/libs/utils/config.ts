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

// set CORS_ORIGINS="https://a.com,https://b.com" to restrict; unset keeps "any origin"
const corsOrigins = (process.env.CORS_ORIGINS ?? "")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);
export const corsOptions = {
  credentials: true,
  exposedHeaders: ["X-Total-Count", "X-Unread-Count"],
  origin: corsOrigins.length ? corsOrigins : true,
};

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
