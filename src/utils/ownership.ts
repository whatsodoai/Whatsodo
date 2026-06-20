import Business from "../models/Business";

/** True if the user owns the business OR is a team member (any role). */
export const hasBusinessAccess = async (
  userId: string,
  businessId: string
): Promise<boolean> => {
  return !!(await Business.exists({
    _id: businessId,
    $or: [{ ownerId: userId }, { "members.userId": userId }],
  }));
};

/** True only for the business owner — gates sensitive actions (credentials, members, deletion). */
export const isBusinessOwner = async (
  userId: string,
  businessId: string
): Promise<boolean> => {
  return !!(await Business.exists({ _id: businessId, ownerId: userId }));
};
