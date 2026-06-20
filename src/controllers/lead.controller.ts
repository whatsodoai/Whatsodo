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
    const { status, page, limit } = req.query;

    const filter: Record<string, unknown> = { businessId };
    if (status) filter.status = status;

    const pageNum = Math.max(1, parseInt(page as string) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit as string) || 0));

    const query = Lead.find(filter).sort({ createdAt: -1 });
    if (limitNum > 0) {
      query.skip((pageNum - 1) * limitNum).limit(limitNum);
    }

    const [leads, total] = await Promise.all([
      query.exec(),
      Lead.countDocuments(filter),
    ]);

    res.status(200).json({
      success: true,
      data: leads,
      ...(limitNum > 0 && { pagination: { page: pageNum, limit: limitNum, total } }),
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

export const search = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { businessId, q } = req.query;

    if (!businessId || !q) {
      res.status(400).json({ success: false, message: "businessId and q are required" });
      return;
    }

    const regex = new RegExp(q as string, "i");
    const leads = await Lead.find({
      businessId: businessId as string,
      $or: [
        { name: regex },
        { phone: regex },
        { email: regex },
        { interest: regex },
        { notes: regex },
      ],
    }).sort({ createdAt: -1 }).limit(50);

    res.json({ success: true, data: leads });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : "Search failed",
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

export const updateLead = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;
    const { name, email, notes, interest, status } = req.body;
    const updated = await Lead.findByIdAndUpdate(
      id,
      { ...(name && { name }), ...(email !== undefined && { email }), ...(notes !== undefined && { notes }), ...(interest && { interest }), ...(status && { status }) },
      { new: true }
    );
    if (!updated) {
      res.status(404).json({ success: false, message: "Lead not found" });
      return;
    }
    res.json({ success: true, data: updated });
  } catch (error) {
    res.status(500).json({ success: false, message: error instanceof Error ? error.message : "Failed to update lead" });
  }
};

export const deleteLead = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;
    const deleted = await Lead.findByIdAndDelete(id);
    if (!deleted) {
      res.status(404).json({ success: false, message: "Lead not found" });
      return;
    }
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, message: error instanceof Error ? error.message : "Failed to delete lead" });
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
