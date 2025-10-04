import AppError from "../utils/AppError.js";

const errorHandler = (err, req, res, next) => {
  let error = { ...err };
  error.message = err.message;

  console.error("Error :", err);

  // PostgreSQL errors
  if (err.code === "23505") {
    const message = "Duplicate field value entered";
    error = new AppError(message, 400);
  }

  if (err.code === "23503") {
    const message = "Resource not found";
    error = new AppError(message, 404);
  }

  // JWT errors
  if (err.name === "JsonWebTokenError") {
    const message = "Invalid token";
    error = new AppError(message, 401);
  }

  if (err.name === "TokenExpiredError") {
    const message = "Token expired";
    error = new AppError(message, 401);
  }

  res.status(error.statusCode || 500).json({
    success: false,
    message: error.message || "Internal Server Error",
  });
};

export default errorHandler;
