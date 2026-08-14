import { Router } from "express";

import {
  verifyWebhook,
  receiveWebhook,
  getWebhookEvents,
} from "../controllers/webhook.controller";
import { protect } from "../middleware/auth.middleware";

const router = Router();

// Live event log — authenticated, for the webhook debugger in Settings
router.get("/events", protect, getWebhookEvents);

// Base route (no slug) — use this URL in Meta Developer Console
router.get("/", verifyWebhook);
router.post("/", receiveWebhook);

// Slug-based routes (legacy / multi-tenant)
router.get("/:businessSlug", verifyWebhook);
router.post("/:businessSlug", receiveWebhook);

export default router;