import pool from "../../config/db.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import catchAsync from "../utils/catchAsync.js";
import AppError from "../utils/AppError.js";

const generateToken = (userId) => {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET, { expiresIn: "1h" });
};

const getUsers = catchAsync(async (req, res, next) => {
  const result = await pool.query(
    `SELECT id, name, email, created_at FROM users ORDER BY created_at DESC`
  );

  res.status(200).json({
    success: true,
    count: result.rows.length,
    data: result.rows,
  });
});

const createUser = catchAsync(async (req, res, next) => {
  const { name, email, password } = req.body;

  const existingUser = await pool.query(
    `SELECT id FROM users WHERE email = $1`,
    [email]
  );
  if (existingUser.rows.length > 0) {
    return next(new AppError("User already exists", 409));
  }

  const hashedPassword = await bcrypt.hash(password, 10);
  const result = await pool.query(
    `INSERT INTO users(name, email, password) VALUES ($1, $2, $3) RETURNING id, name, email, created_at`,
    [name, email, hashedPassword]
  );

  res.status(201).json({
    success: true,
    message: "User created successfully",
    data: result.rows[0],
  });
});

const loginUser = catchAsync(async (req, res, next) => {
  const { email, password } = req.body;

  const user = await pool.query(`SELECT * FROM users WHERE email = $1`, [
    email,
  ]);
  if (user.rows.length === 0) {
    return next(new AppError("Invalid credentials", 401));
  }

  const foundUser = user.rows[0];
  const validPassword = await bcrypt.compare(password, foundUser.password);
  if (!validPassword) {
    return next(new AppError("Invalid credentials", 401));
  }

  const token = generateToken(foundUser.id);
  res.status(200).json({
    success: true,
    message: "Logged in successfully",
    token,
    data: {
      id: foundUser.id,
      name: foundUser.name,
      email: foundUser.email,
    },
  });
});

const updateUser = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const { name, email } = req.body;

  // FIXED: Added 'id' to SELECT
  const existingUser = await pool.query(`SELECT id FROM users WHERE id = $1`, [
    id,
  ]);
  if (existingUser.rows.length === 0) {
    return next(new AppError("User not found", 404));
  }

  const emailCheck = await pool.query(
    `SELECT id FROM users WHERE email = $1 AND id != $2`,
    [email, id]
  );
  if (emailCheck.rows.length > 0) {
    return next(new AppError("Email already in use", 400));
  }

  const result = await pool.query(
    `UPDATE users SET name = $1, email = $2 WHERE id = $3 RETURNING id, name, email, created_at`,
    [name, email, id]
  );

  res.status(200).json({
    success: true,
    message: "Updated successfully",
    data: result.rows[0],
  });
});

const deleteUser = catchAsync(async (req, res, next) => {
  const { id } = req.params;

  // FIXED: Added 'id' to SELECT
  const existingUser = await pool.query(`SELECT id FROM users WHERE id = $1`, [
    id,
  ]);
  if (existingUser.rows.length === 0) {
    return next(new AppError("User not found", 404));
  }

  await pool.query(`DELETE FROM users WHERE id = $1`, [id]);

  res.status(200).json({
    success: true,
    message: "User deleted successfully",
    deletedUserId: id,
  });
});

export default { getUsers, createUser, loginUser, updateUser, deleteUser };
