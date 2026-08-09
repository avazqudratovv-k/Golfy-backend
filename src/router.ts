import express from "express";
import userController from "./controllers/user.controller";

const router = express.Router();

/** AUTH **/
router.post("/user/signup", userController.signup);
router.post("/user/login", userController.login);
router.post("/user/logout", userController.verifyAuth, userController.logout);

/** PROFILE **/
router.get("/user/profile", userController.verifyAuth, userController.getMyProfile);
router.post("/user/profile", userController.verifyAuth, userController.updateMyProfile);

export default router;