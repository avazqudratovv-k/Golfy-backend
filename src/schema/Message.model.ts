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
  },
  { timestamps: true, collection: "messages" }
);

export default mongoose.model("Message", messageSchema);