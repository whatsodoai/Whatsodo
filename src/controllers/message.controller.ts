import { Request, Response } from "express";
import { getConversation, saveMessage, markConversationRead } from "../services/message.service";
import { sendWhatsAppMessage } from "../services/whatsapp.service";

export const sendManual = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { businessId, phone, message } = req.body;
    if (!businessId || !phone || !message) {
      res.status(400).json({ success: false, message: "businessId, phone and message are required" });
      return;
    }
    await sendWhatsAppMessage(phone, message);
    await saveMessage(businessId, phone, "outgoing", message);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : "Failed to send message",
    });
  }
};

export const conversation = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const businessId = req.params.businessId as string;
    const phone = req.params.phone as string;

    const messages = await getConversation(businessId, phone);
    // Mark incoming messages as read when the conversation is opened
    await markConversationRead(businessId, phone);

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

export const markRead = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { phone } = req.params;
    const businessId = (req.query.businessId || req.body.businessId) as string;

    if (!businessId) {
      res.status(400).json({ success: false, message: "businessId is required" });
      return;
    }

    await markConversationRead(businessId, phone);
    res.json({ success: true });
  } catch {
    res.status(500).json({ success: false });
  }
};
