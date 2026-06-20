import OpenAI from "openai";

if (!process.env.OPENAI_API_KEY) {
  console.error("⚠️  OPENAI_API_KEY is not set — AI replies will fail.");
}

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export default openai;
