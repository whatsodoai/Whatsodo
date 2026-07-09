import { Response } from "express";
import { toFile } from "openai";
import openai from "../config/openai";
import { AuthRequest } from "../middleware/auth.middleware";
import { getKnowledgeBaseByBusiness } from "../services/knowledge-base.service";
import { generateReply, ChatTurn } from "../services/ai.service";

export const voiceChat = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    if (!req.file) {
      res.status(400).json({ success: false, message: "Audio file is required" });
      return;
    }

    const { businessId, history } = req.body;

    if (!businessId) {
      res.status(400).json({ success: false, message: "businessId is required" });
      return;
    }

    const filename = req.file.originalname || "audio.webm";
    const audioFile = await toFile(req.file.buffer, filename, { type: req.file.mimetype });

    const transcription = await openai.audio.transcriptions.create({
      file: audioFile,
      model: "whisper-1",
      response_format: "text",
    });

    const transcript = typeof transcription === "string" ? transcription : (transcription as any).text ?? "";

    if (!transcript.trim()) {
      res.status(200).json({ success: true, transcript: "", reply: "I couldn't hear anything. Please try again." });
      return;
    }

    const kb = await getKnowledgeBaseByBusiness(businessId);

    let systemPrompt = "You are a helpful AI assistant. Answer clearly and concisely.";
    if (kb) {
      systemPrompt = `
You are a helpful AI assistant for ${kb.companyName}.

Company Description:
${kb.companyDescription}

Services:
${kb.services?.join(", ")}

FAQs:
${JSON.stringify(kb.faqs)}

Sales Instructions:
${kb.salesInstructions}

Tone:
${kb.tone}

Answer using the company knowledge. If you don't know something, ask a clarifying question.
`.trim();
    }

    let chatHistory: ChatTurn[] = [];
    if (history) {
      try {
        chatHistory = JSON.parse(history);
      } catch {
        chatHistory = [];
      }
    }

    const reply = await generateReply(systemPrompt, transcript, chatHistory);

    res.status(200).json({
      success: true,
      transcript,
      reply: reply ?? "I'm sorry, I couldn't generate a response. Please try again.",
    });
  } catch (error) {
    console.error("Voice chat error:", error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : "Voice processing failed",
    });
  }
};
