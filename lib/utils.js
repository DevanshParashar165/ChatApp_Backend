import jwt from "jsonwebtoken";
import crypto from "crypto";
import RefreshToken from "../src/models/refreshToken.model.js";

const ACCESS_TOKEN_EXPIRY = "15m";
const REFRESH_TOKEN_DAYS = 7;

export const generateAccessToken = (userId) => {
  return jwt.sign({ userId }, process.env.JWT_SECRET, {
    expiresIn: ACCESS_TOKEN_EXPIRY,
  });
};

export const generateRefreshToken = async (userId) => {
  const token = crypto.randomBytes(40).toString("hex");
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_DAYS * 24 * 60 * 60 * 1000);

  await RefreshToken.create({ userId, token, expiresAt });
  return token;
};

export const generateTokenPair = async (userId) => {
  const token = generateAccessToken(userId);
  const refreshToken = await generateRefreshToken(userId);
  return { token, refreshToken };
};

export const revokeRefreshToken = async (token) => {
  if (!token) return;
  await RefreshToken.deleteOne({ token });
};

export const revokeAllUserRefreshTokens = async (userId) => {
  await RefreshToken.deleteMany({ userId });
};

// Backward-compatible alias
export const generateToken = generateAccessToken;
