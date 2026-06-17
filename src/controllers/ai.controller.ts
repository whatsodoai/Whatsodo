import { Request, Response } from "express";
import { getKnowledgeBaseByBusiness } from "../services/knowledge-base.service";
import { generateReply } from "../services/ai.service";

export const chat = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { businessId, message } = req.body;

    const kb = await getKnowledgeBaseByBusiness(businessId);

    if (!kb) {
      res.status(404).json({
        success: false,
        message: "Knowledge Base not found",
      });
      return;
    }

    const systemPrompt = `
Company: ${kb.companyName}

Description:
${kb.companyDescription}

Services:
${kb.services.join(", ")}

FAQs:
${JSON.stringify(kb.faqs)}

Sales Instructions:
${kb.salesInstructions}

Appointment Instructions:
${kb.appointmentInstructions}

Tone:
${kb.tone}

Lead Qualification:
${kb.leadQualificationQuestions?.join(", ")}

Offers:
${kb.offers?.join(", ")}

Always answer using the company knowledge.
If you don't know something, ask a clarifying question.
`;

    const reply = await generateReply(systemPrompt, message);

    res.status(200).json({
      success: true,
      reply,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : "AI chat failed",
    });
  }
};
