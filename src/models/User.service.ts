import UserModel from "../schema/User.model";
import {
  LoginInput,
  User,
  UserInput,
  UserUpdateInput,
} from "../libs/types/user";
import Errors, { HttpCode, Message } from "../libs/utils/Errors";
import { UserRole, UserStatus } from "../libs/enums/user.enum";
import * as bcrypt from "bcryptjs";
import { escapeRegex, isNonEmptyString, shapeIntoMongooseObjectId } from "../libs/utils/config";

// emails are matched case-insensitively (existing mixed-case accounts keep working)
const CI = { locale: "en", strength: 2 };
const MIN_PASSWORD_LENGTH = 8;

class UserService {
  private readonly userModel;

  constructor() {
    this.userModel = UserModel;
  }

  public async signup(
    input: UserInput,
    role: UserRole = UserRole.USER
  ): Promise<User> {
    if (
      !isNonEmptyString(input?.name) ||
      !isNonEmptyString(input?.email) ||
      !isNonEmptyString(input?.phone) ||
      !isNonEmptyString(input?.password)
    )
      throw new Errors(HttpCode.BAD_REQUEST, Message.INVALID_INPUT);
    if (input.password.length < MIN_PASSWORD_LENGTH)
      throw new Errors(HttpCode.BAD_REQUEST, Message.PASSWORD_TOO_SHORT);

    // whitelist: role/status are never taken from the client
    const data: UserInput = {
      name: input.name.trim(),
      email: input.email.trim().toLowerCase(),
      phone: input.phone.trim(),
      password: await bcrypt.hash(input.password, await bcrypt.genSalt()),
      role,
    };
    if (typeof input.avatarUrl === "string") data.avatarUrl = input.avatarUrl;

    const emailUsed = await this.userModel
      .findOne({ email: data.email })
      .select("_id")
      .collation(CI)
      .exec();
    if (emailUsed) throw new Errors(HttpCode.BAD_REQUEST, Message.EMAIL_USED);
    const phoneUsed = await this.userModel
      .findOne({ phone: data.phone })
      .select("_id")
      .exec();
    if (phoneUsed) throw new Errors(HttpCode.BAD_REQUEST, Message.PHONE_USED);

    try {
      const result = await this.userModel.create(data);
      result.password = "";
      return result.toJSON();
    } catch (err: any) {
      console.error("Error, model:signup", err);
      if (err?.code === 11000)
        throw new Errors(HttpCode.BAD_REQUEST, Message.USED_EMAIL_PHONE);
      throw new Errors(HttpCode.BAD_REQUEST, Message.CREATE_FAILED);
    }
  }

  public async login(input: LoginInput): Promise<User> {
    if (!isNonEmptyString(input?.email) || !isNonEmptyString(input?.password))
      throw new Errors(HttpCode.BAD_REQUEST, Message.INVALID_INPUT);

    const user = await this.userModel
      .findOne(
        { email: input.email.trim(), status: { $ne: UserStatus.DELETE } },
        { email: 1, password: 1, status: 1 }
      )
      .collation(CI)
      .exec();
    if (!user) throw new Errors(HttpCode.NOT_FOUND, Message.NO_USER_EMAIL);
    else if (user.status === UserStatus.BLOCK) {
      throw new Errors(HttpCode.FORBIDDEN, Message.BLOCKED_USER);
    }

    const isMatch = await bcrypt.compare(input.password, user.password);
    if (!isMatch) {
      throw new Errors(HttpCode.UNAUTHORIZED, Message.WRONG_PASSWORD);
    }

    return await this.userModel.findById(user._id).lean().exec();
  }

  // live role/status of the account behind a token (any status)
  public async getAuthState(
    user: User
  ): Promise<{ role: UserRole; status: UserStatus } | null> {
    const userId = shapeIntoMongooseObjectId(user._id);
    return await this.userModel
      .findById(userId)
      .select("role status")
      .lean()
      .exec();
  }

  public async getMyProfile(user: User): Promise<User> {
    const userId = shapeIntoMongooseObjectId(user._id);
    const result = await this.userModel
      .findOne({ _id: userId, status: UserStatus.ACTIVE })
      .exec();
    if (!result) throw new Errors(HttpCode.NOT_FOUND, Message.NO_DATA_FOUND);

    return result;
  }

