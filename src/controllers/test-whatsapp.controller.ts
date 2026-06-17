import { Request, Response } from "express";
import { sendWhatsAppMessage } from "../services/whatsapp.service";

export const sendTestMessage = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { phone } = req.body;

    const result =
      await sendWhatsAppMessage(
        phone,
        "🚀 Hello from Whatsodo AI!"
      );

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    console.error(
      "WHATSAPP ERROR:",
      error.response?.data || error.message
    );

    res.status(500).json({
      success: false,
      error: error.response?.data,
      message: error.message,
    });
  }
};