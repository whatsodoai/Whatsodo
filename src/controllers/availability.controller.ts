import { Request, Response } from "express";
import {
  upsertAvailability,
  getAvailability,
  deleteAvailabilityForDay,
} from "../services/availability.service";

export const create = async (req: Request, res: Response): Promise<void> => {
  try {
    const availability = await upsertAvailability(req.body);
    res.status(200).json({ success: true, data: availability });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : "Failed to save availability",
    });
  }
};

export const getAll = async (req: Request, res: Response): Promise<void> => {
  try {
    const { businessId } = req.params;
    const availability = await getAvailability(businessId as string);
    res.status(200).json({ success: true, data: availability });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : "Failed to fetch availability",
    });
  }
};

export const deleteDay = async (req: Request, res: Response): Promise<void> => {
  try {
    const { businessId, day } = req.params;
    await deleteAvailabilityForDay(businessId as string, day as string);
    res.status(200).json({ success: true });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : "Failed to delete availability",
    });
  }
};
