import mongoose from "mongoose";

const callLogSchema = new mongoose.Schema(
  {
    callerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    receiverId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ["answered", "rejected", "missed"],
      required: true,
    },
    duration: {
      type: Number, // in seconds
      default: 0,
    },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

const CallLog = mongoose.model("CallLog", callLogSchema);

export default CallLog;
