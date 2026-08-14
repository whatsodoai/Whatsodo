import { Router } from "express";
import {
  register,
  login,
  getProfile,
  updateProfile,
} from "../controllers/auth.controller";
import { protect } from "../middleware/auth.middleware";

const router = Router();

router.post("/register", register);
router.post("/login", login);
router.get("/profile", protect, getProfile);
router.put("/profile", protect, updateProfile);

export default router;
