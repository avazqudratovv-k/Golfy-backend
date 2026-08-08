import { ObjectId } from "mongoose";
import { VenueStatus } from "../enums/venue.enum";

export interface Venue {
    _id: ObjectId;
    venueStatus: VenueStatus;
    venueName: string;
    venueLocation: string;
    pricePerHour: number;
    venueDesc?: string;
    venueImages: string[];
    bookingCount: number;
    createdAt: Date;
    updatedAt: Date;
}

export interface VenueInquiry {
    order: string;
    page: number;
    limit: number;
    sort?: "cheap" | "expensive" | "popular";
    search?: string;
}

export interface VenueInput {
    venueStatus?: VenueStatus;
    venueName: string;
    venueLocation: string;
    pricePerHour: number;
    venueDesc?: string;
    venueImages?: string[];
}

export interface VenueUpdateInput {
    _id: ObjectId;
    venueStatus?: VenueStatus;
    venueName?: string;
    venueLocation?: string;
    pricePerHour?: number;
    venueDesc?: string;
    venueImages?: string[];
}