  // only these fields are editable; role/status/email can never be changed here
  private async buildProfileUpdate(input: UserUpdateInput): Promise<any> {
    const update: any = {};
    if (isNonEmptyString(input?.name)) update.name = input.name.trim();
    if (isNonEmptyString(input?.phone)) update.phone = input.phone.trim();
    if (typeof input?.avatarUrl === "string") update.avatarUrl = input.avatarUrl;
    if (isNonEmptyString(input?.password))
      update.password = await bcrypt.hash(input.password, await bcrypt.genSalt());
    return update;
  }

  public async updateMyProfile(
    user: User,
    input: UserUpdateInput & { currentPassword?: string }
  ): Promise<User> {
    const userId = shapeIntoMongooseObjectId(user._id);

    // changing the password needs the current one
    if (isNonEmptyString(input?.password)) {
      if (input.password.length < MIN_PASSWORD_LENGTH)
        throw new Errors(HttpCode.BAD_REQUEST, Message.PASSWORD_TOO_SHORT);
      const account = await this.userModel
        .findById(userId)
        .select("+password")
        .exec();
      const ok =
        !!account &&
        isNonEmptyString(input.currentPassword) &&
        (await bcrypt.compare(input.currentPassword, account.password));
      if (!ok) throw new Errors(HttpCode.UNAUTHORIZED, Message.WRONG_PASSWORD);
    }

    const update = await this.buildProfileUpdate(input);

    let result;
    try {
      result = await this.userModel
        .findOneAndUpdate({ _id: userId }, update, {
          new: true,
          runValidators: true,
        })
        .exec();
    } catch (err: any) {
      console.error("Error, model:updateMyProfile", err);
      if (err?.code === 11000)
        throw new Errors(HttpCode.BAD_REQUEST, Message.PHONE_USED);
      throw new Errors(HttpCode.BAD_REQUEST, Message.UPDATE_FAILED);
    }
    if (!result) throw new Errors(HttpCode.NOT_FOUND, Message.UPDATE_FAILED);

    return result;
  }

  /** ADMIN **/

  // optional filters: search (name/email/phone), role, status
  private buildUserFilter(opts: any = {}): any {
    const filter: any = { status: { $ne: UserStatus.DELETE } };
    if (opts.status && Object.values(UserStatus).includes(opts.status)) filter.status = opts.status;
    if (opts.role && Object.values(UserRole).includes(opts.role)) filter.role = opts.role;
    if (isNonEmptyString(opts.search)) {
      const rx = new RegExp(escapeRegex(opts.search.trim().slice(0, 100)), "i");
      filter.$or = [{ name: rx }, { email: rx }, { phone: rx }];
    }
    return filter;
  }

  public async getAllUsers(opts: any = {}, paging?: { page: number; limit: number }): Promise<User[]> {
    let query = this.userModel.find(this.buildUserFilter(opts));
    if (paging) query = query.sort({ createdAt: -1 }).skip((paging.page - 1) * paging.limit).limit(paging.limit);
    const result = await query.exec();
    if (!result) throw new Errors(HttpCode.NOT_FOUND, Message.NO_DATA_FOUND);

    return result;
  }

  public async countUsers(opts: any = {}): Promise<number> {
    return await this.userModel.countDocuments(this.buildUserFilter(opts)).exec();
  }

  public async updateUserStatus(input: UserUpdateInput): Promise<User> {
    const userId = shapeIntoMongooseObjectId(input?._id);
    const update = await this.buildProfileUpdate(input);
    if (input.status !== undefined) {
      if (!Object.values(UserStatus).includes(input.status))
        throw new Errors(HttpCode.BAD_REQUEST, Message.INVALID_INPUT);
      update.status = input.status;
    }

    let result;
    try {
      result = await this.userModel
        .findByIdAndUpdate(userId, update, { new: true, runValidators: true })
        .exec();
    } catch (err: any) {
      console.error("Error, model:updateUserStatus", err);
      throw new Errors(HttpCode.BAD_REQUEST, Message.UPDATE_FAILED);
    }
    if (!result) throw new Errors(HttpCode.NOT_FOUND, Message.UPDATE_FAILED);

    return result;
  }
}

export default UserService;
