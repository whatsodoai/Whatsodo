import { Request, Response } from "express";
import { sendWhatsAppMessage } from "../services/whatsapp.service";

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

    if (phone && message) {
      await sendWhatsAppMessage(
        phone,
        `Hello ${phone}, I received your message: "${message}"`
      );
    }

    res.sendStatus(200);
  } catch (error) {
    res.sendStatus(500);
  }
};