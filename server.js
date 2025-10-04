import express from "express";
import pool from "./config/db.js";
import healthRoutes from "./src/routes/healthRoutes.js";
import usersRoutes from "./src/routes/usersRoutes.js";
import eventRoutes from "./src/routes/eventRoutes.js";

import seatsRoutes from "./src/routes/seatsRoutes.js";
import bookingRoutes from "./src/routes/bookingRoutes.js";
import "./src/utils/seatCleanUp.js";
import errorMiddleware from "./src/middlewares/errorMiddleware.js";

const app = express();
const port = process.env.PORT || 5000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const testConnection = async () => {
  try {
    const res = await pool.query("SELECT NOW()");
    console.log("Database connected:", res.rows[0]);
  } catch (err) {
    console.error("Database connection error:", err);
  }
};

testConnection();

app.use("/health", healthRoutes);
app.use("/users", usersRoutes);
app.use("/events", eventRoutes);

app.use("/seats", seatsRoutes);
app.use("/bookings", bookingRoutes);

app.use(errorMiddleware);

app.listen(port, () => {
  console.log(`Server is running successfully on http://localhost:${port}`);
});
