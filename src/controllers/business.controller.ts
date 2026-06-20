import { Response } from "express";
import { AuthRequest } from "../middleware/auth.middleware";
import { createBusiness, getBusinesses } from "../services/business.service";
import { isOwnerOfBusiness } from "../utils/ownership";
import Business from "../models/Business";

const slugify = (name: string) =>
  name.trim().toLowerCase().replace(/\s+/g, "-");

export const getWhatsAppDefaults = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { businessId } = req.query;

    if (!businessId || typeof businessId !== "string") {
      res.status(400).json({ success: false, message: "businessId is required" });
      return;
    }
    if (!(await isOwnerOfBusiness(req.user!.userId, businessId))) {
      res.status(403).json({ success: false, message: "Not authorized for this business" });
      return;
    }

    const business = await Business.findById(businessId).lean();
    if (!business) {
      res.status(404).json({ success: false, message: "Business not found" });
      return;
    }

    res.json({
      success: true,
      data: {
        webhookUrl: `https://whatsodo.onrender.com/api/webhook/${slugify(business.businessName)}`,
        verifyToken: business.whatsappVerifyToken || process.env.WHATSAPP_VERIFY_TOKEN || "",
        phoneNumberId: business.whatsappPhoneNumberId || process.env.WHATSAPP_PHONE_NUMBER_ID || "",
        hasAccessToken: !!(business.whatsappAccessToken || process.env.WHATSAPP_ACCESS_TOKEN),
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
