import { Router } from "express";
import {
create,
getAll,
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
protect,
getAll
);

export default router;
