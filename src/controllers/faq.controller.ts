import { Request, Response } from "express";
import { findBestAnswer } from "../services/faq-engine.service";

export const chat = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { businessId, message } = req.body;

    const reply = await findBestAnswer(
      businessId,
      message
    );

    res.status(200).json({
      success: true,
      reply,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "FAQ chat failed",
    });
  }
};
