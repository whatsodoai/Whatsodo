import { Router } from "express";
import {
  create,
  getAll,
  search,
  updateStatus,
  updateLead,
  deleteLead,
} from "../controllers/lead.controller";

import { protect } from "../middleware/auth.middleware";
import { verifyBusinessOwnership } from "../middleware/business-ownership.middleware";

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
  verifyBusinessOwnership,
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
  "/:id",
  protect,
  deleteLead
);

export default router;
