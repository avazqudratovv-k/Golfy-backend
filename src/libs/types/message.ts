import { Types } from "mongoose";
type ObjectId = Types.ObjectId;

export interface Message {
    _id: ObjectId;
    name: string;
    email: string;
    message: string;
    isRead?: boolean;
    createdAt: Date;
}

export interface MessageInput {
    name: string;
    email: string;
    message: string;
}