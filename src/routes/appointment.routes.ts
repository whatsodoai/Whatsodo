import { Router } from "express";
import {
  create,
  getAll,
  clearAppointments,
} from "../controllers/appointment.controller";

import { protect } from "../middleware/auth.middleware";

const router = Router();

router.post(
"/",
protect,
create
);

router.get(
  "/:businessId",
  getAll
);

router.delete(
  "/clear",
  protect,
  clearAppointments
);

export default router;
