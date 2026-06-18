import { Request, Response } from "express";
import { sendWhatsAppMessage } from "../services/whatsapp.service";
import { FAQEngineService } from "../services/faq-engine.service";
import { LeadService } from "../services/lead.service";
import { createAppointment } from "../services/appointment.service";

const faqEngine = new FAQEngineService();
const leadService = new LeadService();

const leadKeywords = [
  "website",
  "logo",
  "branding",
  "digital marketing",
  "seo",
  "google ads",
  "meta ads",
  "price",
  "cost",
  "quotation",
  "consultation",
  "interested",
  "need service",
];

const appointmentKeywords = [
  "call",
  "consultation",
  "meeting",
  "appointment",
  "schedule",
  "discuss",
  "talk",
];

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
    console.log(JSON.stringify(req.body, null, 2));

    const phone =
      req.body?.entry?.[0]?.changes?.[0]?.value?.messages?.[0]?.from;

    const message =
      req.body?.entry?.[0]?.changes?.[0]?.value?.messages?.[0]?.text?.body;

    console.log("PHONE:", phone);
    console.log("MESSAGE:", message);

    const businessId = "6a3263dbad9dcef582076cd1";

    if (phone && message) {
      const lowerMessage = message.toLowerCase();

      const selectedSlotPattern =
        /^(10:00 AM|11:00 AM|03:00 PM|04:00 PM)$/i;
      const selectedSlot = message.trim().match(selectedSlotPattern);

      console.log("RAW MESSAGE:", message);
      console.log("SELECTED SLOT:", selectedSlot);

      const isLead = leadKeywords.some((kw) =>
        lowerMessage.includes(kw)
      );

      console.log("IS LEAD:", isLead);

      const wantsAppointment = appointmentKeywords.some((keyword) =>
        lowerMessage.includes(keyword)
      );

      console.log("WANTS APPOINTMENT:", wantsAppointment);

      // STEP 0 - Slot selected → book appointment
      if (selectedSlot) {
        console.log("BOOKING APPOINTMENT...");

        console.log("FETCHING LEADS...");
        const leads = await leadService.getLeads(businessId);
        console.log("PHONE LOOKUP:", phone);
        console.log("LEADS COUNT:", leads.length);
        const normalizedPhone = phone.replace("+", "");
        const lead = leads.find(
          (l: any) => l.phone.replace("+", "") === normalizedPhone
        );
        console.log("FOUND LEAD:", lead);

        if (lead) {
          try {
            await createAppointment({
              businessId,
              leadId: lead._id.toString(),
              date: "2026-06-20",
              time: selectedSlot[0],
              notes: "WhatsApp Consultation",
            });

            console.log("APPOINTMENT CREATED");

            console.log("SENDING CONFIRMATION...");

            const result = await sendWhatsAppMessage(
              phone,
              `✅ Appointment Confirmed

Date: 20-Jun-2026
Time: ${selectedSlot[0]}

Our team will contact you shortly.`
            );

            console.log("WHATSAPP RESPONSE:", result);
            console.log("CONFIRMATION SENT");
          } catch (error) {
            console.log("APPOINTMENT ERROR:", error);

            await sendWhatsAppMessage(
              phone,
              "Unable to book appointment. Please try again."
            );
          }

          res.sendStatus(200);
          return;
        }
      }

      // STEP 1 - Create Lead
      if (isLead) {
        try {
          console.log("CREATING LEAD...");
          await leadService.createLead({
            businessId,
            name: "WhatsApp Prospect",
            phone,
            interest: message,
            source: "WhatsApp",
          });
          console.log("LEAD CREATED");
        } catch (error) {
          console.log("Lead may already exist:", error);
        }
      }

      // STEP 2 - Appointment Intent
      if (wantsAppointment) {
        await sendWhatsAppMessage(
          phone,
          `Available consultation slots:

1. 10:00 AM
2. 11:00 AM
3. 03:00 PM
4. 04:00 PM

Reply with your preferred slot.`
        );
        res.sendStatus(200);
        return;
      }

      // STEP 3 - FAQ Reply
      const answer = await faqEngine.findAnswer(businessId, message);

      if (answer) {
        await sendWhatsAppMessage(phone, answer);
      } else if (isLead) {
        await sendWhatsAppMessage(
          phone,
          `Thank you for your interest.

A consultation specialist will contact you shortly.

Would you like to schedule a free consultation call?`
        );
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
