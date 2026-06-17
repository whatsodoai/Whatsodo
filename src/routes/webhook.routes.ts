import { Router } from "express";

import {
  verifyWebhook,
  receiveWebhook,
} from "../controllers/webhook.controller";

const router = Router();

router.get(
  "/:businessSlug",
  verifyWebhook
);

router.post(
  "/:businessSlug",
  receiveWebhook
);

export default router;