import mongoose, { Schema, Document } from "mongoose";

export const AI_DEPARTMENTS = [
  "Sales",
  "Customer Support",
  "HR",
  "Finance",
  "Marketing",
  "Operations",
  "Customer Success",
] as const;

export const AI_ROLES = [
  "AI Sales Executive",
  "AI Receptionist",
  "AI Customer Support Executive",
  "AI Course Counselor",
  "AI Appointment Manager",
  "AI HR Assistant",
  "AI Marketing Executive",
  "AI Restaurant Assistant",
  "AI Healthcare Assistant",
  "Custom Role",
] as const;

export type AiDepartment = (typeof AI_DEPARTMENTS)[number];
export type AiRole = (typeof AI_ROLES)[number];

export interface IAiEmployee extends Document {
  businessId: mongoose.Types.ObjectId;
  name: string;
  role: string;
  department: string;
  personality: string;
  language: string;
  avatar: string;
  responsibilities: string[];
  workingInstructions: string;
  escalationRules: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const aiEmployeeSchema = new Schema<IAiEmployee>(
  {
    businessId: {
      type: Schema.Types.ObjectId,
      ref: "Business",
      required: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    role: {
      type: String,
      required: true,
      default: "AI Sales Executive",
    },
    department: {
      type: String,
      required: true,
      default: "Sales",
    },
    personality: {
      type: String,
      default: "Professional and friendly",
    },
    language: {
      type: String,
      default: "English",
    },
    avatar: {
      type: String,
      default: "🤖",
    },
    responsibilities: {
      type: [String],
      default: [],
    },
    workingInstructions: {
      type: String,
      default: "",
    },
    escalationRules: {
      type: String,
      default: "Escalate to a human agent when the customer requests it, expresses frustration, or asks about billing/refunds.",
    },
    isActive: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

// Ensure only one AI Employee is active per business at a time via index
aiEmployeeSchema.index({ businessId: 1, isActive: 1 });

const AiEmployee = mongoose.model<IAiEmployee>("AiEmployee", aiEmployeeSchema);

export default AiEmployee;
