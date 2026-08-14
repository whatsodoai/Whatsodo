import { Router } from "express";
import {
  create,
  getAll,
  getOne,
  update,
  getWhatsAppDefaults,
  connectWhatsAppEmbedded,
  getConnectionHealth,
  checkTokenHealth,
  triggerContactsSync,
  triggerHistorySync,
  addMember,
  removeMember,
  addTemplate,
  addCarouselTemplate,
  removeTemplate,
} from "../controllers/business.controller";
import { protect } from "../middleware/auth.middleware";

const router = Router();

router.post("/", protect, create);
router.get("/", protect, getAll);
router.get("/whatsapp-defaults", protect, getWhatsAppDefaults);
router.get("/:id", protect, getOne);
router.patch("/:id", protect, update);
router.post("/:id/whatsapp/connect", protect, connectWhatsAppEmbedded);
router.get("/:id/whatsapp/health", protect, getConnectionHealth);
router.get("/:id/whatsapp/token-health", protect, checkTokenHealth);
router.post("/:id/whatsapp/sync-contacts", protect, triggerContactsSync);
router.post("/:id/whatsapp/sync-history", protect, triggerHistorySync);
router.post("/:id/members", protect, addMember);
router.delete("/:id/members/:userId", protect, removeMember);
router.post("/:id/templates", protect, addTemplate);
router.post("/:id/templates/carousel", protect, addCarouselTemplate);
router.delete("/:id/templates/:templateName", protect, removeTemplate);

export default router;
