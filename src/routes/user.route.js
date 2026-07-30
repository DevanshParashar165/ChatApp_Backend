import { Router } from "express";
import {
  chekAuth,
  login,
  SignUp,
  updateProfile,
  refreshAccessToken,
  logout,
  verifyEmail,
  forgotPassword,
  resetPassword,
  blockUser,
  unblockUser,
  getBlockedUsers,
  deleteAccount,
  googleCallback,
  githubCallback,
} from "../controllers/user.controller.js";
import { protectRoute } from "../middleware/auth.middleware.js";
import { validate } from "../middleware/validate.js";
import { authLimiter } from "../middleware/rateLimiter.js";
import {
  signupSchema,
  loginSchema,
  refreshTokenSchema,
  verifyEmailSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} from "../validators/schemas.js";

const userRouter = Router();

userRouter.post("/signup", authLimiter, validate(signupSchema), SignUp);
userRouter.post("/login", authLimiter, validate(loginSchema), login);
userRouter.post("/refresh", validate(refreshTokenSchema), refreshAccessToken);
userRouter.post("/logout", protectRoute, logout);
userRouter.put("/update-profile", protectRoute, updateProfile);
userRouter.get("/check", protectRoute, chekAuth);

userRouter.post("/verify-email", validate(verifyEmailSchema), verifyEmail);
userRouter.post("/forgot-password", authLimiter, validate(forgotPasswordSchema), forgotPassword);
userRouter.post("/reset-password", authLimiter, validate(resetPasswordSchema), resetPassword);

// Privacy / Blocking / Settings
userRouter.post("/block", protectRoute, blockUser);
userRouter.post("/unblock", protectRoute, unblockUser);
userRouter.get("/blocked", protectRoute, getBlockedUsers);
userRouter.delete("/delete-account", protectRoute, deleteAccount);

// OAuth Callback routes
userRouter.get("/google/callback", googleCallback);
userRouter.get("/github/callback", githubCallback);

export default userRouter;
