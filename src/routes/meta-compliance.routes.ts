import { Router } from "express";
import {
  deauthorizeCallback,
  dataDeletionCallback,
} from "../controllers/meta-compliance.controller";

const router = Router();

router.post("/deauthorize", deauthorizeCallback);
router.post("/data-deletion", dataDeletionCallback);

export default router;
