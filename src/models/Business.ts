import mongoose, { Schema, Document } from "mongoose";

export interface IBusiness extends Document {
  businessName: string;
  industry: string;
  whatsappNumber: string;
  timezone: string;
  ownerId: mongoose.Types.ObjectId;
  whatsappAccessToken?: string;
  whatsappPhoneNumberId?: string;
  whatsappVerifyToken?: string;
}

const businessSchema = new Schema<IBusiness>(
  {
    businessName: {
      type: String,
      required: true,
    },
    industry: {
      type: String,
      required: true,
    },
    whatsappNumber: {
      type: String,
      required: true,
    },
    timezone: {
      type: String,
      default: "Asia/Kolkata",
    },
    ownerId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    whatsappAccessToken: {
      type: String,
    },
    whatsappPhoneNumberId: {
      type: String,
    },
    whatsappVerifyToken: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

const Business = mongoose.model<IBusiness>("Business", businessSchema);

export default Business;