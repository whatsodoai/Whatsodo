import { Response } from "express";
import { AuthRequest } from "../middleware/auth.middleware";
import { createBusiness, getBusinesses } from "../services/business.service";
import { isBusinessOwner, hasBusinessAccess } from "../utils/ownership";
import Business from "../models/Business";
import User from "../models/User";

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
    if (!(await isBusinessOwner(req.user!.userId, businessId))) {
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

export const getOne = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;

    if (!(await hasBusinessAccess(req.user!.userId, id as string))) {
      res.status(403).json({ success: false, message: "Not authorized for this business" });
      return;
    }

    const business = await Business.findById(id)
      .populate("members.userId", "name email")
      .populate("ownerId", "name email")
      .lean();

    if (!business) {
      res.status(404).json({ success: false, message: "Business not found" });
      return;
    }

    res.json({ success: true, data: business });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : "Failed to fetch business",
    });
  }
};

export const addMember = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;
    const { email, role } = req.body;

    if (!(await isBusinessOwner(req.user!.userId, id as string))) {
      res.status(403).json({ success: false, message: "Only the business owner can do this" });
      return;
    }

    const user = await User.findOne({ email: email?.toLowerCase().trim() });
    if (!user) {
      res.status(404).json({
        success: false,
        message: "No Whatsodo account found with that email — ask them to sign up first, then invite again.",
      });
      return;
    }

    const business = await Business.findById(id);
    if (!business) {
      res.status(404).json({ success: false, message: "Business not found" });
      return;
    }

    if (business.ownerId.toString() === user._id.toString()) {
      res.status(400).json({ success: false, message: "This user already owns the business" });
      return;
    }
    if (business.members.some((m) => m.userId.toString() === user._id.toString())) {
      res.status(400).json({ success: false, message: "This user is already a member" });
      return;
    }

    business.members.push({
      userId: user._id as any,
      role: role === "admin" ? "admin" : "agent",
      addedAt: new Date(),
    });
    await business.save();

    res.status(201).json({
      success: true,
      data: { userId: user._id, name: user.name, email: user.email, role: role === "admin" ? "admin" : "agent" },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : "Failed to add member",
    });
  }
};

export const removeMember = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { id, userId } = req.params;

    if (!(await isBusinessOwner(req.user!.userId, id as string))) {
      res.status(403).json({ success: false, message: "Only the business owner can do this" });
      return;
    }

    const business = await Business.findByIdAndUpdate(
      id,
      { $pull: { members: { userId } } },
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
      message: error instanceof Error ? error.message : "Failed to remove member",
    });
  }
};
