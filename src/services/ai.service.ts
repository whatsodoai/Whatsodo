import openai from "../config/openai";

export const generateReply = async (
  systemPrompt: string,
  userMessage: string
): Promise<string | null> => {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: systemPrompt,
        },
        {
          role: "user",
          content: userMessage,
        },
      ],
      temperature: 0.7,
    });

    return response.choices[0].message.content ?? null;
  } catch (error: any) {
    console.error("OpenAI generateReply failed:", error?.response?.data || error.message || error);
    return null;
  }
};
