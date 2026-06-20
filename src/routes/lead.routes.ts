import { Router } from "express";
import {
  create,
  getAll,
  search,
  updateStatus,
  updateLead,
  deleteLead,
  cleanupDuplicates,
} from "../controllers/lead.controller";

import { protect } from "../middleware/auth.middleware";

const router = Router();

router.post(
"/",
protect,
create
);

// /search must be before /:businessId to avoid route collision
router.get("/search", protect, search);

router.get(
  "/:businessId",
  protect,
  getAll
);

router.patch(
  "/:leadId/status",
  protect,
  updateStatus
);

router.patch(
  "/:id",
  protect,
  updateLead
);

router.delete(
  "/cleanup/duplicates",
  cleanupDuplicates
);

router.delete(
  "/:id",
  protect,
  deleteLead
);

export default router;
