import Message from "../models/message.model.js";
import { io, userSocketMap } from "../socket/socketState.js";

export const emitMessageStatus = (userId, payload) => {
  if (!io) return;
  const socketId = userSocketMap[userId?.toString()];
  if (socketId) {
    io.to(socketId).emit("messageStatusUpdate", payload);
  }
};

export const markMessagesDelivered = async (messageIds, receiverId) => {
  if (!messageIds?.length) return;

  const now = new Date();
  await Message.updateMany(
    {
      _id: { $in: messageIds },
      receiverId,
      deliveryStatus: "sent",
      isDeleted: false,
    },
    {
      deliveryStatus: "delivered",
      deliveredAt: now,
    }
  );

  const messages = await Message.find({ _id: { $in: messageIds } }).select(
    "senderId deliveryStatus deliveredAt"
  );

  for (const msg of messages) {
    emitMessageStatus(msg.senderId, {
      messageId: msg._id,
      deliveryStatus: "delivered",
      deliveredAt: now,
    });
  }
};

export const markMessagesRead = async (senderId, receiverId) => {
  const now = new Date();

  const result = await Message.updateMany(
    {
      senderId,
      receiverId,
      deliveryStatus: { $in: ["sent", "delivered"] },
      isDeleted: false,
    },
    {
      seen: true,
      deliveryStatus: "read",
      readAt: now,
      deliveredAt: now,
    }
  );

  if (result.modifiedCount > 0) {
    emitMessageStatus(senderId, {
      partnerId: receiverId,
      deliveryStatus: "read",
      readAt: now,
    });
  }
};

export const markSingleMessageRead = async (messageId, receiverId) => {
  const now = new Date();
  const existing = await Message.findOne({ _id: messageId, receiverId, isDeleted: false });

  if (!existing) return;

  const message = await Message.findByIdAndUpdate(
    messageId,
    {
      seen: true,
      deliveryStatus: "read",
      readAt: now,
      deliveredAt: existing.deliveredAt || now,
    },
    { new: true }
  );

  if (message) {
    emitMessageStatus(message.senderId, {
      messageId: message._id,
      deliveryStatus: "read",
      readAt: now,
    });
  }
};
