import jwt from "jsonwebtoken";
import pool from "../../config/db.js";
import AppError from "../utils/AppError.js";
import catchAsync from "../utils/catchAsync.js";

const protect = catchAsync(async (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer")
  ) {
    token = req.headers.authorization.split(" ")[1];
  }

  if (!token) {
    return next(new AppError("Not authorized, no token provided", 401));
  }

  const decoded = jwt.verify(token, process.env.JWT_SECRET);
  const result = await pool.query(
    "SELECT id, name, email,role FROM users WHERE id = $1",
    [decoded.id]
  );

  if (result.rows.length === 0) {
    return next(new AppError("User not found", 401));
  }

  req.user = result.rows[0];
  next();
});

export default protect;
