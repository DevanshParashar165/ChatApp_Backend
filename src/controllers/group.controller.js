import Group from "../models/group.model.js";
import User from "../models/user.model.js";
import { ApiResponse } from "../utils/apiResponse.js";
import crypto from "crypto";

export const createGroup = async (req, res) => {
  try {
    const { name, description, avatar } = req.body;
    const creatorId = req.user._id;

    if (!name) {
      return res.status(400).json(new ApiResponse(400, {}, "Group name is required"));
    }

    const inviteCode = crypto.randomBytes(6).toString("hex");

    const group = await Group.create({
      name,
      description: description || "",
      avatar: avatar || "",
      creator: creatorId,
      members: [{ userId: creatorId, role: "admin" }],
      inviteCode,
    });

    return res.status(201).json(new ApiResponse(201, { group }, "Group created successfully"));
  } catch (error) {
    console.error(error.message);
    return res.status(500).json(new ApiResponse(500, {}, error.message));
  }
};

export const joinGroup = async (req, res) => {
  try {
    const { inviteCode } = req.params;
    const userId = req.user._id;

    const group = await Group.findOne({ inviteCode, isDeleted: false });
    if (!group) {
      return res.status(404).json(new ApiResponse(404, {}, "Group not found"));
    }

    const isMember = group.members.some((m) => m.userId.toString() === userId.toString());
    if (isMember) {
      return res.status(400).json(new ApiResponse(400, { group }, "You are already a member of this group"));
    }

    group.members.push({ userId, role: "member" });
    await group.save();

    return res.json(new ApiResponse(200, { group }, "Joined group successfully"));
  } catch (error) {
    console.error(error.message);
    return res.status(500).json(new ApiResponse(500, {}, error.message));
  }
};

export const getGroupMembers = async (req, res) => {
  try {
    const { groupId } = req.params;

    const group = await Group.findOne({ _id: groupId, isDeleted: false })
      .populate("members.userId", "fullname email profilePic bio")
      .lean();

    if (!group) {
      return res.status(404).json(new ApiResponse(404, {}, "Group not found"));
    }

    return res.json(new ApiResponse(200, { members: group.members }));
  } catch (error) {
    console.error(error.message);
    return res.status(500).json(new ApiResponse(500, {}, error.message));
  }
};

export const leaveGroup = async (req, res) => {
  try {
    const { groupId } = req.params;
    const userId = req.user._id;

    const group = await Group.findOne({ _id: groupId, isDeleted: false });
    if (!group) {
      return res.status(404).json(new ApiResponse(404, {}, "Group not found"));
    }

    const memberIndex = group.members.findIndex((m) => m.userId.toString() === userId.toString());
    if (memberIndex === -1) {
      return res.status(400).json(new ApiResponse(400, {}, "You are not a member of this group"));
    }

    const userRole = group.members[memberIndex].role;
    group.members.splice(memberIndex, 1);

    if (group.members.length === 0) {
      group.isDeleted = true;
    } else if (userRole === "admin") {
      // Promote oldest member or another admin
      const hasOtherAdmin = group.members.some((m) => m.role === "admin");
      if (!hasOtherAdmin) {
        group.members[0].role = "admin";
      }
    }

    await group.save();
    return res.json(new ApiResponse(200, {}, "Left group successfully"));
  } catch (error) {
    console.error(error.message);
    return res.status(500).json(new ApiResponse(500, {}, error.message));
  }
};

export const removeGroupMember = async (req, res) => {
  try {
    const { groupId } = req.params;
    const { userIdToKick } = req.body;
    const myId = req.user._id;

    const group = await Group.findOne({ _id: groupId, isDeleted: false });
    if (!group) {
      return res.status(404).json(new ApiResponse(404, {}, "Group not found"));
    }

    const myMemberInfo = group.members.find((m) => m.userId.toString() === myId.toString());
    if (!myMemberInfo || (myMemberInfo.role !== "admin" && myMemberInfo.role !== "moderator")) {
      return res.status(403).json(new ApiResponse(403, {}, "Forbidden: Insufficient privileges"));
    }

    const targetMemberInfo = group.members.find((m) => m.userId.toString() === userIdToKick?.toString());
    if (!targetMemberInfo) {
      return res.status(400).json(new ApiResponse(400, {}, "Target user is not a member of this group"));
    }

    // Role priority checks: mods cannot kick admins, mods cannot kick mods
    if (myMemberInfo.role === "moderator" && (targetMemberInfo.role === "admin" || targetMemberInfo.role === "moderator")) {
      return res.status(403).json(new ApiResponse(403, {}, "Forbidden: You cannot kick users of equal or higher rank"));
    }

    group.members = group.members.filter((m) => m.userId.toString() !== userIdToKick.toString());
    await group.save();

    return res.json(new ApiResponse(200, {}, "Member kicked successfully"));
  } catch (error) {
    console.error(error.message);
    return res.status(500).json(new ApiResponse(500, {}, error.message));
  }
};

export const changeMemberRole = async (req, res) => {
  try {
    const { groupId } = req.params;
    const { userIdToUpdate, role } = req.body;
    const myId = req.user._id;

    if (!["member", "moderator", "admin"].includes(role)) {
      return res.status(400).json(new ApiResponse(400, {}, "Invalid role specified"));
    }

    const group = await Group.findOne({ _id: groupId, isDeleted: false });
    if (!group) {
      return res.status(404).json(new ApiResponse(404, {}, "Group not found"));
    }

    const myMemberInfo = group.members.find((m) => m.userId.toString() === myId.toString());
    if (!myMemberInfo || myMemberInfo.role !== "admin") {
      return res.status(403).json(new ApiResponse(403, {}, "Forbidden: Only admins can manage roles"));
    }

    const targetMember = group.members.find((m) => m.userId.toString() === userIdToUpdate?.toString());
    if (!targetMember) {
      return res.status(400).json(new ApiResponse(400, {}, "Target user is not a member of this group"));
    }

    targetMember.role = role;
    await group.save();

    return res.json(new ApiResponse(200, { group }, "Member role updated successfully"));
  } catch (error) {
    console.error(error.message);
    return res.status(500).json(new ApiResponse(500, {}, error.message));
  }
};

export const getMyGroups = async (req, res) => {
  try {
    const myId = req.user._id;
    const groups = await Group.find({
      "members.userId": myId,
      isDeleted: false,
    }).sort({ updatedAt: -1 });

    return res.json(new ApiResponse(200, { groups }));
  } catch (error) {
    console.error(error.message);
    return res.status(500).json(new ApiResponse(500, {}, error.message));
  }
};
