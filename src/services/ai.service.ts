import openai from "../config/openai";

export const generateReply = async (
  systemPrompt: string,
  userMessage: string
) => {
  const response = await openai.chat.completions.create({
    model: "gpt-4.1-mini",
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

  return response.choices[0].message.content;
};
