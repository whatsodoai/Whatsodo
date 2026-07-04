import { Request, Response } from "express";
import { sendWhatsAppMessage } from "../services/whatsapp.service";
import { buildKnowledgeBaseReply, buildAISystemPrompt } from "../services/knowledge-base.service";
import { generateReply, scoreLeadIntent, ChatTurn } from "../services/ai.service";
import {
  LeadService,
  findLeadByPhone,
  updateLeadInterest,
} from "../services/lead.service";
import { createAppointment } from "../services/appointment.service";
import { getNextAvailableSlots } from "../services/slot.service";
import { saveMessage, isDuplicateWamid, getConversation } from "../services/message.service";
import Business from "../models/Business";
import AiEmployee from "../models/AiEmployee";
import Lead from "../models/Lead";
import { getIO } from "../socket";

const leadService = new LeadService();

const appointmentKeywords = [
  "call", "consultation", "meeting", "appointment",
  "schedule", "discuss", "talk", "book",
];

async function resolveBusinessBySlug(slug: string | string[] | undefined) {
  const slugStr = Array.isArray(slug) ? slug[0] : slug;
  if (!slugStr) return null;
  return Business.findOne({
    businessName: { $regex: new RegExp(`^${slugStr.replace(/-/g, " ")}$`, "i") },
  }).lean();
}

export const verifyWebhook = async (req: Request, res: Response): Promise<void> => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode !== "subscribe") {
    res.sendStatus(403);
    return;
  }

  // Slug-based webhook URL (per-business) — verify against that business's
  // own saved verify token, falling back to the shared env var if the
  // business hasn't configured its own yet (or there's no slug at all).
  const business = await resolveBusinessBySlug(req.params.businessSlug);
  const expectedToken = business?.whatsappVerifyToken || process.env.WHATSAPP_VERIFY_TOKEN;

  if (expectedToken && token === expectedToken) {
    console.log("✅ Webhook Verified");
    res.status(200).send(challenge);
    return;
  }
  res.sendStatus(403);
};

export const receiveWebhook = async (req: Request, res: Response): Promise<void> => {
  try {
    const entry = req.body?.entry?.[0];
    const change = entry?.changes?.[0];
    const field: string = change?.field ?? "messages";
    const value = change?.value;

    if (!value) {
      res.sendStatus(200);
      return;
    }

    // Ack Meta immediately — processing is async
    res.sendStatus(200);

    const slug = req.params.businessSlug;

    // ── Coexistence: messages echoed from the WhatsApp Business App ──────────
    if (field === "smb_message_echoes") {
      processBusinessAppEcho(value, slug).catch((err) =>
        console.error("smb_message_echoes processing error:", err)
      );
      return;
    }

    // ── Coexistence: chat history sync chunks ─────────────────────────────────
    if (field === "history") {
      processHistoryWebhook(value, slug).catch((err) =>
        console.error("history webhook processing error:", err)
      );
      return;
    }

    // ── Coexistence: contact state sync ───────────────────────────────────────
    if (field === "smb_app_state_sync") {
      processContactsSync(value, slug).catch((err) =>
        console.error("smb_app_state_sync processing error:", err)
      );
      return;
    }

    // ── Account status events (disconnect / reconnect) ────────────────────────
    if (field === "account_update" || value?.account_disconnection_info || value?.disconnection_info) {
      processAccountUpdate(value, slug).catch((err) =>
        console.error("account_update processing error:", err)
      );
      return;
    }

    // ── Standard incoming customer messages ───────────────────────────────────
    if (!value?.messages?.length) {
      return;
    }

    const wamid: string | undefined = value.messages[0].id;

    if (wamid && (await isDuplicateWamid(wamid))) {
      console.log("Duplicate webhook delivery ignored:", wamid);
      return;
    }

    processIncomingMessage(value, slug, wamid).catch((error) => {
      console.error("Webhook processing error:", error);
    });
  } catch (error) {
    console.error("Webhook error:", error);
    res.sendStatus(500);
  }
};

