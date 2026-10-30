import cors from "cors";
import mongoose from "mongoose";
import express from "express";
import path from "path";
import router from "./router";
import morgan from "morgan";
import cookieParser from "cookie-parser";
import multer from "multer";
import { NextFunction, Request, Response } from "express";
import Errors, { HttpCode } from "./libs/utils/Errors";
import { MORGAN_FORMAT, corsOptions } from "./libs/utils/config";
import { serveUploads } from "./libs/utils/uploads";

/** 1-ENTRANCE **/
const app = express();
app.disable("x-powered-by");
app.use(express.static(path.join(__dirname, "public")));
app.use("/uploads", serveUploads);
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cors(corsOptions));
app.use(cookieParser());
app.use(morgan(MORGAN_FORMAT));

/** 2-SESSIONS **/

/** 3-VIEWS **/

// liveness + database state, no auth
app.get("/health", (req, res) => {
  const db = mongoose.connection.readyState === 1;
  res.status(db ? 200 : 503).json({ status: db ? "ok" : "degraded", db, uptime: Math.round(process.uptime()) });
});

/** 4-ROUTERS **/
app.use("/", router);

// upload errors (file too large, wrong type) -> JSON 400 instead of an HTML 500
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
    if (err instanceof Errors) return res.status(err.code).json(err);
    if (err instanceof multer.MulterError)
        return res.status(HttpCode.BAD_REQUEST).json(new Errors(HttpCode.BAD_REQUEST, err.message));
    next(err);
});

export default app;