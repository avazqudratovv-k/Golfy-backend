import { Types } from "mongoose";
type ObjectId = Types.ObjectId;

export interface Review {
    _id: ObjectId;
    bookingId: ObjectId;
    userId: ObjectId;
    venueId: ObjectId;
    rating: number;
    comment: string;
    createdAt: Date;
    updatedAt: Date;
    userData?: { name: string; avatarUrl?: string }[];
    venueData?: { venueName: string }[];
}

export interface ReviewInput {
    bookingId: ObjectId;
    venueId: ObjectId;
    rating: number;
    comment: string;
}

export interface ReviewInquiry {
    page: number;
    limit: number;
    venueId?: ObjectId;
    sort?: "recent";
}