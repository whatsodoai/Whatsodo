import Appointment from "../models/Appointment";

export const isSlotAvailable = async (
  businessId: string,
  date: string,
  time: string
) => {
  const existing = await Appointment.findOne({
    businessId,
    date,
    time,
  });

  return !existing;
};

export const generateSlots = (
  startHour: number,
  endHour: number
) => {
  const slots: string[] = [];

  for (let hour = startHour; hour < endHour; hour++) {
    slots.push(`${hour}:00`);
    slots.push(`${hour}:30`);
  }

  return slots;
};

export const getNextAvailableSlots = async (
  businessId: string,
  date: string
) => {
  const appointments = await Appointment.find({
    businessId,
    date,
  });

  const bookedTimes = appointments.map((a) => a.time);

  const allSlots = generateSlots(9, 18);

  return allSlots
    .filter((slot) => !bookedTimes.includes(slot))
    .slice(0, 5);
};
