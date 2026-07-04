import { Request, Response } from "express";
import AiEmployee from "../models/AiEmployee";
import { isBusinessOwner } from "../utils/ownership";

export const listAiEmployees = async (req: Request, res: Response): Promise<void> => {
  try {
    const { businessId } = req.params;
    const employees = await AiEmployee.find({ businessId }).sort({ createdAt: 1 });
    res.status(200).json({ success: true, data: employees });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to fetch AI employees" });
  }
};

export const createAiEmployee = async (req: Request, res: Response): Promise<void> => {
  try {
    const { businessId } = req.body;
    const userId = (req as any).user?.userId;

    if (!(await isBusinessOwner(userId, businessId))) {
      res.status(403).json({ success: false, message: "Forbidden" });
      return;
    }

    const employee = await AiEmployee.create(req.body);
    res.status(201).json({ success: true, data: employee });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : "Failed to create AI employee",
    });
  }
};

export const updateAiEmployee = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = (req as any).user?.userId;

    const existing = await AiEmployee.findById(id);
    if (!existing) {
      res.status(404).json({ success: false, message: "AI employee not found" });
      return;
    }

    if (!(await isBusinessOwner(userId, existing.businessId.toString()))) {
      res.status(403).json({ success: false, message: "Forbidden" });
      return;
    }

    const updated = await AiEmployee.findByIdAndUpdate(id, req.body, { new: true, runValidators: true });
    res.status(200).json({ success: true, data: updated });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : "Failed to update AI employee",
    });
  }
};

export const deleteAiEmployee = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = (req as any).user?.userId;

    const existing = await AiEmployee.findById(id);
    if (!existing) {
      res.status(404).json({ success: false, message: "AI employee not found" });
      return;
    }

    if (!(await isBusinessOwner(userId, existing.businessId.toString()))) {
      res.status(403).json({ success: false, message: "Forbidden" });
      return;
    }

    await AiEmployee.findByIdAndDelete(id);
    res.status(200).json({ success: true, message: "AI employee deleted" });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to delete AI employee" });
  }
};

export const activateAiEmployee = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = (req as any).user?.userId;

    const employee = await AiEmployee.findById(id);
    if (!employee) {
      res.status(404).json({ success: false, message: "AI employee not found" });
      return;
    }

    if (!(await isBusinessOwner(userId, employee.businessId.toString()))) {
      res.status(403).json({ success: false, message: "Forbidden" });
      return;
    }

    // Deactivate all others for this business first, then activate the chosen one
    await AiEmployee.updateMany({ businessId: employee.businessId }, { isActive: false });
    await AiEmployee.findByIdAndUpdate(id, { isActive: true });

    const updated = await AiEmployee.findById(id);
    res.status(200).json({ success: true, data: updated });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to activate AI employee" });
  }
};

export const deactivateAiEmployee = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = (req as any).user?.userId;

    const employee = await AiEmployee.findById(id);
    if (!employee) {
      res.status(404).json({ success: false, message: "AI employee not found" });
      return;
    }

    if (!(await isBusinessOwner(userId, employee.businessId.toString()))) {
      res.status(403).json({ success: false, message: "Forbidden" });
      return;
    }

    await AiEmployee.findByIdAndUpdate(id, { isActive: false });
    const updated = await AiEmployee.findById(id);
    res.status(200).json({ success: true, data: updated });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to deactivate AI employee" });
  }
};
