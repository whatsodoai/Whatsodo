import KnowledgeBase from "../models/KnowledgeBase";
import { IAiEmployee } from "../models/AiEmployee";

export const createKnowledgeBase = async (data: any) => {
  const { businessId, ...rest } = data;
  return await KnowledgeBase.findOneAndUpdate(
    { businessId },
    { $set: rest },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
};

export const getKnowledgeBase = async (businessId: string) => {
  return await KnowledgeBase.findOne({ businessId });
};

export const getKnowledgeBaseByBusiness = async (businessId: string) => {
  return await KnowledgeBase.findOne({ businessId });
};

const STOPWORDS = new Set([
  "a", "an", "the", "is", "are", "do", "does", "i", "you", "your", "my",
  "what", "how", "can", "to", "of", "for", "in", "on", "and", "or", "it",
]);

function keywords(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 2 && !STOPWORDS.has(w))
  );
}

/**
 * Builds a reply straight from the stored KnowledgeBase, without calling
 * any LLM. Tries to match the incoming message against FAQ questions by
 * keyword overlap; otherwise falls back to a company intro built from
 * companyDescription/services/offers.
 */
export const buildKnowledgeBaseReply = async (
  businessId: string,
  userMessage: string
): Promise<string | null> => {
  const kb = await getKnowledgeBaseByBusiness(businessId);
  if (!kb) return null;

  const userWords = keywords(userMessage);

  if (kb.faqs?.length && userWords.size) {
    let bestFaq: { question: string; answer: string } | null = null;
    let bestScore = 0;
    for (const faq of kb.faqs) {
      if (!faq.question || !faq.answer) continue;
      const faqWords = keywords(faq.question);
      let score = 0;
      for (const w of faqWords) if (userWords.has(w)) score++;
      if (score > bestScore) {
        bestScore = score;
        bestFaq = faq;
      }
    }
    if (bestFaq && bestScore > 0) {
      return bestFaq.answer;
    }
  }

  const asksAboutServices = ["service", "services", "offer", "offers", "price", "pricing", "cost", "package"]
    .some((w) => userWords.has(w));

  if (asksAboutServices) {
    const lines: string[] = [`Hi! Here's what ${kb.companyName} offers:`];
    if (kb.services?.length) {
      lines.push(kb.services.slice(0, 5).map((s) => `• ${s}`).join("\n"));
    }
    if (kb.offers?.length) {
      lines.push(`\nCurrent offers:\n${kb.offers.slice(0, 3).map((o) => `• ${o}`).join("\n")}`);
    }
    lines.push(`\nReply "BOOK" to schedule a free consultation.`);
    return lines.join("\n");
  }

  // Generic greeting / unmatched message — short intro, not a full KB dump.
  const shortDescription = kb.companyDescription
    ? kb.companyDescription.split(/(?<=[.!?])\s/)[0]
    : "";

  return [
    `Hi! This is ${kb.companyName}.${shortDescription ? " " + shortDescription : ""}`,
    `What can we help you with — our services, pricing, or booking a consultation? Reply "BOOK" anytime to schedule one.`,
  ].join("\n");
};

/**
 * System prompt for the LLM, grounded in this business's KnowledgeBase.
 * Optionally incorporates an AI Employee's persona, role, and instructions.
 * Kept under WhatsApp's 4096-char message limit — sendWhatsAppMessage also truncates.
 */
export const buildAISystemPrompt = async (
  businessId: string,
  aiEmployee?: IAiEmployee | null
): Promise<string | null> => {
  const kb = await getKnowledgeBaseByBusiness(businessId);
  if (!kb) return null;

  const employeeName = aiEmployee?.name || "Assistant";
  const employeeRole = aiEmployee?.role || "AI Customer Support Executive";
  const personality = aiEmployee?.personality || "Professional and friendly";
  const language = aiEmployee?.language || "English";
  const workingInstructions = aiEmployee?.workingInstructions?.trim() || "";
  const escalationRules = aiEmployee?.escalationRules?.trim() || "";
  const responsibilities = aiEmployee?.responsibilities?.length
    ? aiEmployee.responsibilities.map((r) => `• ${r}`).join("\n")
    : "";

  return `
You are ${employeeName}, ${employeeRole} for ${kb.companyName}.

Personality: ${personality}
Primary language: ${language}
${responsibilities ? `\nYour responsibilities:\n${responsibilities}` : ""}

About the business: ${kb.companyDescription}

Services: ${kb.services?.join(", ")}

FAQs:
${kb.faqs?.map((f) => `Q: ${f.question}\nA: ${f.answer}`).join("\n\n")}

Sales instructions: ${kb.salesInstructions}
Appointment instructions: ${kb.appointmentInstructions}
Tone: ${kb.tone || personality}

Offers: ${kb.offers?.join(", ")}
Objection handling: ${kb.objectionHandling?.map((o) => `If "${o.objection}" → "${o.response}"`).join("; ")}
${workingInstructions ? `\nAdditional working instructions:\n${workingInstructions}` : ""}
${escalationRules ? `\nEscalation rules:\n${escalationRules}` : ""}

Rules:
- You are ${employeeName}. Always introduce yourself by name if asked.
- Reply in the same language the customer uses (default: ${language}).
- Keep replies under 300 characters — this is WhatsApp, not email.
- Only answer using the information above. If you don't know something, say you'll connect them with the team — never invent facts about the business.
- If the customer wants to book or consult, ask them to reply "BOOK".
`.trim();
};
