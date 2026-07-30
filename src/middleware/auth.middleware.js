import User from "../models/user.model.js";
import jwt from "jsonwebtoken";
import { ApiResponse } from "../utils/apiResponse.js";
import { getCache, setCache } from "../../lib/redis.js";

export const protectRoute = async (req, res, next) => {
  try {
    const token = req.headers.token || req.headers.authorization?.split(" ")[1];

    if (!token) {
      return res.status(401).json(
        new ApiResponse(401, {}, "Authentication token missing")
      );
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const cacheKey = `user:${decoded.userId}`;
    let user = null;

    try {
      const cached = await getCache(cacheKey);
      if (cached) {
        user = JSON.parse(cached);
      }
    } catch (err) {
      console.warn("[Cache Read Error] fallback to database", err.message);
    }

    if (!user) {
      user = await User.findById(decoded.userId).select("-password").lean();
      if (!user) {
        return res.status(404).json(
          new ApiResponse(404, {}, "User not found")
        );
      }
      try {
        await setCache(cacheKey, JSON.stringify(user), 300); // 5 mins TTL
      } catch (err) {
        console.warn("[Cache Write Error]", err.message);
      }
    }

    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json(
      new ApiResponse(401, {}, error.message)
    );
  }
};
