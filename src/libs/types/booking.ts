import { ObjectId } from "mongoose";
import { BookingStatus } from "../enums/booking.enum";
import { Venue } from "./venue";

export interface Booking {
    _id: ObjectId;
    userId: ObjectId;
    venueId: ObjectId;
    bookingDate: Date;
    startTime: string;
    endTime: string;
    price: number;
    status: BookingStatus;
    createdAt: Date;
    updatedAt: Date;
    venueData?: Venue[];
}

export interface BookingInput {
    venueId: ObjectId;
    bookingDate: Date;
    startTime: string;
    endTime: string;
    price: number;
}

export interface BookingInquiry {
    page: number;
    limit: number;
    status?: BookingStatus;
}

export interface BookingUpdateInput {
    bookingId: string;
    status: BookingStatus;
}