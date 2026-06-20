import mongoose, { Schema, Document } from "mongoose";

export interface ICampaignRecipient extends Document {
  campaignId: mongoose.Types.ObjectId;
  leadId: mongoose.Types.ObjectId;
  phone: string;
  status: "pending" | "sent" | "failed";
  error?: string;
  sentAt?: Date;
}

const campaignRecipientSchema = new Schema<ICampaignRecipient>(
  {
    campaignId: {
      type: Schema.Types.ObjectId,
      ref: "Campaign",
      required: true,
    },
    leadId: {
      type: Schema.Types.ObjectId,
      ref: "Lead",
      required: true,
    },
    phone: { type: String, required: true },
    status: {
      type: String,
      enum: ["pending", "sent", "failed"],
      default: "pending",
    },
    error: String,
    sentAt: Date,
  },
  {
    timestamps: true,
  }
);

const CampaignRecipient = mongoose.model<ICampaignRecipient>(
  "CampaignRecipient",
  campaignRecipientSchema
);

export default CampaignRecipient;
