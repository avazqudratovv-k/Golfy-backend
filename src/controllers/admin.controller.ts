import { NextFunction, Request, Response } from "express";
import { T } from "../libs/types/common";
import UserService from "../models/User.service";
import { ExtendedRequest, LoginInput, User, UserInput, UserUpdateInput } from "../libs/types/user";
import Errors, { HttpCode, Message } from "../libs/utils/Errors";
import { AUTH_TIMER } from "../libs/utils/config";
import AuthService from "../models/Auth.service";
import DashboardService from "../models/Dashboard.service";
import { UserRole, UserStatus } from "../libs/enums/user.enum";

const userService = new UserService();
const authService = new AuthService();
const dashboardService = new DashboardService();

const adminController: T = {};

/** AUTH **/

adminController.adminSignup = async (req: Request, res: Response) => {
  try {
    console.log("adminSignup");
    // optional lock: when ADMIN_SIGNUP_SECRET is set, signup must present it
    const secret = process.env.ADMIN_SIGNUP_SECRET;
    const { adminSecret, role, status, ...rest } = req.body ?? {};
    if (secret && (req.header("x-admin-secret") ?? adminSecret) !== secret)
      throw new Errors(HttpCode.FORBIDDEN, Message.NOT_ADMIN);

    const input: UserInput = rest;
    const result: User = await userService.signup(input, UserRole.ADMIN);
    const token = await authService.createToken(result);
    res.cookie("adminAccessToken", token, {
      maxAge: AUTH_TIMER * 3600 * 1000,
      httpOnly: false,
    });

    res.status(HttpCode.CREATED).json({ user: result, accessToken: token });
  } catch (err) {
    console.log("Error, adminSignup:", err);
    if (err instanceof Errors) res.status(err.code).json(err);
    else res.status(Errors.standard.code).json(Errors.standard);
  }
};

adminController.adminLogin = async (req: Request, res: Response) => {
  try {
    console.log("adminLogin");
    const input: LoginInput = req.body;
    const result = await userService.login(input);

    if (result.role !== UserRole.ADMIN) {
      throw new Errors(HttpCode.FORBIDDEN, Message.NOT_ADMIN);
    }

    const token = await authService.createToken(result);
    res.cookie("adminAccessToken", token, {
      maxAge: AUTH_TIMER * 3600 * 1000,
      httpOnly: false,
    });

    res.status(HttpCode.OK).json({ user: result, accessToken: token });
  } catch (err) {
    console.log("Error, adminLogin:", err);
    if (err instanceof Errors) res.status(err.code).json(err);
    else res.status(Errors.standard.code).json(Errors.standard);
  }
};

adminController.adminLogout = (req: ExtendedRequest, res: Response) => {
  try {
    console.log("adminLogout");
    res.cookie("adminAccessToken", null, { maxAge: 0, httpOnly: false });
    res.status(HttpCode.OK).json({ logout: true });
  } catch (err) {
    console.log("Error, adminLogout:", err);
    if (err instanceof Errors) res.status(err.code).json(err);
    else res.status(Errors.standard.code).json(Errors.standard);
  }
};

/** USERS **/

adminController.getAllUsers = async (req: Request, res: Response) => {
  try {
    console.log("getAllUsers");
    const result = await userService.getAllUsers();

    res.status(HttpCode.OK).json(result);
  } catch (err) {
    console.log("Error, getAllUsers:", err);
    if (err instanceof Errors) res.status(err.code).json(err);
    else res.status(Errors.standard.code).json(Errors.standard);
  }
};

adminController.updateUserStatus = async (req: Request, res: Response) => {
  try {
    console.log("updateUserStatus");
    const input: UserUpdateInput = req.body;
    const result = await userService.updateUserStatus(input);

    res.status(HttpCode.OK).json(result);
  } catch (err) {
    console.log("Error, updateUserStatus:", err);
    if (err instanceof Errors) res.status(err.code).json(err);
    else res.status(Errors.standard.code).json(Errors.standard);
  }
};

/** DASHBOARD **/

adminController.getDashboard = async (req: Request, res: Response) => {
  try {
    console.log("getDashboard");
    const result = await dashboardService.getDashboard();

    res.status(HttpCode.OK).json(result);
  } catch (err) {
    console.log("Error, getDashboard:", err);
    if (err instanceof Errors) res.status(err.code).json(err);
    else res.status(Errors.standard.code).json(Errors.standard);
  }
};

/** MIDDLEWARE **/

adminController.verifyAdmin = async (
  req: ExtendedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const token = req.cookies["adminAccessToken"];
    if (token) req.user = await authService.checkAuth(token);
    if (!req.user) throw new Errors(HttpCode.UNAUTHORIZED, Message.NOT_AUTHENTIFICATED);
    if (req.user.role !== UserRole.ADMIN) throw new Errors(HttpCode.FORBIDDEN, Message.NOT_ADMIN);

    // a valid token is not enough: the account must still be an active admin
    const fresh = await userService.getAuthState(req.user);
    if (!fresh || fresh.role !== UserRole.ADMIN || fresh.status !== UserStatus.ACTIVE)
      throw new Errors(HttpCode.FORBIDDEN, Message.NOT_ADMIN);
    next();
  } catch (err) {
    console.log("Error, verifyAdmin:", err);
    if (err instanceof Errors) res.status(err.code).json(err);
    else res.status(Errors.standard.code).json(Errors.standard);
  }
};

export default adminController;