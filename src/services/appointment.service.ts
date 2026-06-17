import Appointment from "../models/Appointment";
import { isSlotAvailable } from "./slot.service";

export const createAppointment = async (data: any) => {
  const available = await isSlotAvailable(
    data.businessId,
    data.date,
    data.time
  );

  if (!available) {
    throw new Error("Slot already booked");
  }

  return await Appointment.create(data);
};

export const getAppointments = async (businessId: string) => {
  return await Appointment.find({ businessId })
    .populate("leadId")
    .sort({ createdAt: -1 });
};
