import mongoose, { Schema, Document } from "mongoose";

export interface ICampaign extends Document {
  businessId: mongoose.Types.ObjectId;
  templateName: string;
  language: string;
  segment: {
    leadIds?: string[];
    status?: string;
    source?: string;
    intentTag?: string;
  };
  status: "draft" | "sending" | "completed" | "failed";
  stats: {
    total: number;
    sent: number;
    failed: number;
  };
}

const campaignSchema = new Schema<ICampaign>(
  {
    businessId: {
      type: Schema.Types.ObjectId,
      ref: "Business",
      required: true,
    },
    templateName: { type: String, required: true },
    language: { type: String, required: true },
    segment: {
      leadIds: [{ type: String }],
      status: String,
      source: String,
      intentTag: String,
    },
    status: {
      type: String,
      enum: ["draft", "sending", "completed", "failed"],
      default: "draft",
    },
    stats: {
      total: { type: Number, default: 0 },
      sent: { type: Number, default: 0 },
      failed: { type: Number, default: 0 },
    },
  },
  {
    timestamps: true,
  }
);

const Campaign = mongoose.model<ICampaign>("Campaign", campaignSchema);

export default Campaign;
