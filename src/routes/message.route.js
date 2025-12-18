import { Router } from "express";
import { protectRoute } from "../middleware/auth.middleware.js";
import { getMessages, getUserForSidebar, markMessageAsSeen, sendMessage } from "../controllers/message.controller.js";

const messageRouter = Router()

messageRouter.get('/users',protectRoute,getUserForSidebar)
messageRouter.get('/:id',protectRoute,getMessages)
messageRouter.put('/mark/:id',protectRoute,markMessageAsSeen)
messageRouter.post('/send/:id',protectRoute,sendMessage)

export default messageRouter