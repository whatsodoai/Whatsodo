import { Request, Response } from "express";
import { AuthRequest } from "../middleware/auth.middleware";
import { createLead, getLeads } from "../services/lead.service";
import { isOwnerOfBusiness } from "../utils/ownership";
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
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { businessId, q } = req.query;

    if (!businessId || !q) {
      res.status(400).json({ success: false, message: "businessId and q are required" });
      return;
    }

    if (!(await isOwnerOfBusiness(req.user!.userId, businessId as string))) {
      res.status(403).json({ success: false, message: "Not authorized for this business" });
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
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { leadId } = req.params;
    const { status } = req.body;

    const existing = await Lead.findById(leadId);
    if (!existing) {
      res.status(404).json({ success: false, message: "Lead not found" });
      return;
    }
    if (!(await isOwnerOfBusiness(req.user!.userId, existing.businessId.toString()))) {
      res.status(403).json({ success: false, message: "Not authorized for this business" });
      return;
    }

    const lead = await Lead.findOneAndUpdate(
      { _id: leadId, businessId: existing.businessId },
      { status },
      { new: true }
    );

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
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;
    const { name, email, notes, interest, status } = req.body;

    const existing = await Lead.findById(id);
    if (!existing) {
      res.status(404).json({ success: false, message: "Lead not found" });
      return;
    }
    if (!(await isOwnerOfBusiness(req.user!.userId, existing.businessId.toString()))) {
      res.status(403).json({ success: false, message: "Not authorized for this business" });
      return;
    }

    const updated = await Lead.findOneAndUpdate(
      { _id: id, businessId: existing.businessId },
      { ...(name && { name }), ...(email !== undefined && { email }), ...(notes !== undefined && { notes }), ...(interest && { interest }), ...(status && { status }) },
      { new: true }
    );
    res.json({ success: true, data: updated });
  } catch (error) {
    res.status(500).json({ success: false, message: error instanceof Error ? error.message : "Failed to update lead" });
  }
};

export const deleteLead = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;

    const existing = await Lead.findById(id);
    if (!existing) {
      res.status(404).json({ success: false, message: "Lead not found" });
      return;
    }
    if (!(await isOwnerOfBusiness(req.user!.userId, existing.businessId.toString()))) {
      res.status(403).json({ success: false, message: "Not authorized for this business" });
      return;
    }

    await Lead.findOneAndDelete({ _id: id, businessId: existing.businessId });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, message: error instanceof Error ? error.message : "Failed to delete lead" });
  }
};
