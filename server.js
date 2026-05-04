import express from "express";
import "dotenv/config";
import cors from "cors";
import http from "http";
import { connectDB } from "./lib/db.js";
import userRouter from "./src/routes/user.route.js";
import messageRouter from "./src/routes/message.route.js";
import { Server } from "socket.io";

// Express Server
const app = express();
const server = http.createServer(app);

// Initialize socket.io server

export const io = new Server(server, {
  cors: { origin: "*" },
});

//store online user

export const userSocketMap = {}; // userId : socketId

io.on("connection", (socket) => {
  const userId = socket.handshake.query.userId;
  console.log("User connected : ", userId);

  if (userId) {
    userSocketMap[userId] = socket.id;
  }

  //Emit online users to all conected clients

  io.emit("getOnlineUsers", Object.keys(userSocketMap));

  // Video calling feature addition

  socket.on("call-user", ({ to, offer }) => {
    const receiverSocketId = userSocketMap[to];
    if (!receiverSocketId) return;

    io.to(receiverSocketId).emit("incoming-call", {
      from: userId,
      offer,
    });
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
    io.to(to).emit("call-ended");
  });

  socket.on("ice-candidate", ({ to, candidate }) => {
    const targetSocketId = userSocketMap[to];
    if (!targetSocketId) return;

    io.to(targetSocketId).emit("ice-candidate", { candidate });
  });

  socket.on("disconnect", () => {
    console.log("user disconnected : ", userId);
    delete userSocketMap[userId];
    io.emit("getOnlineUsers", Object.keys(userSocketMap));
  });
});

// Middleware

app.use(express.json({ limit: "4mb" }));
app.use(
  cors({
    origin: "*",
    credentials: true,
  })
);

app.use("/api/status", (req, res) => res.send("Sender is live"));
app.use("/api/auth", userRouter);
app.use("/api/messages", messageRouter);

//Connect to mongoDB

await connectDB();

if (process.env.NODE_ENV !== "production") {
  const port = process.env.PORT || 5000;

  server.listen(port, () => {
    console.log(`Server is running on port : ${port}`);
  });
}

//Export server for vercel
export default server;
