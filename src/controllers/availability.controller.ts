import { Request, Response } from "express";
import {
  createAvailability,
  getAvailability,
} from "../services/availability.service";

export const create = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const availability = await createAvailability(req.body);

    res.status(201).json({
      success: true,
      data: availability,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Failed to create availability",
    });
  }
};

export const getAll = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { businessId } = req.params;

    const availability = await getAvailability(businessId as string);

    res.status(200).json({
      success: true,
      data: availability,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Failed to fetch availability",
    });
  }
};
