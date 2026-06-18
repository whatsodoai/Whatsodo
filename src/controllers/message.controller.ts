import { Request, Response } from "express";
import { getConversation } from "../services/message.service";

export const conversation = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const businessId = req.params.businessId as string;
    const phone = req.params.phone as string;

    const messages = await getConversation(businessId, phone);

    res.json({
      success: true,
      data: messages,
    });
  } catch {
    res.status(500).json({
      success: false,
    });
  }
};
