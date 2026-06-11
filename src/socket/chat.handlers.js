import User from "../models/user.model.js";
import {
  markMessagesDelivered,
  markMessagesRead,
} from "../services/messageStatus.service.js";

export const registerChatHandlers = (io, socket, userId, userSocketMap) => {
  socket.on("typing-start", ({ to }) => {
    const targetSocketId = userSocketMap[to];
    if (targetSocketId) {
      io.to(targetSocketId).emit("typing-start", { from: userId });
    }
  });

  socket.on("typing-stop", ({ to }) => {
    const targetSocketId = userSocketMap[to];
    if (targetSocketId) {
      io.to(targetSocketId).emit("typing-stop", { from: userId });
    }
  });

  socket.on("message-delivered", async ({ messageIds }) => {
    if (!Array.isArray(messageIds) || !messageIds.length) return;
    await markMessagesDelivered(messageIds, userId);
  });

  socket.on("messages-read", async ({ from }) => {
    if (!from) return;
    await markMessagesRead(from, userId);
  });
};

export const handleUserDisconnect = async (io, userId, userSocketMap) => {
  if (!userId) return;

  delete userSocketMap[userId];
  const lastSeen = new Date();

  await User.findByIdAndUpdate(userId, { lastSeen });
  io.emit("userLastSeen", { userId, lastSeen });
  io.emit("getOnlineUsers", Object.keys(userSocketMap));
};
