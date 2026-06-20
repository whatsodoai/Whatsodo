import { Router } from "express";
import { getSummary } from "../controllers/dashboard.controller";
import { protect } from "../middleware/auth.middleware";

const router = Router();

router.get(
  "/summary/:businessId",
  protect,
  getSummary
);

export default router;