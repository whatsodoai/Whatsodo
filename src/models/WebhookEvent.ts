import mongoose, { Schema, Document } from "mongoose";

export interface IWebhookEvent extends Document {
  businessId?: string;
  field: string;
  payload: object;
  createdAt: Date;
}

const WebhookEventSchema = new Schema<IWebhookEvent>(
  {
    businessId: { type: String, index: true },
    field: { type: String, default: "messages" },
    payload: { type: Schema.Types.Mixed },
    createdAt: { type: Date, default: Date.now },
  },
  { timestamps: false }
);

// Auto-expire events after 24 hours — they exist only for live debugging
WebhookEventSchema.index({ createdAt: 1 }, { expireAfterSeconds: 86400 });

export default mongoose.model<IWebhookEvent>("WebhookEvent", WebhookEventSchema);
