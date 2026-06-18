import { Router } from "express";
import { conversation } from "../controllers/message.controller";

const router = Router();

router.get("/:businessId/:phone", conversation);

export default router;
