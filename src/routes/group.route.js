import { Router } from "express";
import { protectRoute } from "../middleware/auth.middleware.js";
import {
  createGroup,
  joinGroup,
  getGroupMembers,
  leaveGroup,
  removeGroupMember,
  changeMemberRole,
  getMyGroups,
} from "../controllers/group.controller.js";

const groupRouter = Router();

groupRouter.get("/my", protectRoute, getMyGroups);
groupRouter.post("/create", protectRoute, createGroup);
groupRouter.post("/join/:inviteCode", protectRoute, joinGroup);
groupRouter.get("/:groupId/members", protectRoute, getGroupMembers);
groupRouter.post("/:groupId/leave", protectRoute, leaveGroup);
groupRouter.delete("/:groupId/remove", protectRoute, removeGroupMember);
groupRouter.put("/:groupId/role", protectRoute, changeMemberRole);

export default groupRouter;
