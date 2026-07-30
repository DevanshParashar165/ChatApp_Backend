import cloudinary from "../../lib/cloudinary.js";
import Message from "../models/message.model.js";
import User from "../models/user.model.js";
import Group from "../models/group.model.js";
import { ApiResponse } from "../utils/apiResponse.js";
import { io, userSocketMap } from "../socket/socketState.js";
import getAIResponse from "../utils/aiResponse.js";
import AIMessage from "../models/aiMessage.model.js";
import {
  emitMessageStatus,
  markMessagesRead,
} from "../services/messageStatus.service.js";

const DEFAULT_PAGE_SIZE = 30;

const buildConversationQuery = (myId, selectedUserId) => ({
  $or: [
    { senderId: myId, receiverId: selectedUserId },
    { senderId: selectedUserId, receiverId: myId },
  ],
  isDeleted: false,
});

export const getUserForSidebar = async (req, res) => {
  try {
    const userId = req.user._id;
    const filteredUser = await User.find({ _id: { $ne: userId } }).select(
      "-password"
    );

    const unseenMessages = {};
    const promises = filteredUser.map(async (user) => {
      const count = await Message.countDocuments({
        senderId: user._id,
        receiverId: userId,
        seen: false,
        isDeleted: false,
      });
      if (count > 0) unseenMessages[user._id] = count;
    });
    await Promise.all(promises);

    return res.json(new ApiResponse(200, { filteredUser }, unseenMessages));
  } catch (error) {
    console.log(error.message);
    return res.status(500).json(new ApiResponse(500, {}, error.message));
  }
};

export const getMessages = async (req, res) => {
  try {
    const { id: selectedUserId } = req.validated?.params || req.params;
    const { cursor, limit = DEFAULT_PAGE_SIZE } =
      req.validated?.query || req.query;
    const myId = req.user._id;

    if (selectedUserId === "ai_quickchat") {
      const aiMessages = await AIMessage.find({ userId: myId }).sort({
        createdAt: 1,
      });

      const formattedMessages = aiMessages.map((msg) => ({
        senderId: msg.role === "user" ? myId : "ai_quickchat",
        receiverId: msg.role === "user" ? "ai_quickchat" : myId,
        text: msg.text,
        createdAt: msg.createdAt,
      }));

      return res.json(
        new ApiResponse(200, {
          messages: formattedMessages,
          hasMore: false,
          nextCursor: null,
        })
      );
    }

    const isGroup = await Group.exists({ _id: selectedUserId, isDeleted: false });

    let query;
    if (isGroup) {
      query = { groupId: selectedUserId, isDeleted: false };
    } else {
      await markMessagesRead(selectedUserId, myId);
      query = buildConversationQuery(myId, selectedUserId);
    }

    if (cursor) {
      query.createdAt = { $lt: new Date(cursor) };
    }

    const messages = await Message.find(query)
      .sort({ createdAt: -1 })
      .limit(Number(limit) + 1)
      .populate("senderId", "fullname profilePic bio")
      .populate({
        path: "replyTo",
        select: "text image audio senderId",
        populate: {
          path: "senderId",
          select: "fullname",
        },
      })
      .lean();

    const hasMore = messages.length > Number(limit);
    const page = hasMore ? messages.slice(0, Number(limit)) : messages;
    page.reverse();

    const nextCursor =
      hasMore && page.length > 0 ? page[0].createdAt.toISOString() : null;

    return res.json(
      new ApiResponse(200, { messages: page, hasMore, nextCursor })
    );
  } catch (error) {
    console.log(error.message);
    return res.status(500).json(new ApiResponse(500, {}, error.message));
  }
};

export const searchMessages = async (req, res) => {
  try {
    const { q, userId: partnerId, limit = 20 } =
      req.validated?.query || req.query;
    const myId = req.user._id;

    const messages = await Message.find({
      ...buildConversationQuery(myId, partnerId),
      text: { $regex: q, $options: "i" },
    })
      .sort({ createdAt: -1 })
      .limit(Number(limit))
      .select("text senderId receiverId createdAt")
      .lean();

    return res.json(new ApiResponse(200, { messages }));
  } catch (error) {
    console.log(error.message);
    return res.status(500).json(new ApiResponse(500, {}, error.message));
  }
};

export const markMessageAsSeen = async (req, res) => {
  try {
    const { id } = req.params;
    const message = await Message.findOneAndUpdate(
      { _id: id, receiverId: req.user._id, isDeleted: false },
      {
        seen: true,
        deliveryStatus: "read",
        readAt: new Date(),
      },
      { new: true }
    );

    if (message) {
      emitMessageStatus(message.senderId, {
        messageId: message._id,
        deliveryStatus: "read",
        readAt: message.readAt,
      });
    }

    return res.json(new ApiResponse(200, {}, "Marked as seen"));
  } catch (error) {
    console.log(error.message);
    return res.status(500).json(new ApiResponse(500, {}, error.message));
  }
};

