import User from "../models/user.model.js";
import jwt from "jsonwebtoken";
import { ApiResponse } from "../utils/apiResponse.js";

export const protectRoute = async (req, res, next) => {
  try {
    const token = req.headers.token || req.headers.authorization?.split(" ")[1];

    if (!token) {
      return res.status(401).json(
        new ApiResponse(401, {}, "Authentication token missing")
      );
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await User.findById(decoded.userId).select("-password");
    if (!user) {
      return res.status(404).json(
        new ApiResponse(404, {}, "User not found")
      );
    }

    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json(
      new ApiResponse(401, {}, error.message)
    );
  }
};
