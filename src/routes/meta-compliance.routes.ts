import { Router } from "express";
import {
  deauthorizeCallback,
  dataDeletionCallback,
  getAppConfig,
} from "../controllers/meta-compliance.controller";

const router = Router();

router.get("/app-config", getAppConfig);
router.post("/deauthorize", deauthorizeCallback);
router.post("/data-deletion", dataDeletionCallback);

export default router;
