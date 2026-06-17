import { Router } from "express";
import { chat } from "../controllers/ai.controller";
import { protect } from "../middleware/auth.middleware";

const router = Router();

router.post(
"/chat",
protect,
chat
);

export default router;
