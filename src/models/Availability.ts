import mongoose, { Schema, Document } from "mongoose";

export interface IAvailability extends Document {
  businessId: mongoose.Types.ObjectId;
  day: string;
  startTime: string;
  endTime: string;
  isAvailable: boolean;
  slotDuration: number; // minutes per slot: 30 | 45 | 60 | 90 | 120
}

const availabilitySchema = new Schema<IAvailability>(
  {
    businessId: {
      type: Schema.Types.ObjectId,
      ref: "Business",
      required: true,
    },
    day: {
      type: String,
      required: true,
    },
    startTime: {
      type: String,
      required: true,
    },
    endTime: {
      type: String,
      required: true,
    },
    isAvailable: {
      type: Boolean,
      default: true,
    },
    slotDuration: {
      type: Number,
      default: 60,
    },
  },
  {
    timestamps: true,
  }
);

availabilitySchema.index({ businessId: 1, day: 1 }, { unique: true });

const Availability = mongoose.model<IAvailability>("Availability", availabilitySchema);

export default Availability;
