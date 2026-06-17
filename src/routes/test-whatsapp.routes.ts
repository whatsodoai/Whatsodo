import { Router } from "express";
import { sendTestMessage } from "../controllers/test-whatsapp.controller";
import { protect } from "../middleware/auth.middleware";

const router = Router();

router.post(
  "/send",
  protect,
  sendTestMessage
);

export default router;