async function processIncomingMessage(
  value: any,
  slug: string | string[] | undefined,
  wamid: string | undefined
): Promise<void> {
  const phone = value.messages[0].from;
  const msgType: string = value.messages[0].type || "text";
  const message: string =
    value.messages[0].text?.body ||
    (msgType !== "text" ? `[${msgType} message]` : "");
  const contactName: string =
    value.contacts?.[0]?.profile?.name || "WhatsApp Prospect";

  if (!phone) return;

  // Resolve businessId: slug → whatsapp number → newest business
  let business = await resolveBusinessBySlug(slug);

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

  if (!business) return;
  const businessId = (business._id as any).toString();
  const waCreds = {
    accessToken: business.whatsappAccessToken,
    phoneNumberId: business.whatsappPhoneNumberId,
  };

  if (message) {
    const savedMsg = await saveMessage(businessId, phone, "incoming", message, wamid);
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

  const history: ChatTurn[] = (await getConversation(businessId, phone))
    .slice(-6)
    .map((m: any) => ({
      role: m.direction === "incoming" ? "user" : "assistant",
      content: m.message,
    }));

  // AI lead intent scoring — fire-and-forget, never blocks the reply path.
  if (lead) {
    const leadId = lead._id.toString();
    scoreLeadIntent(history)
      .then((intent) => {
        if (intent) {
          return Lead.findByIdAndUpdate(leadId, {
            intentTag: intent.tag,
            intentScore: intent.score,
          });
        }
      })
      .catch((err) => console.error("Lead intent scoring failed:", err));
  }

  // ── STEP 2–5 only apply to real text messages ──
  if (!message || msgType !== "text") return;

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
      await sendWhatsAppMessage(phone, confirm, waCreds);
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
    await sendWhatsAppMessage(phone, slotMsg, waCreds);
    return;
  }

  // ── STEP 4: AI reply grounded in the knowledge base, with a rule-based
  //    fallback if the AI call fails (quota, outage, etc.) so the bot
  //    never goes silent. ──
  const activeEmployee = await AiEmployee.findOne({ businessId, isActive: true }).lean();
  const systemPrompt = await buildAISystemPrompt(businessId, activeEmployee as any);
  let reply: string | null = null;

  if (systemPrompt) {
    reply = await generateReply(systemPrompt, message, history);
  }

  if (!reply) {
    reply = await buildKnowledgeBaseReply(businessId, message);
  }

  if (reply) {
    const replySaved = await saveMessage(businessId, phone, "outgoing", reply);
    try { getIO().to(`business:${businessId}`).emit("new:message", { businessId, phone, message: replySaved }); } catch {}
    await sendWhatsAppMessage(phone, reply, waCreds);
    return;
  }
  console.error(`No KnowledgeBase found for businessId=${businessId}, falling back.`);

  // ── STEP 5: Fallback ──
  const fallback = `Thank you for reaching out! Our team will get back to you shortly. Reply "BOOK" to schedule a free consultation.`;
  const fallbackSaved = await saveMessage(businessId, phone, "outgoing", fallback);
  try { getIO().to(`business:${businessId}`).emit("new:message", { businessId, phone, message: fallbackSaved }); } catch {}
  await sendWhatsAppMessage(phone, fallback, waCreds);
}

// ── Coexistence: messages sent from the WhatsApp Business App ───────────────
// Mirror these to the inbox as outgoing messages. AI must not reply since
// a human agent already replied from the mobile app.
async function processBusinessAppEcho(
  value: any,
  slug: string | string[] | undefined
): Promise<void> {
  if (!value?.messages?.length) return;

  const message = value.messages[0];
  // Echo messages have the business number as `from`; the recipient is `to`
  const customerPhone: string | undefined = message.to ?? value.contacts?.[0]?.wa_id;
  const text: string =
    message.text?.body || (message.type !== "text" ? `[${message.type} message]` : "");

  if (!customerPhone || !text) return;

  let business = await resolveBusinessBySlug(slug);
  if (!business) {
    const displayPhone: string | undefined = value.metadata?.display_phone_number;
    if (displayPhone) {
      const digits = displayPhone.replace(/\D/g, "");
      const candidates = await Business.find().lean();
      business = candidates.find((b) => b.whatsappNumber.replace(/\D/g, "") === digits) ?? null;
    }
  }
  if (!business) return;

  const businessId = (business._id as any).toString();
  const savedMsg = await saveMessage(businessId, customerPhone, "outgoing", text, message.id);

  try {
    getIO().to(`business:${businessId}`).emit("new:message", {
      businessId,
      phone: customerPhone,
      message: savedMsg,
      source: "business_app",
    });
  } catch { /* socket not ready */ }
}

