import express from 'express';
import path from "path";
import cors from "cors";
import morgan from "morgan";
import router from "./router";
import routerAdmin from './routerAdmin';
import { MORGAN_FORMAT } from "./libs/utils/config";

/** ENTRANCE */
const app = express();
app.use(cors());
app.use(morgan(MORGAN_FORMAT));
app.use(express.static(path.join(__dirname, "public")));
app.use("/uploads", express.static("./uploads"));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

/** ROUTERS */
app.use("/admin", routerAdmin);
app.use("/", router);

export default app;