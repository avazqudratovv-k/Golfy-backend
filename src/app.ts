import cors from "cors";
import express from "express";
import path from "path";
import router from "./router";
import morgan from "morgan";
import cookieParser from "cookie-parser";
import { MORGAN_FORMAT } from "./libs/utils/config";

/** 1-ENTRANCE **/
const app = express();
app.use(express.static(path.join(__dirname, "public")));
app.use("/uploads", express.static("./uploads"));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(
    cors({
        credentials: true,
        origin: true
    })
);
app.use(cookieParser());
app.use(morgan(MORGAN_FORMAT));

/** 2-SESSIONS **/

/** 3-VIEWS **/

/** 4-ROUTERS **/
app.use("/", router);

export default app;