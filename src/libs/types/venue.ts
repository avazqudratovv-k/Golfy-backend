import { ObjectId } from "mongoose";
import { VenueStatus, VenueType } from "../enums/venue.enum";

export interface Venue {
    _id: ObjectId;
    venueStatus: VenueStatus;
    venueType?: VenueType;
    venueName: string;
    venueLocation: string;
    pricePerHour: number;
    venueDesc?: string;
    venueImages: string[];
    bookingCount: number;
    avgRating?: number;
    reviewCount?: number;
    createdAt: Date;
    updatedAt: Date;
}

export interface VenueInquiry {
    order: string;
    page: number;
    limit: number;
    sort?: "cheap" | "expensive" | "popular" | "rating";
    search?: string;
    minPrice?: number;
    maxPrice?: number;
    minRating?: number;
    type?: VenueType;
}

export interface VenueInput {
    venueStatus?: VenueStatus;
    venueType?: VenueType;
    venueName: string;
    venueLocation: string;
    pricePerHour: number;
    venueDesc?: string;
    venueImages?: string[];
}

export interface VenueUpdateInput {
    _id: ObjectId;
    venueStatus?: VenueStatus;
    venueType?: VenueType;
    venueName?: string;
    venueLocation?: string;
    pricePerHour?: number;
    venueDesc?: string;
    venueImages?: string[];
}