import Business from "../models/Business";

export const createBusiness = async (
ownerId: string,
businessName: string,
industry: string,
whatsappNumber: string
) => {
const business = await Business.create({
ownerId,
businessName,
industry,
whatsappNumber,
});

return business;
};

export const getBusinesses = async (ownerId: string) => {
  return await Business.find({ ownerId }).sort({ createdAt: -1 });
};
