import { Router } from "express";
import { getSummary } from "../controllers/dashboard.controller";

const router = Router();

router.get(
  "/summary/:businessId",
  getSummary
);

export default router;