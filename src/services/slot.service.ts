import Appointment from "../models/Appointment";
import Availability from "../models/Availability";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + (m || 0);
}

function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function generateSlots(startTime: string, endTime: string, durationMinutes: number): string[] {
  const start = timeToMinutes(startTime);
  const end = timeToMinutes(endTime);
  const slots: string[] = [];
  for (let t = start; t + durationMinutes <= end; t += durationMinutes) {
    slots.push(minutesToTime(t));
  }
  return slots;
}

export const isSlotAvailable = async (
  businessId: string,
  date: string,
  time: string
): Promise<boolean> => {
  const existing = await Appointment.findOne({
    businessId,
    date,
    time,
    status: { $ne: "Cancelled" },
  });
  return !existing;
};

export const getAvailableSlotsForDate = async (
  businessId: string,
  date: string
): Promise<string[]> => {
  const dayName = DAYS[new Date(date + "T00:00:00").getDay()];

  const availability = await Availability.findOne({ businessId, day: dayName });

  let allSlots: string[];

  if (!availability || !availability.isAvailable) {
    // Fallback: Mon-Fri 9-18, 60-min slots
    const isWeekend = dayName === "Saturday" || dayName === "Sunday";
    if (isWeekend) return [];
    allSlots = generateSlots("09:00", "18:00", 60);
  } else {
    allSlots = generateSlots(availability.startTime, availability.endTime, availability.slotDuration);
  }

  const booked = await Appointment.find({
    businessId,
    date,
    status: { $ne: "Cancelled" },
  }).select("time");

  const bookedSet = new Set(booked.map((a) => a.time));
  return allSlots.filter((s) => !bookedSet.has(s));
};

// Legacy alias used by slot.controller.ts
export const getNextAvailableSlots = getAvailableSlotsForDate;
