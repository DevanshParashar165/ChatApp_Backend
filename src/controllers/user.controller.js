import axios from "axios";
import cloudinary from "../../lib/cloudinary.js";
import {
  generateTokenPair,
  revokeRefreshToken,
  revokeAllUserRefreshTokens,
  setRefreshTokenCookie,
  clearRefreshTokenCookie,
} from "../../lib/utils.js";
import { deleteCache } from "../../lib/redis.js";
import User from "../models/user.model.js";
import RefreshToken from "../models/refreshToken.model.js";
import { ApiResponse } from "../utils/apiResponse.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { sendVerificationEmail, sendPasswordResetEmail } from "../services/email.service.js";
import { logEvent } from "../utils/auditLogger.js";

export const SignUp = async (req, res) => {
  try {
    const { fullname, email, password, bio } = req.body;

    const existedUser = await User.findOne({ email });
    if (existedUser) {
      return res
        .status(409)
        .json(new ApiResponse(409, {}, "User already exists"));
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const verificationToken = crypto.randomBytes(32).toString("hex");
    const verificationTokenExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    const user = await User.create({
      fullname,
      email,
      password: hashedPassword,
      bio,
      verificationToken,
      verificationTokenExpires,
    });

    if (process.env.NODE_ENV === "test") {
      await sendVerificationEmail(user.email, verificationToken).catch(() => { });
    } else {
      sendVerificationEmail(user.email, verificationToken).catch((err) => {
        console.error("[Email Error] Failed to send verification email: ", err.message);
      });
    }

    const { token, refreshToken } = await generateTokenPair(user._id);
    setRefreshTokenCookie(res, refreshToken);
    const safeUser = await User.findById(user._id).select("-password");

    await logEvent({
      userId: user._id,
      action: "auth.signup",
      status: "success",
      req,
      details: { email: user.email },
    });

    return res.json(
      new ApiResponse(
        200,
        { user: safeUser, token, refreshToken },
        "Account Created Successfully"
      )
    );
  } catch (error) {
    console.log(error.message);
    await logEvent({
      action: "auth.signup",
      status: "failed",
      req,
      details: { email: req.body?.email, error: error.message },
    });
    return res.status(400).json(new ApiResponse(400, {}, error.message));
  }
};

export const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email }).select("+password");

    if (!user) {
      return res
        .status(404)
        .json(new ApiResponse(404, {}, "User with this email does not exist"));
    }

    const isPasswordCorrect = await bcrypt.compare(password, user.password);
    if (!isPasswordCorrect) {
      return res
        .status(401)
        .json(new ApiResponse(401, {}, "Invalid User Credentials"));
    }

    const { token, refreshToken } = await generateTokenPair(user._id);
    setRefreshTokenCookie(res, refreshToken);
    const safeUser = await User.findById(user._id).select("-password");

    await logEvent({
      userId: user._id,
      action: "auth.login",
      status: "success",
      req,
      details: { email: user.email },
    });

    res.json(
      new ApiResponse(200, { user: safeUser, token, refreshToken }, "Login successful")
    );
  } catch (error) {
    console.log(error.message);
    await logEvent({
      action: "auth.login",
      status: "failed",
      req,
      details: { email: req.body?.email, error: error.message },
    });
    return res.status(400).json(new ApiResponse(400, {}, error.message));
  }
};

export const refreshAccessToken = async (req, res) => {
  try {
    const refreshToken = req.body.refreshToken || req.cookies?.refreshToken;
    const stored = await RefreshToken.findOne({ token: refreshToken });

    if (!stored || stored.expiresAt < new Date()) {
      return res
        .status(401)
        .json(new ApiResponse(401, {}, "Invalid or expired refresh token"));
    }

    const user = await User.findById(stored.userId).select("-password");
    if (!user) {
      return res.status(404).json(new ApiResponse(404, {}, "User not found"));
    }

    await revokeRefreshToken(refreshToken);
    const tokens = await generateTokenPair(user._id);
    setRefreshTokenCookie(res, tokens.refreshToken);

    return res.json(
      new ApiResponse(200, { user, ...tokens }, "Token refreshed")
    );
  } catch (error) {
    console.log(error.message);
    return res.status(401).json(new ApiResponse(401, {}, error.message));
  }
};

export const logout = async (req, res) => {
  try {
    const refreshToken = req.body.refreshToken || req.cookies?.refreshToken;
    await revokeRefreshToken(refreshToken);
    await revokeAllUserRefreshTokens(req.user._id);
    clearRefreshTokenCookie(res);
    return res.json(new ApiResponse(200, {}, "Logged out successfully"));
  } catch (error) {
    console.log(error.message);
    return res.status(500).json(new ApiResponse(500, {}, error.message));
  }
};

export const chekAuth = async (req, res) => {
  return res.json(new ApiResponse(200, req.user, "User is Authenticated"));
};

