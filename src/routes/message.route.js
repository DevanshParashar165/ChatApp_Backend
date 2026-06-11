import { Router } from "express";
import { protectRoute } from "../middleware/auth.middleware.js";
import { validate } from "../middleware/validate.js";
import { messageLimiter } from "../middleware/rateLimiter.js";
import {
  paginationSchema,
  searchSchema,
  sendMessageSchema,
  editMessageSchema,
} from "../validators/schemas.js";
import {
  getMessages,
  getUserForSidebar,
  markMessageAsSeen,
  sendMessage,
  searchMessages,
  editMessage,
  deleteMessage,
} from "../controllers/message.controller.js";

const messageRouter = Router();

messageRouter.get("/users", protectRoute, getUserForSidebar);
messageRouter.get(
  "/search",
  protectRoute,
  validate(searchSchema),
  searchMessages
);
messageRouter.get(
  "/:id",
  protectRoute,
  validate(paginationSchema),
  getMessages
);
messageRouter.put("/mark/:id", protectRoute, markMessageAsSeen);
messageRouter.put(
  "/:messageId",
  protectRoute,
  validate(editMessageSchema),
  editMessage
);
messageRouter.delete("/:messageId", protectRoute, deleteMessage);
messageRouter.post(
  "/send/:id",
  protectRoute,
  messageLimiter,
  validate(sendMessageSchema),
  sendMessage
);

export default messageRouter;
