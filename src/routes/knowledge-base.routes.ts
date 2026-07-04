import { Router } from "express";
import multer from "multer";
import { create, getByBusiness, extractPdf, extractWebsite } from "../controllers/knowledge-base.controller";
import { protect } from "../middleware/auth.middleware";

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

router.post("/", protect, create);
router.get("/:businessId", protect, getByBusiness);
router.post("/extract/pdf", protect, upload.single("file"), extractPdf);
router.post("/extract/website", protect, extractWebsite);

export default router;