export const updateProfile = async (req, res) => {
  try {
    const { profilePic, bio, fullname } = req.body;
    const userId = req.user._id;
    let updatedUser;

    if (!profilePic) {
      updatedUser = await User.findByIdAndUpdate(
        userId,
        { bio, fullname },
        { new: true }
      ).select("-password");
    } else {
      const upload = await cloudinary.uploader.upload(profilePic);

      updatedUser = await User.findByIdAndUpdate(
        userId,
        {
          profilePic: upload.secure_url,
          bio,
          fullname,
        },
        { new: true }
      ).select("-password");
    }

    try {
      await deleteCache(`user:${userId}`);
    } catch (err) {
      console.warn("[Cache Eviction Error]", err.message);
    }

    return res.json(
      new ApiResponse(200, { updatedUser }, "User Details updated Successfully")
    );
  } catch (error) {
    console.log(error.message);
    return res.status(500).json(new ApiResponse(500, {}, error.message));
  }
};

export const verifyEmail = async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) {
      return res.status(400).json(new ApiResponse(400, {}, "Token is required"));
    }

    const user = await User.findOne({
      verificationToken: token,
      verificationTokenExpires: { $gt: new Date() },
    });

    if (!user) {
      return res.status(400).json(new ApiResponse(400, {}, "Invalid or expired verification token"));
    }

    user.isVerified = true;
    user.verificationToken = undefined;
    user.verificationTokenExpires = undefined;
    await user.save();

    return res.json(new ApiResponse(200, {}, "Email verified successfully"));
  } catch (error) {
    console.log(error.message);
    return res.status(500).json(new ApiResponse(500, {}, error.message));
  }
};

export const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json(new ApiResponse(400, {}, "Email is required"));
    }

    const user = await User.findOne({ email });
    if (!user) {
      // For security, don't reveal if email exists, return success anyway
      return res.json(new ApiResponse(200, {}, "If that email exists, a reset link has been sent."));
    }

    const resetToken = crypto.randomBytes(32).toString("hex");
    user.resetPasswordToken = resetToken;
    user.resetPasswordExpires = new Date(Date.now() + 1 * 60 * 60 * 1000); // 1 hour expiry
    await user.save();

    await sendPasswordResetEmail(user.email, resetToken);

    return res.json(new ApiResponse(200, {}, "If that email exists, a reset link has been sent."));
  } catch (error) {
    console.log(error.message);
    return res.status(500).json(new ApiResponse(500, {}, error.message));
  }
};

export const resetPassword = async (req, res) => {
  try {
    const { token, password } = req.body;
    if (!token || !password) {
      return res.status(400).json(new ApiResponse(400, {}, "Token and password are required"));
    }

    const user = await User.findOne({
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: new Date() },
    });

    if (!user) {
      return res.status(400).json(new ApiResponse(400, {}, "Invalid or expired reset token"));
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    user.password = hashedPassword;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    return res.json(new ApiResponse(200, {}, "Password has been reset successfully"));
  } catch (error) {
    console.log(error.message);
    return res.status(500).json(new ApiResponse(500, {}, error.message));
  }
};

export const blockUser = async (req, res) => {
  try {
    const { targetUserId } = req.body;
    const myId = req.user._id;

    if (!targetUserId) {
      return res.status(400).json(new ApiResponse(400, {}, "targetUserId is required"));
    }

    if (myId.toString() === targetUserId.toString()) {
      return res.status(400).json(new ApiResponse(400, {}, "You cannot block yourself"));
    }

    await User.findByIdAndUpdate(myId, {
      $addToSet: { blockedUsers: targetUserId },
    });

    return res.json(new ApiResponse(200, {}, "User blocked successfully"));
  } catch (error) {
    console.log(error.message);
    return res.status(500).json(new ApiResponse(500, {}, error.message));
  }
};

export const unblockUser = async (req, res) => {
  try {
    const { targetUserId } = req.body;
    const myId = req.user._id;

    if (!targetUserId) {
      return res.status(400).json(new ApiResponse(400, {}, "targetUserId is required"));
    }

    await User.findByIdAndUpdate(myId, {
      $pull: { blockedUsers: targetUserId },
    });

    return res.json(new ApiResponse(200, {}, "User unblocked successfully"));
  } catch (error) {
    console.log(error.message);
    return res.status(500).json(new ApiResponse(500, {}, error.message));
  }
};

export const getBlockedUsers = async (req, res) => {
  try {
    const myId = req.user._id;
    const user = await User.findById(myId).populate("blockedUsers", "fullname profilePic email").lean();
    return res.json(new ApiResponse(200, { blockedUsers: user.blockedUsers || [] }));
  } catch (error) {
    console.log(error.message);
    return res.status(500).json(new ApiResponse(500, {}, error.message));
  }
};

export const deleteAccount = async (req, res) => {
  try {
    const myId = req.user._id;
    await User.findByIdAndDelete(myId);
    res.cookie("token", "", { maxAge: 0 });
    return res.json(new ApiResponse(200, {}, "Account deleted successfully"));
  } catch (error) {
    console.log(error.message);
    return res.status(500).json(new ApiResponse(500, {}, error.message));
  }
};

