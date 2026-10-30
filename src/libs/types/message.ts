import { ObjectId } from "mongoose";

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