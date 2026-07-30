import { Router } from "express";
import { protectRoute } from "../middleware/auth.middleware.js";
import {
  logCallRecord,
  getMyCallLogs,
  getAdminStats,
  toggleUserRole,
  deleteUserByAdmin,
} from "../controllers/call.controller.js";

const callRouter = Router();

callRouter.post("/log", protectRoute, logCallRecord);
callRouter.get("/history", protectRoute, getMyCallLogs);

// Admin-only metrics and controls
callRouter.get("/admin/stats", protectRoute, getAdminStats);
callRouter.put("/admin/users/:userId/role", protectRoute, toggleUserRole);
callRouter.delete("/admin/users/:userId", protectRoute, deleteUserByAdmin);

export default callRouter;
