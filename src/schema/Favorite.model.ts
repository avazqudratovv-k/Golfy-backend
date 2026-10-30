import mongoose, { Schema } from "mongoose";

const favoriteSchema = new Schema(
  {
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
  },
  { timestamps: true, collection: "favorites" }
);

// a user can favourite a venue only once
favoriteSchema.index({ userId: 1, venueId: 1 }, { unique: true });

export default mongoose.model("Favorite", favoriteSchema);
