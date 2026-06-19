import { Router } from "express";
import { getInbox } from "../controllers/inbox.controller";

const router = Router();

router.get("/:businessId", getInbox);

export default router;
