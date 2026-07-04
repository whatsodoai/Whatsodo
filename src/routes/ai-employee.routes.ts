import { Router } from "express";
import { protect } from "../middleware/auth.middleware";
import {
  listAiEmployees,
  createAiEmployee,
  updateAiEmployee,
  deleteAiEmployee,
  activateAiEmployee,
  deactivateAiEmployee,
} from "../controllers/ai-employee.controller";

const router = Router();

router.use(protect);

router.get("/:businessId", listAiEmployees);
router.post("/", createAiEmployee);
router.put("/:id", updateAiEmployee);
router.delete("/:id", deleteAiEmployee);
router.put("/:id/activate", activateAiEmployee);
router.put("/:id/deactivate", deactivateAiEmployee);

export default router;
