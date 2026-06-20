import { Router } from "express";
import {
  create,
  getAll,
  getOne,
  update,
  getWhatsAppDefaults,
  addMember,
  removeMember,
} from "../controllers/business.controller";
import { protect } from "../middleware/auth.middleware";

const router = Router();

router.post("/", protect, create);
router.get("/", protect, getAll);
router.get("/whatsapp-defaults", protect, getWhatsAppDefaults);
router.get("/:id", protect, getOne);
router.patch("/:id", protect, update);
router.post("/:id/members", protect, addMember);
router.delete("/:id/members/:userId", protect, removeMember);

export default router;