export const googleCallback = async (req, res) => {
  try {
    const { code, state } = req.query;
    if (!code) {
      return res.redirect(`${process.env.CLIENT_URL || "http://localhost:5173"}/login?error=OAuthCodeMissing`);
    }

    const tokenResponse = await axios.post("https://oauth2.googleapis.com/token", {
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      redirect_uri: `${process.env.SERVER_URL || "http://localhost:5000"}/api/auth/google/callback`,
      grant_type: "authorization_code",
      code,
    });

    const accessToken = tokenResponse.data?.access_token;
    if (!accessToken) {
      return res.redirect(`${process.env.CLIENT_URL || "http://localhost:5173"}/login?error=OAuthTokenExchangeFailed`);
    }

    const userInfoResponse = await axios.get("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    const { email, name, picture, email_verified } = userInfoResponse.data;
    if (!email) {
      return res.redirect(`${process.env.CLIENT_URL || "http://localhost:5173"}/login?error=OAuthEmailMissing`);
    }

    if (email_verified !== undefined && !email_verified) {
      return res.redirect(`${process.env.CLIENT_URL || "http://localhost:5173"}/login?error=OAuthUnverifiedEmail`);
    }

    let user = await User.findOne({ email });
    if (user) {
      // Identity provider validation verifies the account status
      if (!user.isVerified) {
        user.isVerified = true;
        await user.save();
      }
    } else {
      user = await User.create({
        fullname: name || email.split("@")[0],
        email,
        profilePic: picture || "",
        password: crypto.randomBytes(16).toString("hex"),
        isVerified: true,
      });
    }

    const { token, refreshToken } = await generateTokenPair(user._id);
    setRefreshTokenCookie(res, refreshToken);

    await logEvent({
      userId: user._id,
      action: "auth.google",
      status: "success",
      req,
      details: { email: user.email },
    });

    // Pass tokens in hash fragments to prevent intermediate logs/referer leakage
    return res.redirect(
      `${process.env.CLIENT_URL || "http://localhost:5173"}/chat#token=${token}&refreshToken=${refreshToken}${state ? `&state=${state}` : ""}`
    );
  } catch (error) {
    console.error("Google OAuth error:", error.response?.data || error.message);
    const errText = error.response?.data?.error_description || error.message;
    return res.redirect(
      `${process.env.CLIENT_URL || "http://localhost:5173"}/login?error=${encodeURIComponent(errText)}`
    );
  }
};

export const githubCallback = async (req, res) => {
  try {
    const { code, state } = req.query;
    if (!code) {
      return res.redirect(`${process.env.CLIENT_URL || "http://localhost:5173"}/login?error=OAuthCodeMissing`);
    }

    const tokenResponse = await axios.post(
      "https://github.com/login/oauth/access_token",
      {
        client_id: process.env.GITHUB_CLIENT_ID,
        client_secret: process.env.GITHUB_CLIENT_SECRET,
        code,
      },
      {
        headers: { Accept: "application/json" },
      }
    );

    const accessToken = tokenResponse.data?.access_token;
    if (!accessToken) {
      return res.redirect(`${process.env.CLIENT_URL || "http://localhost:5173"}/login?error=OAuthTokenExchangeFailed`);
    }

    const userResponse = await axios.get("https://api.github.com/user", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    const { login: username, name, avatar_url } = userResponse.data;

    const emailsResponse = await axios.get("https://api.github.com/user/emails", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    const primaryEmailObj = emailsResponse.data?.find((email) => email.primary && email.verified);
    const email = primaryEmailObj ? primaryEmailObj.email : `${username}@users.noreply.github.com`;

    let user = await User.findOne({ email });
    if (user) {
      if (!user.isVerified) {
        user.isVerified = true;
        await user.save();
      }
    } else {
      user = await User.create({
        fullname: name || username || email.split("@")[0],
        email,
        profilePic: avatar_url || "",
        password: crypto.randomBytes(16).toString("hex"),
        isVerified: true,
      });
    }

    const { token, refreshToken } = await generateTokenPair(user._id);
    setRefreshTokenCookie(res, refreshToken);

    await logEvent({
      userId: user._id,
      action: "auth.github",
      status: "success",
      req,
      details: { email: user.email },
    });

    return res.redirect(
      `${process.env.CLIENT_URL || "http://localhost:5173"}/chat#token=${token}&refreshToken=${refreshToken}${state ? `&state=${state}` : ""}`
    );
  } catch (error) {
    console.error("GitHub OAuth error:", error.response?.data || error.message);
    const errText = error.response?.data?.error_description || error.message;
    return res.redirect(
      `${process.env.CLIENT_URL || "http://localhost:5173"}/login?error=${encodeURIComponent(errText)}`
    );
  }
};

