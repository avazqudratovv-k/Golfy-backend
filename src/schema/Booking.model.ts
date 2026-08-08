import mongoose, { Schema } from "mongoose";
import { BookingStatus } from "../libs/enums/booking.enum";

const bookingSchema = new Schema({
    userId: {
        type: Schema.Types.ObjectId,
        required: true,
        ref: "User",
    },

    venueId: {
        type: Schema.Types.ObjectId,
        required: true,
        ref: "Venue",
    },

    bookingDate: {
        type: Date,
        required: true,
    },

    startTime: {
        type: String,
        required: true,
    },

    endTime: {
        type: String,
        required: true,
    },

    price: {
        type: Number,
        required: true,
    },

    status: {
        type: String,
        enum: BookingStatus,
        default: BookingStatus.PENDING
    },
  },
  { timestamps: true, collection: "bookings" }
);

export default mongoose.model("Booking", bookingSchema);