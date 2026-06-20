import { Response, NextFunction } from "express";
import { AuthRequest } from "./auth.middleware";
import { isOwnerOfBusiness } from "../utils/ownership";

export const verifyBusinessOwnership = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const businessId = req.params.businessId;

  if (typeof businessId !== "string" || !(await isOwnerOfBusiness(req.user!.userId, businessId))) {
    res.status(403).json({ success: false, message: "Not authorized for this business" });
    return;
  }

  next();
};
