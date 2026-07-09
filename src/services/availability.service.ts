import Availability from "../models/Availability";

export const upsertAvailability = async (data: {
  businessId: string;
  day: string;
  startTime: string;
  endTime: string;
  isAvailable: boolean;
  slotDuration: number;
}) => {
  return await Availability.findOneAndUpdate(
    { businessId: data.businessId, day: data.day },
    { $set: data },
    { upsert: true, new: true }
  );
};

export const createAvailability = upsertAvailability;

export const getAvailability = async (businessId: string) => {
  return await Availability.find({ businessId }).sort({ day: 1 });
};

export const deleteAvailabilityForDay = async (businessId: string, day: string) => {
  return await Availability.deleteOne({ businessId, day });
};
