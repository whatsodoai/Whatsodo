import express from "express";
import cors from "cors";
import { sendWhatsAppMessage } from "./services/whatsapp.service";
import authRoutes from "./routes/auth.routes";
import businessRoutes from "./routes/business.routes";
import knowledgeBaseRoutes from "./routes/knowledge-base.routes";
import aiRoutes from "./routes/ai.routes";
import faqRoutes from "./routes/faq.routes";
import leadRoutes from "./routes/lead.routes";
import appointmentRoutes from "./routes/appointment.routes";
import availabilityRoutes from "./routes/availability.routes";
import slotRoutes from "./routes/slot.routes";
import webhookRoutes from "./routes/webhook.routes";
import testWhatsappRoutes from "./routes/test-whatsapp.routes";
import dashboardRoutes from "./routes/dashboard.routes";
import messageRoutes from "./routes/message.routes";
import inboxRoutes from "./routes/inbox.routes";
import analyticsRoutes from "./routes/analytics.routes";
import campaignRoutes from "./routes/campaign.routes";

const app = express();

app.use(cors());
app.use(express.json());
app.use("/api/auth", authRoutes);
app.use("/api/business", businessRoutes);
app.use("/api/knowledge-base", knowledgeBaseRoutes);
app.use("/api/ai", aiRoutes);
app.use("/api/faq", faqRoutes);
app.use("/api/leads", leadRoutes);
app.use("/api/appointments", appointmentRoutes);
app.use("/api/availability", availabilityRoutes);
app.use("/api/slots", slotRoutes);
app.use("/api/webhook", webhookRoutes);
app.use("/api/test-whatsapp", testWhatsappRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/messages", messageRoutes);
app.use("/api/inbox", inboxRoutes);
app.use("/api/analytics", analyticsRoutes);
app.use("/api/campaigns", campaignRoutes);

app.get("/test-whatsapp", async (_req, res) => {
  try {
    const result = await sendWhatsAppMessage(
      "919994770192",
      "Whatsodo test message"
    );

    res.json(result);
  } catch (error: any) {
    console.log(error?.response?.data || error);
    res.status(500).json(error?.response?.data || error);
  }
});

app.get("/", (_req, res) => {
  res.status(200).json({
    success: true,
    message: "Whatsodo API Running",
  });
});

app.get("/api/health", (_req, res) => {
  res.status(200).json({
    success: true,
    message: "Whatsodo API Running",
  });
});

export default app;
