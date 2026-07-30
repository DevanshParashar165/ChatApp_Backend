import AuditLog from "../models/auditLog.model.js";

export const logEvent = async ({ userId, action, status, req, details }) => {
  try {
    let ipAddress = "";
    let userAgent = "";

    if (req) {
      ipAddress = req.headers["x-forwarded-for"] || req.socket.remoteAddress || "";
      userAgent = req.headers["user-agent"] || "";
    }

    await AuditLog.create({
      userId,
      action,
      status,
      ipAddress,
      userAgent,
      details,
    });
  } catch (err) {
    console.error("[Audit Logger Error] Failed to write event log: ", err.message);
  }
};
export default logEvent;
