import { Response, NextFunction } from "express";
import { AuthRequest } from "./auth.middleware";
import { hasBusinessAccess, isBusinessOwner } from "../utils/ownership";

/** Allows owner OR any team member — use for general read/write business routes. */
export const verifyBusinessOwnership = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const businessId = req.params.businessId;

  if (typeof businessId !== "string" || !(await hasBusinessAccess(req.user!.userId, businessId))) {
    res.status(403).json({ success: false, message: "Not authorized for this business" });
    return;
  }

  next();
};

/** Owner only — use for sensitive routes (credentials, members, business deletion). */
export const verifyBusinessOwner = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const businessId = req.params.businessId || req.params.id;

  if (typeof businessId !== "string" || !(await isBusinessOwner(req.user!.userId, businessId))) {
    res.status(403).json({ success: false, message: "Only the business owner can do this" });
    return;
  }

  next();
};
