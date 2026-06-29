import mongoose, { Schema, Document } from "mongoose";

export interface IBusinessMember {
  userId: mongoose.Types.ObjectId;
  role: "admin" | "agent";
  addedAt: Date;
}

export interface ICarouselButton {
  type: "QUICK_REPLY" | "URL" | "PHONE_NUMBER";
  text: string;
  value?: string;
}

export interface ICarouselCard {
  imageUrl: string;
  bodyText: string;
  buttons: ICarouselButton[];
}

export interface IWhatsAppTemplate {
  name: string;
  language: string;
  bodyPreview: string;
  variableCount: number;
  createdAt: Date;
  type: "standard" | "carousel";
  status?: "PENDING" | "APPROVED" | "REJECTED";
  metaTemplateId?: string;
  cards?: ICarouselCard[];
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
  whatsappBusinessAccountId?: string;
  whatsappAppId?: string;
  metaUserId?: string;
  whatsappConnectedAt?: Date;
  whatsappDeauthorizedAt?: Date;
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
    whatsappBusinessAccountId: {
      type: String,
    },
    whatsappAppId: {
      type: String,
    },
    metaUserId: {
      type: String,
    },
    whatsappConnectedAt: {
      type: Date,
    },
    whatsappDeauthorizedAt: {
      type: Date,
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
        type: { type: String, enum: ["standard", "carousel"], default: "standard" },
        status: { type: String, enum: ["PENDING", "APPROVED", "REJECTED"] },
        metaTemplateId: { type: String },
        cards: [
          {
            imageUrl: { type: String, required: true },
            bodyText: { type: String, required: true },
            buttons: [
              {
                type: { type: String, enum: ["QUICK_REPLY", "URL", "PHONE_NUMBER"], required: true },
                text: { type: String, required: true },
                value: { type: String },
              },
            ],
          },
        ],
      },
    ],
  },
  {
    timestamps: true,
  }
);

const Business = mongoose.model<IBusiness>("Business", businessSchema);

export default Business;