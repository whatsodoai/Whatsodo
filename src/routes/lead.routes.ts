import { Router } from "express";
import {
  create,
  getAll,
  updateStatus,
  cleanupDuplicates,
} from "../controllers/lead.controller";

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

router.patch(
  "/:leadId/status",
  protect,
  updateStatus
);

router.delete(
  "/cleanup/duplicates",
  cleanupDuplicates
);

export default router;
