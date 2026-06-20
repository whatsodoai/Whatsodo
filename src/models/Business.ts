import mongoose, { Schema, Document } from "mongoose";

export interface IBusinessMember {
  userId: mongoose.Types.ObjectId;
  role: "admin" | "agent";
  addedAt: Date;
}

export interface IWhatsAppTemplate {
  name: string;
  language: string;
  bodyPreview: string;
  variableCount: number;
  createdAt: Date;
}

export interface IBusiness extends Document {
  businessName: string;
  industry: string;
  whatsappNumber: string;
  timezone: string;
  ownerId: mongoose.Types.ObjectId;
  whatsappAccessToken?: string;
  whatsappPhoneNumberId?: string;
  whatsappVerifyToken?: string;
  members: IBusinessMember[];
  whatsappTemplates: IWhatsAppTemplate[];
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
    members: [
      {
        userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
        role: { type: String, enum: ["admin", "agent"], default: "agent" },
        addedAt: { type: Date, default: Date.now },
      },
    ],
    whatsappTemplates: [
      {
        name: { type: String, required: true },
        language: { type: String, required: true },
        bodyPreview: { type: String, default: "" },
        variableCount: { type: Number, default: 0 },
        createdAt: { type: Date, default: Date.now },
      },
    ],
  },
  {
    timestamps: true,
  }
);

const Business = mongoose.model<IBusiness>("Business", businessSchema);

export default Business;