import { Router } from "express";
import {
  create,
  getAll,
  getCalendar,
  clearAppointments,
  updateStatus,
} from "../controllers/appointment.controller";

import { protect } from "../middleware/auth.middleware";

const router = Router();

router.post("/", protect, create);
router.get("/calendar/:businessId", protect, getCalendar);
router.get("/:businessId", getAll);
router.patch("/:id", protect, updateStatus);
router.delete("/clear", protect, clearAppointments);

export default router;
