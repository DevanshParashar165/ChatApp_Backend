import express from "express";
import "dotenv/config";
import cors from "cors";
import http from "http";
import { connectDB } from "./lib/db.js";
import userRouter from "./src/routes/user.route.js";
import messageRouter from "./src/routes/message.route.js";
import { Server } from "socket.io";
import { setIo, userSocketMap } from "./src/socket/socketState.js";
import { registerChatHandlers, handleUserDisconnect } from "./src/socket/chat.handlers.js";
import { apiLimiter } from "./src/middleware/rateLimiter.js";
import { notFoundHandler, errorHandler } from "./src/middleware/errorHandler.js";
import User from "./src/models/user.model.js";

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: "*" },
});

setIo(io);

io.on("connection", async (socket) => {
  const userId = socket.handshake.query.userId;
  console.log("User connected : ", userId);

  if (userId) {
    userSocketMap[userId] = socket.id;
    await User.findByIdAndUpdate(userId, { lastSeen: new Date() });
  }

  io.emit("getOnlineUsers", Object.keys(userSocketMap));

  registerChatHandlers(io, socket, userId, userSocketMap);

  socket.on("call-user", ({ to, offer }) => {
    const receiverSocketId = userSocketMap[to];
    if (!receiverSocketId) return;
    io.to(receiverSocketId).emit("incoming-call", { from: userId, offer });
  });

  socket.on("answer-call", ({ to, answer }) => {
    const callerSocketId = userSocketMap[to];
    if (!callerSocketId) return;
    io.to(callerSocketId).emit("call-accepted", { answer });
  });

  socket.on("reject-call", ({ to }) => {
    const callerSocketId = userSocketMap[to];
    if (!callerSocketId) return;
    io.to(callerSocketId).emit("call-rejected");
  });

  socket.on("end-call", ({ to }) => {
    const targetSocketId = userSocketMap[to];
    if (!targetSocketId) return;
    io.to(targetSocketId).emit("call-ended");
  });

  socket.on("ice-candidate", ({ to, candidate }) => {
    const targetSocketId = userSocketMap[to];
    if (!targetSocketId) return;
    io.to(targetSocketId).emit("ice-candidate", { candidate });
  });

  socket.on("disconnect", async () => {
    console.log("user disconnected : ", userId);
    await handleUserDisconnect(io, userId, userSocketMap);
  });
});

app.use(express.json({ limit: "4mb" }));
app.use(
  cors({
    origin: "*",
    credentials: true,
  })
);
app.use(apiLimiter);

app.use("/api/status", (req, res) => res.send("Sender is live"));
app.use("/api/auth", userRouter);
app.use("/api/messages", messageRouter);

app.use(notFoundHandler);
app.use(errorHandler);

await connectDB();

const port = process.env.PORT || 5000;

// Vercel runs serverless — it hosts the HTTP server itself.
// Railway (and local dev) need an explicit listen for Socket.io.
if (!process.env.VERCEL) {
  server.listen(port, () => {
    console.log(`Server is running on port : ${port}`);
  });
}

export { io, userSocketMap };
export default server;
