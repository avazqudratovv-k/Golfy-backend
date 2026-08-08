import mongoose, { Schema } from 'mongoose';
import { VenueStatus } from '../libs/enums/venue.enum';

const venueSchema = new Schema(
  {
    venueStatus: {
        type: String,
        enum: VenueStatus,
        default: VenueStatus.ACTIVE,
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
    },

    venueDesc: {
        type: String,
    },

    venueImages: {
        type: [String],
        required: [],
    },

    bookingCount: {
        type: Number,
        default: 0,
    },
  },
  { timestamps: true }
);

export default mongoose.model("Venue", venueSchema);