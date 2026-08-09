import UserModel from "../schema/User.model";
import {
  LoginInput,
  User,
  UserInput,
  UserUpdateInput,
} from "../libs/types/user";
import Errors, { HttpCode, Message } from "../libs/utils/Errors";
import { UserStatus } from "../libs/enums/user.enum";
import * as bcrypt from "bcryptjs";
import { shapeIntoMongooseObjectId } from "../libs/utils/config";

class UserService {
  private readonly userModel;

  constructor() {
    this.userModel = UserModel;
  }

  public async signup(input: UserInput): Promise<User> {
    const salt = await bcrypt.genSalt();
    input.password = await bcrypt.hash(input.password, salt);

    try {
      const result = await this.userModel.create(input);
      result.password = "";
      return result.toJSON();
    } catch (err) {
      console.error("Error, model:signup", err);
      throw new Errors(HttpCode.BAD_REQUEST, Message.USED_EMAIL_PHONE);
    }
  }

  public async login(input: LoginInput): Promise<User> {
    const user = await this.userModel
      .findOne(
        { email: input.email, status: { $ne: UserStatus.DELETE } },
        { email: 1, password: 1, status: 1 }
      )
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

  public async getMyProfile(user: User): Promise<User> {
    const userId = shapeIntoMongooseObjectId(user._id);
    const result = await this.userModel
      .findOne({ _id: userId, status: UserStatus.ACTIVE })
      .exec();
    if (!result) throw new Errors(HttpCode.NOT_FOUND, Message.NO_DATA_FOUND);

    return result;
  }

  public async updateMyProfile(
    user: User,
    input: UserUpdateInput
  ): Promise<User> {
    const userId = shapeIntoMongooseObjectId(user._id);
    const result = await this.userModel
      .findOneAndUpdate({ _id: userId }, input, { new: true })
      .exec();
    if (!result) throw new Errors(HttpCode.NOT_MODIFIED, Message.UPDATE_FAILED);

    return result;
  }

  /** ADMIN **/

  public async getAllUsers(): Promise<User[]> {
    const result = await this.userModel
      .find({ status: { $ne: UserStatus.DELETE } })
      .exec();
    if (!result) throw new Errors(HttpCode.NOT_FOUND, Message.NO_DATA_FOUND);

    return result;
  }

  public async updateUserStatus(input: UserUpdateInput): Promise<User> {
    input._id = shapeIntoMongooseObjectId(input._id);
    const result = await this.userModel
      .findByIdAndUpdate({ _id: input._id }, input, { new: true })
      .exec();
    if (!result) throw new Errors(HttpCode.NOT_MODIFIED, Message.UPDATE_FAILED);

    return result;
  }
}

export default UserService;