export const editMessage = async (req, res) => {
  try {
    const { messageId } = req.validated?.params || req.params;
    const { text } = req.validated?.body || req.body;

    const message = await Message.findOneAndUpdate(
      {
        _id: messageId,
        senderId: req.user._id,
        isDeleted: false,
        text: { $exists: true, $ne: null },
      },
      { text, editedAt: new Date() },
      { new: true }
    );

    if (!message) {
      return res.status(404).json(new ApiResponse(404, {}, "Message not found"));
    }

    const receiverSocketId = userSocketMap[message.receiverId.toString()];
    if (receiverSocketId) {
      io.to(receiverSocketId).emit("messageEdited", message);
    }

    return res.json(new ApiResponse(200, { message }, "Message updated"));
  } catch (error) {
    console.log(error.message);
    return res.status(500).json(new ApiResponse(500, {}, error.message));
  }
};

export const deleteMessage = async (req, res) => {
  try {
    const { messageId } = req.params;

    const message = await Message.findOneAndUpdate(
      { _id: messageId, senderId: req.user._id, isDeleted: false },
      { isDeleted: true, text: null, image: null },
      { new: true }
    );

    if (!message) {
      return res.status(404).json(new ApiResponse(404, {}, "Message not found"));
    }

    const receiverSocketId = userSocketMap[message.receiverId.toString()];
    if (receiverSocketId) {
      io.to(receiverSocketId).emit("messageDeleted", {
        messageId: message._id,
      });
    }

    return res.json(new ApiResponse(200, {}, "Message deleted"));
  } catch (error) {
    console.log(error.message);
    return res.status(500).json(new ApiResponse(500, {}, error.message));
  }
};

export const sendMessage = async (req, res) => {
  try {
    const { text, image, audio, replyTo } = req.validated?.body || req.body;
    const receiverId = (req.validated?.params || req.params).id;
    const senderId = req.user._id;

    if (receiverId === "ai_quickchat") {
      await AIMessage.create({ userId: senderId, role: "user", text });

      const history = await AIMessage.find({ userId: senderId })
        .sort({ createdAt: 1 })
        .limit(10);

      const conversation = history
        .map((msg) => `${msg.role}: ${msg.text}`)
        .join("\n");

      const aiReply = await getAIResponse(conversation + `\nuser: ${text}`);

      await AIMessage.create({
        userId: senderId,
        role: "assistant",
        text: aiReply,
      });

      return res.json(
        new ApiResponse(200, {
          newMessage: {
            senderId: "ai_quickchat",
            receiverId: senderId,
            text: aiReply,
            createdAt: new Date(),
          },
        })
      );
    }

    let group = null;
    if (receiverId !== "ai_quickchat") {
      group = await Group.findOne({ _id: receiverId, isDeleted: false });
    }

    let imageUrl;
    if (image) {
      const uploadResponse = await cloudinary.uploader.upload(image);
      imageUrl = uploadResponse.secure_url;
    }

    let audioUrl;
    if (audio) {
      const uploadResponse = await cloudinary.uploader.upload(audio, {
        resource_type: "video",
      });
      audioUrl = uploadResponse.secure_url;
    }

    if (group) {
      const newMessage = await Message.create({
        senderId,
        groupId: receiverId,
        text,
        image: imageUrl,
        audio: audioUrl,
        replyTo: replyTo || undefined,
        deliveryStatus: "sent",
      });

      const populatedMessage = await Message.findById(newMessage._id)
        .populate("senderId", "fullname profilePic bio")
        .populate({
          path: "replyTo",
          select: "text image audio senderId",
          populate: {
            path: "senderId",
            select: "fullname",
          },
        })
        .lean();

      io.to(receiverId.toString()).emit("newMessage", populatedMessage);

      return res.json(
        new ApiResponse(200, { newMessage: populatedMessage }, "Group message sent successfully")
      );
    }

    // Check block list restrictions
    const receiverUser = await User.findById(receiverId);
    const senderUser = await User.findById(senderId);

    if (receiverUser && senderUser) {
      const isSenderBlocked = receiverUser.blockedUsers?.includes(senderId);
      const isReceiverBlocked = senderUser.blockedUsers?.includes(receiverId);
      if (isSenderBlocked || isReceiverBlocked) {
        return res.status(403).json(
          new ApiResponse(403, {}, "Message blocked: One of the users has blocked the other.")
        );
      }
    }

    const receiverSocketId = userSocketMap[receiverId.toString()];
    const isReceiverOnline = Boolean(receiverSocketId);

    const newMessage = await Message.create({
      senderId,
      receiverId,
      text,
      image: imageUrl,
      audio: audioUrl,
      replyTo: replyTo || undefined,
      deliveryStatus: isReceiverOnline ? "delivered" : "sent",
      deliveredAt: isReceiverOnline ? new Date() : undefined,
    });

    const populatedMessage = await Message.findById(newMessage._id)
      .populate("senderId", "fullname profilePic bio")
      .populate({
        path: "replyTo",
        select: "text image audio senderId",
        populate: {
          path: "senderId",
          select: "fullname",
        },
      })
      .lean();

    if (receiverSocketId) {
      io.to(receiverSocketId).emit("newMessage", populatedMessage);
    }

    if (isReceiverOnline) {
      emitMessageStatus(senderId, {
        messageId: newMessage._id,
        deliveryStatus: "delivered",
        deliveredAt: newMessage.deliveredAt,
      });
    }

    return res.json(
      new ApiResponse(200, { newMessage: populatedMessage }, "Message sent successfully")
    );
  } catch (error) {
    console.log(error.message);
    return res.status(500).json(new ApiResponse(500, {}, error.message));
  }
};

