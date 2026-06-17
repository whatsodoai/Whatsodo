import mongoose, { Schema, Document } from "mongoose";

export interface IAvailability extends Document {
  businessId: mongoose.Types.ObjectId;
  day: string;
  startTime: string;
  endTime: string;
  isAvailable: boolean;
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
  },
  {
    timestamps: true,
  }
);

const Availability = mongoose.model<IAvailability>("Availability", availabilitySchema);

export default Availability;
