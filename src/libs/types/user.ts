import { ObjectId } from "mongoose";
import { UserRole, UserStatus } from "../enums/user.enum";
import { Request } from "express";

export interface User {
    _id: ObjectId;
    role: UserRole;
    status: UserStatus;
    name: string;
    email: string;
    phone: string;
    password?: string;
    avatarUrl?: string;
    createdAt: Date;
    updatedAt: Date;
}

export interface UserInput {
    role?: UserRole;
    status?: UserStatus;
    name: string;
    email: string;
    phone: string;
    password: string;
    avatarUrl?: string;
}

export interface LoginInput {
    email: string;
    password: string;
}

export interface UserUpdateInput {
    _id: ObjectId;
    status?: UserStatus;
    name?: string;
    phone?: string;
    password?: string;
    avatarUrl?: string;
}

export interface ExtendedRequest extends Request {
    user: User;
    file: Express.Multer.File;
    files: Express.Multer.File[];
}

export interface AdminRequest extends Request {
    user: User;
    file: Express.Multer.File;
    files: Express.Multer.File[];
}