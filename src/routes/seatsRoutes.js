import express from "express";
import seatsController from "../controllers/seatsController.js";
import protect from "../middlewares/authMiddleware.js";

const router = express.Router();

// Public routes
router.get("/events/:eventId/seats", seatsController.getEventSeats);
router.get(
  "/events/:eventId/seats/available",
  seatsController.getAvailableSeats
);

export default router;
