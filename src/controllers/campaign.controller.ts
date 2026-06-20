import { Response } from "express";
import { AuthRequest } from "../middleware/auth.middleware";
import { createCampaign, getCampaigns, getCampaignDetail } from "../services/campaign.service";
import { hasBusinessAccess } from "../utils/ownership";

export const create = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { businessId, templateName, language, leadIds, filter, variables } = req.body;

    if (!businessId || !templateName || !language) {
      res.status(400).json({ success: false, message: "businessId, templateName and language are required" });
      return;
    }
    if (!(await hasBusinessAccess(req.user!.userId, businessId))) {
      res.status(403).json({ success: false, message: "Not authorized for this business" });
      return;
    }

    const campaign = await createCampaign({ businessId, templateName, language, leadIds, filter, variables });
    res.status(201).json({ success: true, data: campaign });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error instanceof Error ? error.message : "Failed to create campaign",
    });
  }
};

export const getAll = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const businessId = req.params.businessId as string;

    if (!(await hasBusinessAccess(req.user!.userId, businessId))) {
      res.status(403).json({ success: false, message: "Not authorized for this business" });
      return;
    }

    const campaigns = await getCampaigns(businessId);
    res.json({ success: true, data: campaigns });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : "Failed to fetch campaigns",
    });
  }
};

export const getOne = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const businessId = req.params.businessId as string;
    const campaignId = req.params.campaignId as string;

    if (!(await hasBusinessAccess(req.user!.userId, businessId))) {
      res.status(403).json({ success: false, message: "Not authorized for this business" });
      return;
    }

    const detail = await getCampaignDetail(campaignId);
    if (!detail) {
      res.status(404).json({ success: false, message: "Campaign not found" });
      return;
    }

    res.json({ success: true, data: detail });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : "Failed to fetch campaign",
    });
  }
};
