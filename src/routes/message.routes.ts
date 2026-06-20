import { Router } from "express";
import { conversation, sendManual, markRead } from "../controllers/message.controller";
import { protect } from "../middleware/auth.middleware";

const router = Router();

router.get("/:businessId/:phone", protect, conversation);
router.post("/send", protect, sendManual);
router.patch("/read/:phone", protect, markRead);

export default router;
