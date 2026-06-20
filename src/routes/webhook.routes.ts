import { Router } from "express";

import {
  verifyWebhook,
  receiveWebhook,
} from "../controllers/webhook.controller";

const router = Router();

// Base route (no slug) — use this URL in Meta Developer Console
router.get("/", verifyWebhook);
router.post("/", receiveWebhook);

// Slug-based routes (legacy / multi-tenant)
router.get("/:businessSlug", verifyWebhook);
router.post("/:businessSlug", receiveWebhook);

export default router;