import cloudinary from "../../lib/cloudinary.js";
import {
  generateTokenPair,
  revokeRefreshToken,
  revokeAllUserRefreshTokens,
} from "../../lib/utils.js";
import User from "../models/user.model.js";
import RefreshToken from "../models/refreshToken.model.js";
import { ApiResponse } from "../utils/apiResponse.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

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

    const user = await User.create({
      fullname,
      email,
      password: hashedPassword,
      bio,
    });

    const { token, refreshToken } = await generateTokenPair(user._id);
    const safeUser = await User.findById(user._id).select("-password");

    return res.json(
      new ApiResponse(
        200,
        { user: safeUser, token, refreshToken },
        "Account Created Successfully"
      )
    );
  } catch (error) {
    console.log(error.message);
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
    const safeUser = await User.findById(user._id).select("-password");

    res.json(
      new ApiResponse(200, { user: safeUser, token, refreshToken }, "Login successful")
    );
  } catch (error) {
    console.log(error.message);
    return res.status(400).json(new ApiResponse(400, {}, error.message));
  }
};

export const refreshAccessToken = async (req, res) => {
  try {
    const { refreshToken } = req.body;
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
    const { refreshToken } = req.body;
    await revokeRefreshToken(refreshToken);
    await revokeAllUserRefreshTokens(req.user._id);
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

    return res.json(
      new ApiResponse(200, { updatedUser }, "User Details updated Successfully")
    );
  } catch (error) {
    console.log(error.message);
    return res.status(500).json(new ApiResponse(500, {}, error.message));
  }
};
