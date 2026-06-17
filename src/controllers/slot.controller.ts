import { Request, Response } from "express";
import { getNextAvailableSlots } from "../services/slot.service";

export const getSlots = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const businessId = req.params.businessId as string;
    const date = req.params.date as string;

    const slots =
      await getNextAvailableSlots(
        businessId,
        date
      );

    res.status(200).json({
      success: true,
      slots,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Failed to get slots",
    });
  }
};