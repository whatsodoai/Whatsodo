import { Router } from "express";
import { create, getAll, update, getWhatsAppDefaults } from "../controllers/business.controller";
import { protect } from "../middleware/auth.middleware";

const router = Router();

router.post("/", protect, create);
router.get("/", protect, getAll);
router.get("/whatsapp-defaults", protect, getWhatsAppDefaults);
router.patch("/:id", protect, update);

export default router;
