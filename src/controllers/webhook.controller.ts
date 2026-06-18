import { Request, Response } from "express";
import { sendWhatsAppMessage } from "../services/whatsapp.service";
import { FAQEngineService } from "../services/faq-engine.service";

const faqEngine = new FAQEngineService();

export const verifyWebhook = (
  req: Request,
  res: Response
): void => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  console.log("MODE:", mode);
  console.log("TOKEN:", token);
  console.log("ENV TOKEN:", process.env.WHATSAPP_VERIFY_TOKEN);

  if (
    mode === "subscribe" &&
    token === process.env.WHATSAPP_VERIFY_TOKEN
  ) {
    console.log("✅ Webhook Verified");

    res.status(200).send(challenge);
    return;
  }

  res.sendStatus(403);
};

export const receiveWebhook = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    console.log(
      JSON.stringify(req.body, null, 2)
    );

    const phone =
      req.body?.entry?.[0]?.changes?.[0]?.value?.messages?.[0]?.from;

    const message =
      req.body?.entry?.[0]?.changes?.[0]?.value?.messages?.[0]?.text?.body;

    console.log("PHONE:", phone);
    console.log("MESSAGE:", message);

    const businessId = "6a3263dbad9dcef582076cd1";

    if (phone && message) {
      const answer = await faqEngine.findAnswer(
        businessId,
        message
      );

      if (answer) {
        await sendWhatsAppMessage(phone, answer);
      } else {
        await sendWhatsAppMessage(
          phone,
          `Thank you for contacting Advertoria.

We provide:
• Branding
• Logo Design
• Website Development
• UI/UX Design
• Digital Marketing

Could you tell us more about your requirement?`
        );
      }
    }

    res.sendStatus(200);
  } catch (error) {
    res.sendStatus(500);
  }
};
