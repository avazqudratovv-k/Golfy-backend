import { ObjectId } from "mongoose";

export interface Message {
    _id: ObjectId;
    name: string;
    email: string;
    message: string;
    createdAt: Date;
}

export interface MessageInput {
    name: string;
    email: string;
    message: string;
}