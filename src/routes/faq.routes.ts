import { Router } from "express";
import { chat } from "../controllers/faq.controller";
import { protect } from "../middleware/auth.middleware";

const router = Router();

router.post(
"/chat",
protect,
chat
);

export default router;
