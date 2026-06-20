import { Router } from "express";
import { upload } from "../controllers/upload.controller";
import { uploadSingleFile } from "../middleware/upload.middleware";
import { protect } from "../middleware/auth.middleware";

const router = Router();

router.post("/", protect, uploadSingleFile, upload);

export default router;
