import mongoose, { Schema, Document } from "mongoose";

export interface IAppointment extends Document {
  businessId: mongoose.Types.ObjectId;
  leadId: mongoose.Types.ObjectId;
  date: string;
  time: string;
  status: string;
  notes?: string;
}

const appointmentSchema = new Schema<IAppointment>(
  {
    businessId: {
      type: Schema.Types.ObjectId,
      ref: "Business",
      required: true,
    },
    leadId: {
      type: Schema.Types.ObjectId,
      ref: "Lead",
      required: true,
    },
    date: {
      type: String,
      required: true,
    },
    time: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      default: "Booked",
    },
    notes: String,
  },
  {
    timestamps: true,
  }
);

const Appointment = mongoose.model<IAppointment>("Appointment", appointmentSchema);

export default Appointment;
