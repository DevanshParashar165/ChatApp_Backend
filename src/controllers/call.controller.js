import CallLog from "../models/callLog.model.js";
import User from "../models/user.model.js";
import Message from "../models/message.model.js";
import Group from "../models/group.model.js";
import { ApiResponse } from "../utils/apiResponse.js";

export const logCallRecord = async (req, res) => {
  try {
    const { receiverId, status, duration } = req.body;
    const callerId = req.user._id;

    if (!receiverId || !status) {
      return res.status(400).json(new ApiResponse(400, {}, "receiverId and status are required"));
    }

    const callLog = await CallLog.create({
      callerId,
      receiverId,
      status,
      duration: duration || 0,
    });

    return res.status(201).json(new ApiResponse(201, { callLog }, "Call logged successfully"));
  } catch (error) {
    console.error(error.message);
    return res.status(500).json(new ApiResponse(500, {}, error.message));
  }
};

export const getMyCallLogs = async (req, res) => {
  try {
    const myId = req.user._id;
    const logs = await CallLog.find({
      $or: [{ callerId: myId }, { receiverId: myId }],
    })
      .sort({ createdAt: -1 })
      .populate("callerId", "fullname profilePic email")
      .populate("receiverId", "fullname profilePic email")
      .limit(50)
      .lean();

    return res.json(new ApiResponse(200, { logs }));
  } catch (error) {
    console.error(error.message);
    return res.status(500).json(new ApiResponse(500, {}, error.message));
  }
};

export const getAdminStats = async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json(new ApiResponse(403, {}, "Forbidden: Admin access only"));
    }

    const totalUsers = await User.countDocuments();
    const totalMessages = await Message.countDocuments();
    const totalGroups = await Group.countDocuments();
    const totalCalls = await CallLog.countDocuments();

    const allUsers = await User.find({}, "fullname email role profilePic createdAt").sort({ createdAt: -1 }).lean();

    return res.json(
      new ApiResponse(200, {
        stats: {
          totalUsers,
          totalMessages,
          totalGroups,
          totalCalls,
        },
        users: allUsers,
      })
    );
  } catch (error) {
    console.error(error.message);
    return res.status(500).json(new ApiResponse(500, {}, error.message));
  }
};

export const toggleUserRole = async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json(new ApiResponse(403, {}, "Forbidden: Admin access only"));
    }

    const { userId } = req.params;
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json(new ApiResponse(404, {}, "User not found"));
    }

    user.role = user.role === "admin" ? "user" : "admin";
    await user.save();

    return res.json(new ApiResponse(200, { user }, `User role updated to ${user.role}`));
  } catch (error) {
    console.error(error.message);
    return res.status(500).json(new ApiResponse(500, {}, error.message));
  }
};

export const deleteUserByAdmin = async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json(new ApiResponse(403, {}, "Forbidden: Admin access only"));
    }

    const { userId } = req.params;
    const user = await User.findByIdAndDelete(userId);
    if (!user) {
      return res.status(404).json(new ApiResponse(404, {}, "User not found"));
    }

    return res.json(new ApiResponse(200, {}, "User banned/deleted successfully"));
  } catch (error) {
    console.error(error.message);
    return res.status(500).json(new ApiResponse(500, {}, error.message));
  }
};
