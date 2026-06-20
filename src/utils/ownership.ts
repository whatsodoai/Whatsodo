import Business from "../models/Business";

export const isOwnerOfBusiness = async (
  userId: string,
  businessId: string
): Promise<boolean> => {
  return !!(await Business.exists({ _id: businessId, ownerId: userId }));
};
