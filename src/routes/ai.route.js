import { Router } from "express";
import { protectRoute } from "../middleware/auth.middleware.js";
import { handleAIAction } from "../controllers/ai.controller.js";

const aiRouter = Router();

aiRouter.post("/action", protectRoute, handleAIAction);

export default aiRouter;
