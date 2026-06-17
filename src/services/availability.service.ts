import Availability from "../models/Availability";

export const createAvailability =
async (data: any) => {
return await Availability.create(
data
);
};

export const getAvailability =
async (businessId: string) => {
return await Availability.find({
businessId,
}).sort({
day: 1,
});
};
