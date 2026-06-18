import { Request, Response } from "express";
import { createLead, getLeads } from "../services/lead.service";
import Lead from "../models/Lead";

export const create = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const lead = await createLead(req.body);

    res.status(201).json({
      success: true,
      data: lead,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Failed to create lead",
    });
  }
};

export const getAll = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { businessId } = req.params;

    const leads = await getLeads(businessId as string);

    res.status(200).json({
      success: true,
      data: leads,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Failed to fetch leads",
    });
  }
};

export const updateStatus = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { leadId } = req.params;
    const { status } = req.body;

    const lead = await Lead.findByIdAndUpdate(
      leadId,
      { status },
      { new: true }
    );

    if (!lead) {
      res.status(404).json({
        success: false,
        message: "Lead not found",
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: lead,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Failed to update lead status",
    });
  }
};

export const cleanupDuplicates = async (
  req: Request,
  res: Response
): Promise<void> => {
  const leads = await Lead.find().sort({
    updatedAt: -1,
  });

  const seen = new Set();

  for (const lead of leads) {
    const key = `${lead.businessId}_${lead.phone}`;

    if (seen.has(key)) {
      await Lead.findByIdAndDelete(lead._id);
    } else {
      seen.add(key);
    }
  }

  res.json({
    success: true,
    message: "Duplicate leads removed",
  });
};
