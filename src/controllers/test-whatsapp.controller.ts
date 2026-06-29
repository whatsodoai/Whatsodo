import { Request, Response } from "express";
import { sendWhatsAppMessage } from "../services/whatsapp.service";
import { AuthRequest } from "../middleware/auth.middleware";
import { isBusinessOwner } from "../utils/ownership";
import Business from "../models/Business";

export const sendTestMessage = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { phone, businessId } = req.body;

    if (!businessId) {
      res.status(400).json({ success: false, message: "businessId is required" });
      return;
    }
    if (!(await isBusinessOwner(req.user!.userId, businessId))) {
      res.status(403).json({ success: false, message: "Not authorized for this business" });
      return;
    }

    const business = await Business.findById(businessId).lean();
    if (!business?.whatsappAccessToken || !business?.whatsappPhoneNumberId) {
      res.status(400).json({
        success: false,
        message: "This business hasn't connected a WhatsApp number yet",
      });
      return;
    }

    const result = await sendWhatsAppMessage(phone, "🚀 Hello from Whatsodo AI!", {
      accessToken: business.whatsappAccessToken,
      phoneNumberId: business.whatsappPhoneNumberId,
    });

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