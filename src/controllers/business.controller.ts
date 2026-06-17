import { Response } from "express";
import { AuthRequest } from "../middleware/auth.middleware";
import { createBusiness, getBusinesses } from "../services/business.service";

export const create = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { businessName, industry, whatsappNumber } = req.body;

    const business = await createBusiness(
      req.user!.userId,
      businessName,
      industry,
      whatsappNumber
    );

    res.status(201).json({
      success: true,
      data: business,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message:
        error instanceof Error ? error.message : "Failed to create business",
    });
  }
};

export const getAll = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const businesses = await getBusinesses(req.user!.userId);

    res.status(200).json({
      success: true,
      data: businesses,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message:
        error instanceof Error ? error.message : "Failed to fetch businesses",
    });
  }
};
