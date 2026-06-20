import { Router } from "express";
import {
  create,
  getAll,
  getCalendar,
  updateStatus,
} from "../controllers/appointment.controller";

import { protect } from "../middleware/auth.middleware";
import { verifyBusinessOwnership } from "../middleware/business-ownership.middleware";

const router = Router();

router.post("/", protect, create);
router.get("/calendar/:businessId", protect, verifyBusinessOwnership, getCalendar);
router.get("/:businessId", protect, verifyBusinessOwnership, getAll);
router.patch("/:id", protect, updateStatus);

export default router;
