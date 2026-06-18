import express from "express";
import cors from "cors";
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
