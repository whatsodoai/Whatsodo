import Appointment from "../models/Appointment";
import { isSlotAvailable } from "./slot.service";

export const createAppointment = async (data: any) => {
  const available = await isSlotAvailable(data.businessId, data.date, data.time);
  if (!available) throw new Error("That slot is already booked. Please choose another time.");
  return await Appointment.create(data);
};

export const rescheduleAppointment = async (
  id: string,
  newDate: string,
  newTime: string
) => {
  const existing = await Appointment.findById(id);
  if (!existing) throw new Error("Appointment not found");

  // Skip conflict check if the slot didn't change (same date+time)
  if (existing.date !== newDate || existing.time !== newTime) {
    const available = await isSlotAvailable(
      existing.businessId.toString(),
      newDate,
      newTime
    );
    if (!available) throw new Error("That slot is already taken. Please pick a different time.");
  }

  return await Appointment.findByIdAndUpdate(
    id,
    { date: newDate, time: newTime, status: "Booked" },
    { new: true }
  ).populate("leadId", "name phone");
};

export const getAppointments = async (businessId: string) => {
  return await Appointment.find({ businessId })
    .populate("leadId")
    .sort({ createdAt: -1 });
};
