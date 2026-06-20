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
