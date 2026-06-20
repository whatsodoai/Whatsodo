import mongoose, { Schema, Document } from "mongoose";

export interface ILead extends Document {
  businessId: mongoose.Types.ObjectId;
  name: string;
  phone: string;
  email?: string;
  interest?: string;
  source: string;
  status: string;
  notes?: string;
  intentTag?: "hot" | "warm" | "cold";
  intentScore?: number;
  assignedTo?: mongoose.Types.ObjectId;
}

const leadSchema = new Schema<ILead>(
  {
    businessId: {
      type: Schema.Types.ObjectId,
      ref: "Business",
      required: true,
    },
    name: {
      type: String,
      required: true,
    },
    phone: {
      type: String,
      required: true,
    },
    email: String,
    interest: String,
    source: {
      type: String,
      default: "WhatsApp",
    },
    status: {
      type: String,
      default: "New Lead",
    },
    notes: String,
    intentTag: {
      type: String,
      enum: ["hot", "warm", "cold"],
      default: "warm",
    },
    intentScore: Number,
    assignedTo: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
  },
  {
    timestamps: true,
  }
);

const Lead = mongoose.model<ILead>("Lead", leadSchema);

export default Lead;
