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
  cors: {
    origin: "https://quick-chat-65he3al8g-devansh-parashars-projects.vercel.app",
    methods: ["GET", "POST"]
  }
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
    origin: [
      "https://quick-chat-65he3al8g-devansh-parashars-projects.vercel.app"
    ],
    credentials: true
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
export default server