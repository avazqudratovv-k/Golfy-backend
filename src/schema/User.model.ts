import mongoose, { Schema } from 'mongoose';
import { UserStatus, UserRole } from "../libs/enums/user.enum";

const userSchema = new Schema({
    role: {
        type: String,
        enum: UserRole,
        default: UserRole.USER
    },

    status: {
        type: String,
        enum: UserStatus,
        default: UserStatus.ACTIVE,
    },

    name: {
        type: String,
        required: true,
    },

    email: {
        type: String,
        index: { unique: true, sparse: true },
        required: true,
    },

    phone: {
        type: String,
        index: { unique: true, sparse: true },
        required: true
    },

    password: {
        type: String,
        select: false,
        required: true
    },

    avatarUrl: {
        type: String,
    },
  },
  { timestamps: true }
);

export default mongoose.model("User", userSchema);