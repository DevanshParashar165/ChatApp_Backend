import { Router } from "express";
import {
  chekAuth,
  login,
  SignUp,
  updateProfile,
  refreshAccessToken,
  logout,
} from "../controllers/user.controller.js";
import { protectRoute } from "../middleware/auth.middleware.js";
import { validate } from "../middleware/validate.js";
import { authLimiter } from "../middleware/rateLimiter.js";
import {
  signupSchema,
  loginSchema,
  refreshTokenSchema,
} from "../validators/schemas.js";

const userRouter = Router();

userRouter.post("/signup", authLimiter, validate(signupSchema), SignUp);
userRouter.post("/login", authLimiter, validate(loginSchema), login);
userRouter.post("/refresh", validate(refreshTokenSchema), refreshAccessToken);
userRouter.post("/logout", protectRoute, logout);
userRouter.put("/update-profile", protectRoute, updateProfile);
userRouter.get("/check", protectRoute, chekAuth);

export default userRouter;
