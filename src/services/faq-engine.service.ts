import KnowledgeBase from "../models/KnowledgeBase";

export class FAQEngineService {
  async findAnswer(
    businessId: string,
    userMessage: string
  ): Promise<string | null> {
    const kb = await KnowledgeBase.findOne({ businessId });

    if (!kb) return null;

    const message = userMessage.toLowerCase();

    for (const faq of kb.faqs) {
      const question = faq.question.toLowerCase();
      const words = question.split(" ");
      const matched = words.some(
        (word) => word.length > 3 && message.includes(word)
      );
      if (matched) {
        return `${faq.answer}\n\n${kb.callToActions?.[0] || ""}`.trim();
      }
    }

    return null;
  }
}

export const findBestAnswer = async (
  businessId: string,
  userMessage: string
) => {
  const kb = await KnowledgeBase.findOne({
    businessId,
  });

  if (!kb) {
    return "Sorry, I couldn't find business information.";
  }

  const message = userMessage.toLowerCase();

  for (const faq of kb.faqs) {
    const question = faq.question.toLowerCase();

    const words = question.split(" ");

    const matched = words.some(
      (word) =>
        word.length > 3 &&
        message.includes(word)
    );

    if (matched) {
      return `${faq.answer}

${kb.callToActions?.[0] || ""}`.trim();
    }
  }

  return `Thank you for contacting ${kb.companyName}.

Could you please provide more details so I can assist you better?

${kb.callToActions?.[0] || ""}`.trim();
};
