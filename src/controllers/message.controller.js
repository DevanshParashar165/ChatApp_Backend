import cloudinary from "../../lib/cloudinary.js";
import Message from "../models/message.model.js";
import User from "../models/user.model.js";
import { ApiResponse } from "../utils/apiResponse.js";
import { io } from "../../server.js";
import { userSocketMap } from "../../server.js";

//Get all user except the loggen in user
export const getUserForSidebar = async (req, res) => {
  try {
    const userId = req.user._id;
    const filteredUser = await User.find({ _id: { $ne: userId } }).select(
      "-password"
    );

    //count number of messages not seen

    const unseenMessages = {};
    const promises = filteredUser.map(async (user) => {
      const messages = await Message.find({
        senderId: user._id,
        receiverId: userId,
        seen: false,
      });
      if (messages.length > 0) {
        unseenMessages[user._id] = messages.length;
      }
    });
    await Promise.all(promises);

    return res.json(new ApiResponse(200, { filteredUser }, unseenMessages));
  } catch (error) {
    console.log(error.message);
    return res.json(new ApiResponse(409, {}, error.message));
  }
};

//get al messages for selected user

export const getMessages = async (req, res) => {
  try {
    const { id: selectedUserId } = req.params;
    const myId = req.user._id;

    const messages = await Message.find({
      $or: [
        { senderId: myId, receiverId: selectedUserId },
        { senderId: selectedUserId, receiverId: myId },
      ],
    });

    await Message.updateMany(
      {
        senderId: selectedUserId,
        receiverId: myId,
        seen: false,
      },
      {
        seen: true,
      }
    );

    return res.json(
      new ApiResponse(200, { messages }, "User messages fetched successfully")
    );
  } catch (error) {
    console.log(error.message);
    return res.json(new ApiResponse(409, {}, error.message));
  }
};

// mark message as seen

export const markMessageAsSeen = async (req, res) => {
  try {
    const { id } = req.params;
    await Message.findByIdAndUpdate(id, {
      seen: true,
    });
    return res.json(new ApiResponse(200, {}, "Marked as seen"));
  } catch (error) {
    console.log(error.message);
    return res.json(new ApiResponse(409, {}, error.message));
  }
};

//send message to selected user

export const sendMessage = async (req, res) => {
  try {
    const { text, image } = req.body;
    const receiverId = req.params.id;
    const senderId = req.user._id;
    let imageUrl;
    if (image) {
      const uploadResponse = await cloudinary.uploader.upload(image);
      imageUrl = uploadResponse.secure_url;
    }
    const newMessage = await Message.create({
      senderId,
      receiverId,
      text,
      image: imageUrl,
    });
    // Emit the new message to reciever's socket

    const recieverSocketId = userSocketMap[receiverId.toString()];
    if (recieverSocketId) {
      io.to(recieverSocketId).emit("newMessage", newMessage);
    }

    return res.json(
      new ApiResponse(200, { newMessage }, "Message sent successfully")
    );
  } catch (error) {
    console.log(error.message);
    return res.json(new ApiResponse(409, {}, error.message));
  }
};
