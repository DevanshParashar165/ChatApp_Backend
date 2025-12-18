import { Router } from "express";
import { chekAuth, login, SignUp, updateProfile } from "../controllers/user.controller.js";
import { protectRoute } from "../middleware/auth.middleware.js";

const userRouter = Router();

userRouter.post('/signup',SignUp)
userRouter.post('/login',login)
userRouter.put('/update-profile',protectRoute,updateProfile)
userRouter.get('/check',protectRoute,chekAuth)

export default userRouter;