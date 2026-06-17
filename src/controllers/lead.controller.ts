import { Request, Response } from "express";
import { createLead, getLeads } from "../services/lead.service";

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
