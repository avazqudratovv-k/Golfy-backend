import { NextFunction, Request, Response } from "express";
import { T } from "../libs/types/common";
import UserService from "../models/User.service";
import {
  ExtendedRequest,
  LoginInput,
  User,
  UserInput,
  UserUpdateInput,
} from "../libs/types/user";
import Errors, { HttpCode, Message } from "../libs/utils/Errors";
import { AUTH_TIMER } from "../libs/utils/config";
import AuthService from "../models/Auth.service";
import { UserStatus } from "../libs/enums/user.enum";

const userService = new UserService();
const authService = new AuthService();

const userController: T = {};

userController.signup = async (req: Request, res: Response) => {
  try {
    console.log("signup");
    const input: UserInput = req.body,
      result: User = await userService.signup(input);
    const token = await authService.createToken(result);
    res.cookie("accessToken", token, {
      maxAge: AUTH_TIMER * 3600 * 1000,
      httpOnly: false,
    });

    res.status(HttpCode.CREATED).json({ user: result, accessToken: token });
  } catch (err) {
    console.log("Error, signup:", err);
    if (err instanceof Errors) res.status(err.code).json(err);
    else res.status(Errors.standard.code).json(Errors.standard);
  }
};

userController.login = async (req: Request, res: Response) => {
  try {
    console.log("login");
    const input: LoginInput = req.body,
      result = await userService.login(input),
      token = await authService.createToken(result);

    res.cookie("accessToken", token, {
      maxAge: AUTH_TIMER * 3600 * 1000,
      httpOnly: false,
    });

    res.status(HttpCode.OK).json({ user: result, accessToken: token });
  } catch (err) {
    console.log("Error, login:", err);
    if (err instanceof Errors) res.status(err.code).json(err);
    else res.status(Errors.standard.code).json(Errors.standard);
  }
};

userController.logout = (req: ExtendedRequest, res: Response) => {
  try {
    console.log("logout");
    res.cookie("accessToken", null, { maxAge: 0, httpOnly: false });
    res.status(HttpCode.OK).json({ logout: true });
  } catch (err) {
    console.log("Error, logout:", err);
    if (err instanceof Errors) res.status(err.code).json(err);
    else res.status(Errors.standard.code).json(Errors.standard);
  }
};

userController.getMyProfile = async (req: ExtendedRequest, res: Response) => {
  try {
    console.log("getMyProfile");
    const result = await userService.getMyProfile(req.user);

    res.status(HttpCode.OK).json(result);
  } catch (err) {
    console.log("Error, getMyProfile:", err);
    if (err instanceof Errors) res.status(err.code).json(err);
    else res.status(Errors.standard.code).json(Errors.standard);
  }
};

userController.updateMyProfile = async (req: ExtendedRequest, res: Response) => {
  try {
    console.log("updateMyProfile");
    const input: UserUpdateInput = req.body;
    if (req.file) input.avatarUrl = `uploads/avatars/${req.file.filename}`;
    const result = await userService.updateMyProfile(req.user, input);

    res.status(HttpCode.OK).json(result);
  } catch (err) {
    console.log("Error, updateMyProfile:", err);
    if (err instanceof Errors) res.status(err.code).json(err);
    else res.status(Errors.standard.code).json(Errors.standard);
  }
};

/** MIDDLEWARE **/

userController.verifyAuth = async (
  req: ExtendedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const token = req.cookies["accessToken"];
    if (token) req.user = await authService.checkAuth(token);
    if (!req.user)
      throw new Errors(HttpCode.UNAUTHORIZED, Message.NOT_AUTHENTIFICATED);

    // re-check live status — a token can be valid but the account blocked since login
    const freshUser = await userService.getAuthState(req.user);
    if (!freshUser || freshUser.status === UserStatus.DELETE)
      throw new Errors(HttpCode.NOT_FOUND, Message.NO_DATA_FOUND);
    if (freshUser.status === UserStatus.BLOCK) {
      res.cookie("accessToken", null, { maxAge: 0, httpOnly: false });
      throw new Errors(HttpCode.FORBIDDEN, Message.BLOCKED_USER);
    }

    next();
  } catch (err) {
    console.log("Error, verifyAuth:", err);
    if (err instanceof Errors) res.status(err.code).json(err);
    else res.status(Errors.standard.code).json(Errors.standard);
  }
};

userController.retrieveAuth = async (
  req: ExtendedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const token = req.cookies["accessToken"];
    if (token) req.user = await authService.checkAuth(token);

    next();
  } catch (err) {
    console.log("Error, retrieveAuth:", err);
    next();
  }
};

export default userController;