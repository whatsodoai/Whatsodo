import { Router } from "express";
import { create, getAll } from "../controllers/business.controller";
import { protect } from "../middleware/auth.middleware";

const router = Router();

router.post("/", protect, create);
router.get("/", protect, getAll);

export default router;
