import { NextFunction, Request, Response } from "express";
import Errors, { HttpCode, Message } from "./Errors";

// small in-memory limiter (per IP, per process)
export const rateLimit = (max: number, windowMs: number) => {
  const hits = new Map<string, { count: number; reset: number }>();

  return (req: Request, res: Response, next: NextFunction) => {
    const now = Date.now();
    if (hits.size > 5000) {
      hits.forEach((v, k) => {
        if (v.reset <= now) hits.delete(k);
      });
    }

    const key = req.ip ?? "unknown";
    let entry = hits.get(key);
    if (!entry || entry.reset <= now) {
      entry = { count: 0, reset: now + windowMs };
      hits.set(key, entry);
    }
    entry.count++;

    if (entry.count > max) {
      res.setHeader("Retry-After", Math.ceil((entry.reset - now) / 1000));
      const err = new Errors(HttpCode.TOO_MANY_REQUESTS, Message.TOO_MANY_REQUESTS);
      return res.status(err.code).json(err);
    }
    next();
  };
};
