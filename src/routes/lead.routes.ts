import { Router } from "express";
import {
  create,
  getAll,
  updateStatus,
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
  protect,
  getAll
);

router.patch(
  "/:leadId/status",
  protect,
  updateStatus
);

export default router;
