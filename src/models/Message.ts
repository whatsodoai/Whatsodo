import mongoose, { Schema } from "mongoose";

const messageSchema = new Schema(
  {
    businessId: {
      type: String,
      required: true,
    },
    phone: {
      type: String,
      required: true,
    },
    direction: {
      type: String,
      enum: ["incoming", "outgoing"],
      required: true,
    },
    message: {
      type: String,
      required: true,
    },
    isRead: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model(
  "Message",
  messageSchema
);