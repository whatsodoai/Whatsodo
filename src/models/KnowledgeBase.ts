import mongoose, { Schema, Document } from "mongoose";

export interface IKnowledgeBase extends Document {
  businessId: mongoose.Types.ObjectId;
  companyName: string;
  companyDescription: string;
  services: string[];
  faqs: {
    question: string;
    answer: string;
  }[];
  salesInstructions: string;
  appointmentInstructions: string;
  tone: string;
  contactEmail: string;
  contactPhone: string;
  leadQualificationQuestions: string[];
  callToActions: string[];
  offers: string[];
  objectionHandling: {
    objection: string;
    response: string;
  }[];
}

const knowledgeBaseSchema = new Schema<IKnowledgeBase>(
  {
    businessId: {
      type: Schema.Types.ObjectId,
      ref: "Business",
      required: true,
    },
    companyName: {
      type: String,
      required: true,
    },
    companyDescription: {
      type: String,
      default: '',
    },
    services: [{ type: String }],
    faqs: [
      {
        question: String,
        answer: String,
      },
    ],
    salesInstructions: { type: String },
    appointmentInstructions: { type: String },
    tone: {
      type: String,
      default: "Professional",
    },
    contactEmail: { type: String },
    contactPhone: { type: String },
    leadQualificationQuestions: [{ type: String }],
    callToActions: [{ type: String }],
    offers: [{ type: String }],
    objectionHandling: [
      {
        objection: String,
        response: String,
      },
    ],
  },
  { timestamps: true }
);

const KnowledgeBase = mongoose.model<IKnowledgeBase>(
  "KnowledgeBase",
  knowledgeBaseSchema
);

export default KnowledgeBase;
