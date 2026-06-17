import { Router } from "express";
import { getSlots } from "../controllers/slot.controller";
import { protect } from "../middleware/auth.middleware";

const router = Router();

router.get(
  "/:businessId/:date",
  protect,
  getSlots
);

export default router;