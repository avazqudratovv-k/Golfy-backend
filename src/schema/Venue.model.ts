import mongoose, { Schema } from 'mongoose';
import { VenueStatus, VenueType } from '../libs/enums/venue.enum';

const venueSchema = new Schema(
  {
    venueStatus: {
        type: String,
        enum: VenueStatus,
        default: VenueStatus.ACTIVE,
    },

    venueType: {
        type: String,
        enum: VenueType,
        default: VenueType.COURSE,
    },

    venueName: {
        type: String,
        required: true,
    },

    venueLocation: {
        type: String,
        required: true,
    },

    pricePerHour: {
        type: Number,
        required: true,
        min: 0,
    },

    venueDesc: {
        type: String,
    },

    venueImages: {
        type: [String],
        default: [],
    },

    bookingCount: {
        type: Number,
        default: 0,
    },

    // kept in sync when reviews are created
    avgRating: {
        type: Number,
        default: 0,
        min: 0,
        max: 5,
    },

    reviewCount: {
        type: Number,
        default: 0,
    },
  },
  { timestamps: true }
);

venueSchema.index({ venueName: 1 }, { unique: true });
venueSchema.index({ venueStatus: 1, bookingCount: -1 });

export default mongoose.model("Venue", venueSchema);