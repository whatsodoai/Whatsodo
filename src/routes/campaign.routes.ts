import { Router } from "express";
import { create, getAll, getOne } from "../controllers/campaign.controller";
import { protect } from "../middleware/auth.middleware";

const router = Router();

router.post("/", protect, create);
router.get("/:businessId", protect, getAll);
router.get("/:businessId/:campaignId", protect, getOne);

export default router;
