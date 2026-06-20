import openai from "../config/openai";

export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

export const generateReply = async (
  systemPrompt: string,
  userMessage: string,
  history: ChatTurn[] = []
): Promise<string | null> => {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        ...history,
        { role: "user", content: userMessage },
      ],
      temperature: 0.7,
      max_tokens: 400,
    });

    return response.choices[0].message.content ?? null;
  } catch (error: any) {
    console.error("OpenAI generateReply failed:", error?.response?.data || error.message || error);
    return null;
  }
};

export interface LeadIntent {
  tag: "hot" | "warm" | "cold";
  score: number;
}

/**
 * Classifies a lead's buying intent from their conversation so far.
 * Never throws — returns null on any failure so callers can skip the
 * update instead of crashing the (fire-and-forget) caller.
 */
export const scoreLeadIntent = async (history: ChatTurn[]): Promise<LeadIntent | null> => {
  if (history.length === 0) return null;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            'Classify this WhatsApp sales conversation\'s buying intent. Respond with ONLY a JSON object: {"tag": "hot"|"warm"|"cold", "score": 0-100}. "hot" = ready to buy/book now, "warm" = interested but not urgent, "cold" = just browsing or unresponsive.',
        },
        ...history,
      ],
      temperature: 0,
      max_tokens: 50,
      response_format: { type: "json_object" },
    });

    const content = response.choices[0].message.content;
    if (!content) return null;

    const parsed = JSON.parse(content);
    if (!["hot", "warm", "cold"].includes(parsed.tag)) return null;

    return { tag: parsed.tag, score: Number(parsed.score) || 0 };
  } catch (error: any) {
    console.error("OpenAI scoreLeadIntent failed:", error?.response?.data || error.message || error);
    return null;
  }
};
