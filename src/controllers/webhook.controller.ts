import { Request, Response } from "express";
import { sendWhatsAppMessage } from "../services/whatsapp.service";
import { generateReply } from "../services/ai.service";
import { getKnowledgeBaseByBusiness } from "../services/knowledge-base.service";
import {
  LeadService,
  findLeadByPhone,
  updateLeadInterest,
} from "../services/lead.service";
import { createAppointment } from "../services/appointment.service";
import { getNextAvailableSlots } from "../services/slot.service";
import { saveMessage } from "../services/message.service";
import Business from "../models/Business";
import { getIO } from "../socket";

const leadService = new LeadService();

const appointmentKeywords = [
  "call", "consultation", "meeting", "appointment",
  "schedule", "discuss", "talk", "book",
];

async function buildSystemPrompt(businessId: string): Promise<string | null> {
  const kb = await getKnowledgeBaseByBusiness(businessId);
  if (!kb) return null;
  return `
You are an AI assistant for ${kb.companyName}.

About: ${kb.companyDescription}

Services: ${kb.services.join(", ")}

FAQs:
${kb.faqs.map((f) => `Q: ${f.question}\nA: ${f.answer}`).join("\n\n")}

Sales Instructions: ${kb.salesInstructions}
Appointment Instructions: ${kb.appointmentInstructions}
Tone: ${kb.tone}

Lead Qualification Questions: ${kb.leadQualificationQuestions?.join(", ")}
Offers: ${kb.offers?.join(", ")}
Objection Handling: ${kb.objectionHandling?.map((o) => `If "${o.objection}" → "${o.response}"`).join("; ")}

Rules:
- Reply in the same language the customer uses.
- Keep replies short and conversational (under 120 words).
- If the customer seems interested in booking or consulting, ask them to reply with "BOOK".
- If you cannot help, say you will connect them with the team.
`.trim();
}

export const verifyWebhook = (req: Request, res: Response): void => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    console.log("✅ Webhook Verified");
    res.status(200).send(challenge);
    return;
  }
  res.sendStatus(403);
};

