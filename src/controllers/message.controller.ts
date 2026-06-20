import { Request, Response } from "express";
import { getConversation, saveMessage, markConversationRead } from "../services/message.service";
import { sendWhatsAppMessage, sendWhatsAppMedia } from "../services/whatsapp.service";
import { uploadBuffer } from "../services/upload.service";
import Business from "../models/Business";

const MIME_TO_WHATSAPP_TYPE: Record<string, "image" | "video" | "document"> = {
  image: "image",
  video: "video",
  application: "document",
};

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

export const sendMedia = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { businessId, phone, caption } = req.body;
    const file = (req as Request & { file?: Express.Multer.File }).file;

    if (!businessId || !phone || !file) {
      res.status(400).json({ success: false, message: "businessId, phone and file are required" });
      return;
    }

    const mediaType = MIME_TO_WHATSAPP_TYPE[file.mimetype.split("/")[0]];
    if (!mediaType) {
      res.status(400).json({ success: false, message: "Unsupported file type" });
      return;
    }

    const business = await Business.findById(businessId).lean();
    if (!business) {
      res.status(404).json({ success: false, message: "Business not found" });
      return;
    }

    const { url } = await uploadBuffer(file.buffer, file.mimetype);
    const credentials = {
      accessToken: business.whatsappAccessToken,
      phoneNumberId: business.whatsappPhoneNumberId,
    };

    await sendWhatsAppMedia(
      phone,
      mediaType,
      url,
      { caption, filename: file.originalname },
      credentials
    );

    const saved = await saveMessage(
      businessId,
      phone,
      "outgoing",
      caption || file.originalname,
      undefined,
      {
        mediaType,
        mediaUrl: url,
        mediaCaption: caption,
        fileName: file.originalname,
      }
    );

    res.json({ success: true, data: saved });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : "Failed to send media message",
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
    const phone = req.params.phone as string;
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