export const toggleReaction = async (req, res) => {
  try {
    const { messageId } = req.params;
    const { emoji } = req.body;
    const userId = req.user._id;

    if (!emoji) {
      return res.status(400).json(new ApiResponse(400, {}, "Emoji is required"));
    }

    const message = await Message.findById(messageId);
    if (!message) {
      return res.status(404).json(new ApiResponse(404, {}, "Message not found"));
    }

    const existingReactionIndex = message.reactions.findIndex(
      (r) => r.userId.toString() === userId.toString()
    );

    if (existingReactionIndex > -1) {
      if (message.reactions[existingReactionIndex].emoji === emoji) {
        // Toggle off if same emoji clicked again
        message.reactions.splice(existingReactionIndex, 1);
      } else {
        // Update emoji
        message.reactions[existingReactionIndex].emoji = emoji;
      }
    } else {
      // Add reaction
      message.reactions.push({ userId, emoji });
    }

    await message.save();

    // Broadcast reaction update
    const targetRoom = message.groupId
      ? message.groupId.toString()
      : null;

    if (targetRoom) {
      io.to(targetRoom).emit("message-reaction", {
        messageId: message._id,
        reactions: message.reactions,
      });
    } else {
      const receiverSocketId = userSocketMap[message.receiverId.toString()];
      const senderSocketId = userSocketMap[message.senderId.toString()];
      if (receiverSocketId) {
        io.to(receiverSocketId).emit("message-reaction", {
          messageId: message._id,
          reactions: message.reactions,
        });
      }
      if (senderSocketId) {
        io.to(senderSocketId).emit("message-reaction", {
          messageId: message._id,
          reactions: message.reactions,
        });
      }
    }

    return res.json(
      new ApiResponse(200, { reactions: message.reactions }, "Reaction toggled successfully")
    );
  } catch (error) {
    console.log(error.message);
    return res.status(500).json(new ApiResponse(500, {}, error.message));
  }
};

export const togglePinMessage = async (req, res) => {
  try {
    const { messageId } = req.params;
    const userId = req.user._id;

    const message = await Message.findById(messageId);
    if (!message) {
      return res.status(404).json(new ApiResponse(404, {}, "Message not found"));
    }

    message.isPinned = !message.isPinned;
    message.pinnedBy = message.isPinned ? userId : undefined;
    await message.save();

    // Broadcast pin toggle
    const targetRoom = message.groupId ? message.groupId.toString() : null;
    const payload = {
      messageId: message._id,
      isPinned: message.isPinned,
      pinnedBy: message.pinnedBy,
    };

    if (targetRoom) {
      io.to(targetRoom).emit("message-pin-toggle", payload);
    } else {
      const receiverSocketId = userSocketMap[message.receiverId.toString()];
      const senderSocketId = userSocketMap[message.senderId.toString()];
      if (receiverSocketId) {
        io.to(receiverSocketId).emit("message-pin-toggle", payload);
      }
      if (senderSocketId) {
        io.to(senderSocketId).emit("message-pin-toggle", payload);
      }
    }

    return res.json(
      new ApiResponse(200, { isPinned: message.isPinned, pinnedBy: message.pinnedBy }, "Message pin state updated successfully")
    );
  } catch (error) {
    console.log(error.message);
    return res.status(500).json(new ApiResponse(500, {}, error.message));
  }
};

export const getPinnedMessages = async (req, res) => {
  try {
    const { id: selectedUserId } = req.params;
    const myId = req.user._id;

    const isGroup = await Group.exists({ _id: selectedUserId, isDeleted: false });

    let query;
    if (isGroup) {
      query = { groupId: selectedUserId, isPinned: true, isDeleted: false };
    } else {
      query = {
        $or: [
          { senderId: myId, receiverId: selectedUserId },
          { senderId: selectedUserId, receiverId: myId },
        ],
        isPinned: true,
        isDeleted: false,
      };
    }

    const messages = await Message.find(query)
      .sort({ createdAt: -1 })
      .populate("senderId", "fullname profilePic bio")
      .lean();

    return res.json(new ApiResponse(200, { messages }));
  } catch (error) {
    console.log(error.message);
    return res.status(500).json(new ApiResponse(500, {}, error.message));
  }
};
