import cors from "cors";
import mongoose from "mongoose";
import express from "express";
import path from "path";
import routerAdmin from "./routerAdmin";
import morgan from "morgan";
import cookieParser from "cookie-parser";
import multer from "multer";
import { NextFunction, Request, Response } from "express";
import { MORGAN_FORMAT, corsOptions } from "./libs/utils/config";
import { serveUploads } from "./libs/utils/uploads";
import Errors, { HttpCode } from "./libs/utils/Errors";

const app = express();
app.disable("x-powered-by");
app.use(express.static(path.join(__dirname, "public")));
app.use("/uploads", serveUploads);
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cors(corsOptions));
app.use(cookieParser());
app.use(morgan(MORGAN_FORMAT));

// liveness + database state, no auth
app.get("/health", (req, res) => {
  const db = mongoose.connection.readyState === 1;
  res.status(db ? 200 : 503).json({ status: db ? "ok" : "degraded", db, uptime: Math.round(process.uptime()) });
});

app.use("/", routerAdmin);

// upload errors (file too large, wrong type, too many files) -> JSON 400 instead of an HTML 500
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  if (err instanceof Errors) return res.status(err.code).json(err);
  if (err instanceof multer.MulterError)
    return res.status(HttpCode.BAD_REQUEST).json(new Errors(HttpCode.BAD_REQUEST, err.message));
  next(err);
});

export default app;