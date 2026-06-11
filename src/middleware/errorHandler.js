import { ApiResponse } from "../utils/apiResponse.js";

export const notFoundHandler = (req, res) => {
  res.status(404).json(new ApiResponse(404, {}, `Route ${req.originalUrl} not found`));
};

export const errorHandler = (err, req, res, next) => {
  console.error(err.stack || err.message);

  const statusCode = err.statusCode || 500;
  const message =
    process.env.NODE_ENV === "production"
      ? "Internal server error"
      : err.message || "Internal server error";

  res.status(statusCode).json(new ApiResponse(statusCode, {}, message));
};
