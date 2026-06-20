import Business from "../models/Business";

export const createBusiness = async (
  ownerId: string,
  businessName: string,
  industry: string,
  whatsappNumber: string
) => {
  const existing = await Business.findOne({ ownerId, businessName });
  if (existing) {
    throw new Error(`A business named "${businessName}" already exists.`);
  }

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
