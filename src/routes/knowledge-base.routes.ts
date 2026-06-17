import { Router } from "express";
import {
create,
getByBusiness,
} from "../controllers/knowledge-base.controller";

import { protect } from "../middleware/auth.middleware";

const router = Router();

router.post("/", protect, create);

router.get(
"/:businessId",
protect,
getByBusiness
);

export default router;
