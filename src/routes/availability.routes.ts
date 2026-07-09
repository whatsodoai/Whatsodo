import { Router } from "express";
import { create, getAll, deleteDay } from "../controllers/availability.controller";
import { protect } from "../middleware/auth.middleware";

const router = Router();

router.post("/", protect, create);
router.get("/:businessId", protect, getAll);
router.delete("/:businessId/:day", protect, deleteDay);

export default router;