export const receiveWebhook = async (req: Request, res: Response): Promise<void> => {
  try {
    const value = req.body?.entry?.[0]?.changes?.[0]?.value;

    if (!value?.messages?.length) {
      res.sendStatus(200);
      return;
    }

    const phone = value.messages[0].from;
    const msgType: string = value.messages[0].type || "text";
    const message: string =
      value.messages[0].text?.body ||
      (msgType !== "text" ? `[${msgType} message]` : "");
    const contactName: string =
      value.contacts?.[0]?.profile?.name || "WhatsApp Prospect";

    if (!phone) {
      res.sendStatus(200);
      return;
    }

    // Resolve businessId: slug → whatsapp number → newest business
    const slug = req.params.businessSlug;
    let businessId: string;

    const slugStr = Array.isArray(slug) ? slug[0] : slug;
    let business = slugStr
      ? await Business.findOne({
          businessName: { $regex: new RegExp(`^${slugStr.replace(/-/g, " ")}$`, "i") },
        }).lean()
      : null;

    if (!business) {
      // Match by the WhatsApp number that received this message
      const displayPhone: string | undefined =
        value.metadata?.display_phone_number;
      if (displayPhone) {
        const digits = displayPhone.replace(/\D/g, "");
        const candidates = await Business.find().lean();
        business =
          candidates.find(
            (b) => b.whatsappNumber.replace(/\D/g, "") === digits
          ) ?? null;
      }
    }

    if (!business) {
      // Last resort: newest business in DB (matches frontend default sort)
      business = await Business.findOne().sort({ createdAt: -1 }).lean();
    }

    if (!business) { res.sendStatus(200); return; }
    businessId = (business._id as any).toString();

    if (message) {
      const savedMsg = await saveMessage(businessId, phone, "incoming", message);
      try {
        getIO().to(`business:${businessId}`).emit("new:message", {
          businessId,
          phone,
          message: savedMsg,
          leadName: contactName,
        });
      } catch { /* socket not yet init in tests */ }
    }

    const lowerMsg = message.toLowerCase().trim();

    // ── STEP 1: Capture / update lead (always, for every message) ──
    let lead = await findLeadByPhone(businessId, phone);
    if (!lead) {
      try {
        lead = await leadService.createLead({
          businessId,
          name: contactName,
          phone,
          interest: message || undefined,
          source: "WhatsApp",
        });
      } catch (err) {
        console.error("Lead creation failed:", err);
      }
    } else {
      try {
        await updateLeadInterest(lead._id.toString(), message);
      } catch (err) {
        console.error("Lead update failed:", err);
      }
    }

    // ── STEP 2–5 only apply to real text messages ──
    if (!message || msgType !== "text") {
      res.sendStatus(200);
      return;
    }

    // ── STEP 2: Slot confirmation (e.g. "10:00") ──
    const slotPattern = /^\d{1,2}:\d{2}(\s*(am|pm))?$/i;
    if (slotPattern.test(lowerMsg)) {
      if (lead) {
        const today = new Date().toISOString().split("T")[0];
        await createAppointment({
          businessId,
          leadId: lead._id.toString(),
          date: today,
          time: message.trim(),
          notes: "Booked via WhatsApp",
        });
        await leadService.updateLeadStatus(lead._id.toString(), "Appointment Booked");

        const confirm = `✅ Appointment confirmed!\n\nTime: ${message.trim()}\nDate: ${today}\n\nOur team will contact you shortly. Thank you!`;
        const confirmMsg = await saveMessage(businessId, phone, "outgoing", confirm);
        try { getIO().to(`business:${businessId}`).emit("new:message", { businessId, phone, message: confirmMsg }); } catch {}
        await sendWhatsAppMessage(phone, confirm);
        res.sendStatus(200);
        return;
      }
    }

    // ── STEP 3: Appointment / booking intent ──
    const wantsAppointment = lowerMsg === "book" || appointmentKeywords.some((kw) => lowerMsg.includes(kw));
    if (wantsAppointment) {
      const today = new Date().toISOString().split("T")[0];
      const slots = await getNextAvailableSlots(businessId, today);
      const slotList = slots.length
        ? slots.map((s, i) => `${i + 1}. ${s}`).join("\n")
        : "No slots available today. Please contact us directly.";

      const slotMsg = `Here are today's available consultation slots:\n\n${slotList}\n\nReply with your preferred time (e.g. "10:00") to confirm.`;
      const slotSaved = await saveMessage(businessId, phone, "outgoing", slotMsg);
      try { getIO().to(`business:${businessId}`).emit("new:message", { businessId, phone, message: slotSaved }); } catch {}
      await sendWhatsAppMessage(phone, slotMsg);
      res.sendStatus(200);
      return;
    }

    // ── STEP 4: AI-powered reply ──
    const systemPrompt = await buildSystemPrompt(businessId);

    if (systemPrompt) {
      const reply = await generateReply(systemPrompt, message);
      if (reply) {
        const replySaved = await saveMessage(businessId, phone, "outgoing", reply);
        try { getIO().to(`business:${businessId}`).emit("new:message", { businessId, phone, message: replySaved }); } catch {}
        await sendWhatsAppMessage(phone, reply);
        res.sendStatus(200);
        return;
      }
    }

    // ── STEP 5: Fallback ──
    const fallback = `Thank you for reaching out! Our team will get back to you shortly. Reply "BOOK" to schedule a free consultation.`;
    const fallbackSaved = await saveMessage(businessId, phone, "outgoing", fallback);
    try { getIO().to(`business:${businessId}`).emit("new:message", { businessId, phone, message: fallbackSaved }); } catch {}
    await sendWhatsAppMessage(phone, fallback);
    res.sendStatus(200);
  } catch (error) {
    console.error("Webhook error:", error);
    res.sendStatus(500);
  }
};
