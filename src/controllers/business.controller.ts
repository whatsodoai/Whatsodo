import { Response } from "express";
import { AuthRequest } from "../middleware/auth.middleware";
import { createBusiness, getBusinesses } from "../services/business.service";
import Business from "../models/Business";

export const getWhatsAppDefaults = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    res.json({
      success: true,
      data: {
        webhookUrl: "https://whatsodo.onrender.com/api/webhook",
        verifyToken: process.env.WHATSAPP_VERIFY_TOKEN || "",
        phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID || "",
        hasAccessToken: !!(process.env.WHATSAPP_ACCESS_TOKEN),
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch WhatsApp defaults",
    });
  }
};

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

export const update = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;
    const { businessName, industry, whatsappNumber, timezone, whatsappAccessToken, whatsappPhoneNumberId, whatsappVerifyToken } = req.body;

    const business = await Business.findOneAndUpdate(
      { _id: id, ownerId: req.user!.userId },
      {
        ...(businessName && { businessName }),
        ...(industry && { industry }),
        ...(whatsappNumber && { whatsappNumber }),
        ...(timezone && { timezone }),
        ...(whatsappAccessToken !== undefined && { whatsappAccessToken }),
        ...(whatsappPhoneNumberId !== undefined && { whatsappPhoneNumberId }),
        ...(whatsappVerifyToken !== undefined && { whatsappVerifyToken }),
      },
      { new: true }
    );

    if (!business) {
      res.status(404).json({ success: false, message: "Business not found" });
      return;
    }

    res.json({ success: true, data: business });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : "Failed to update business",
    });
  }
};