// ── Coexistence: chat history sync webhook ────────────────────────────────────
// Meta delivers history in chunks with a progress percentage. When progress
// reaches 100% (or no more chunks arrive), mark history as imported.
async function processHistoryWebhook(
  value: any,
  slug: string | string[] | undefined
): Promise<void> {
  let business = await resolveBusinessBySlug(slug);
  if (!business) {
    const displayPhone: string | undefined = value?.metadata?.display_phone_number;
    if (displayPhone) {
      const digits = displayPhone.replace(/\D/g, "");
      const candidates = await Business.find().lean();
      business = candidates.find((b) => b.whatsappNumber.replace(/\D/g, "") === digits) ?? null;
    }
  }
  if (!business) return;

  const businessId = (business._id as any).toString();
  const progress: number = value?.progress ?? 0;

  // Save each historical message chunk to the inbox
  const messages: any[] = value?.messages ?? [];
  for (const msg of messages) {
    const phone: string | undefined = msg.from || msg.to;
    const direction = msg.from === business.whatsappNumber?.replace(/\D/g, "") ? "outgoing" : "incoming";
    const text: string = msg.text?.body || (msg.type !== "text" ? `[${msg.type}]` : "");
    if (phone && text) {
      await saveMessage(businessId, phone, direction, text, msg.id).catch(() => {});
    }
  }

  if (progress >= 100) {
    await Business.findByIdAndUpdate(businessId, {
      historyImported: true,
      coexistenceStatus: "connected",
      lastSyncAt: new Date(),
    });
    console.log(`✅ History import complete for business ${businessId}`);
  }
}

// ── Coexistence: contact state sync webhook ───────────────────────────────────
// Updates the contactsSynced flag once we receive the initial state sync.
async function processContactsSync(
  value: any,
  slug: string | string[] | undefined
): Promise<void> {
  let business = await resolveBusinessBySlug(slug);
  if (!business) {
    const displayPhone: string | undefined = value?.metadata?.display_phone_number;
    if (displayPhone) {
      const digits = displayPhone.replace(/\D/g, "");
      const candidates = await Business.find().lean();
      business = candidates.find((b) => b.whatsappNumber.replace(/\D/g, "") === digits) ?? null;
    }
  }
  if (!business) return;

  const businessId = (business._id as any).toString();
  await Business.findByIdAndUpdate(businessId, {
    contactsSynced: true,
    coexistenceStatus: "connected",
    lastSyncAt: new Date(),
  });
}

// ── Account update: disconnect / reconnect ────────────────────────────────────
async function processAccountUpdate(
  value: any,
  slug: string | string[] | undefined
): Promise<void> {
  let business = await resolveBusinessBySlug(slug);
  if (!business) {
    const displayPhone: string | undefined = value?.metadata?.display_phone_number;
    if (displayPhone) {
      const digits = displayPhone.replace(/\D/g, "");
      const candidates = await Business.find().lean();
      business = candidates.find((b) => b.whatsappNumber.replace(/\D/g, "") === digits) ?? null;
    }
  }
  if (!business) return;

  const businessId = (business._id as any).toString();
  const disconnectionInfo = value?.disconnection_info ?? value?.account_disconnection_info;

  if (disconnectionInfo) {
    const reason: string = disconnectionInfo.reason ?? "UNKNOWN";
    await Business.findByIdAndUpdate(businessId, {
      coexistenceStatus: "disconnected",
      disconnectReason: reason,
    });
    console.warn(`⚠️  Business ${businessId} coexistence disconnected: ${reason}`);
  } else if (value?.event === "ACCOUNT_RECONNECTED") {
    await Business.findByIdAndUpdate(businessId, {
      coexistenceStatus: "connected",
      disconnectReason: null,
    });
    console.log(`✅ Business ${businessId} coexistence reconnected`);
  }
}
