import mongoose, { Schema } from "mongoose";

const messageSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
    },

    email: {
      type: String,
      required: true,
    },

    message: {
      type: String,
      required: true,
    },

    // set by an admin from the messages inbox
    isRead: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true, collection: "messages" }
);

export default mongoose.model("Message", messageSchema);