import { Router } from "express";
import multer from "multer";
import { voiceChat } from "../controllers/voice.controller";
import { protect } from "../middleware/auth.middleware";

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } });

router.post("/chat", protect, upload.single("audio"), voiceChat);

export default router;
