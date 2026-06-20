import { Router } from "express";
import { getAnalytics } from "../controllers/analytics.controller";
import { protect } from "../middleware/auth.middleware";

const router = Router();

router.get("/:businessId", protect, getAnalytics);

export default router;
