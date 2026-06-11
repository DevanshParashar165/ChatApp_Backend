import { ApiResponse } from "../utils/apiResponse.js";

export const validate =
  (schema) =>
  (req, res, next) => {
    const result = schema.safeParse({
      body: req.body,
      params: req.params,
      query: req.query,
    });

    if (!result.success) {
      const message = result.error.issues
        .map((issue) => issue.message)
        .join(", ");
      return res
        .status(400)
        .json(new ApiResponse(400, {}, message));
    }

    req.validated = result.data;
    if (result.data.body) req.body = result.data.body;
    next();
  };
