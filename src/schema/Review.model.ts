import mongoose, { Schema } from "mongoose";

const reviewSchema = new Schema(
  {
    bookingId: {
      type: Schema.Types.ObjectId,
      required: true,
      ref: "Booking",
    },

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

    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
    },

    comment: {
      type: String,
      required: true,
    },
  },
  { timestamps: true, collection: "reviews" }
);

// one review per booking — enforces "can't review the same booking twice"
reviewSchema.index({ bookingId: 1 }, { unique: true });

reviewSchema.index({ venueId: 1, createdAt: -1 });

export default mongoose.model("Review", reviewSchema);