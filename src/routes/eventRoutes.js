import express from "express";
import eventController from "../controllers/eventController.js";
import protect from "../middlewares/authMiddleware.js";
import adminOnly from "../middlewares/adminMiddleware.js";
import {
  validateEventCreation,
  validateEventUpdate,
  handleValidationErrors,
} from "../middlewares/validationMiddleware.js";

const router = express.Router();

// Public routes
router.get("/", eventController.getEvents);
router.get("/:id", eventController.getEventById);

// Protected admin routes with validation
router.post(
  "/",
  protect,
  adminOnly,
  validateEventCreation,
  handleValidationErrors,
  eventController.createEvent
);
router.put(
  "/:id",
  protect,
  adminOnly,
  validateEventUpdate,
  handleValidationErrors,
  eventController.updateEvent
);
router.delete("/:id", protect, adminOnly, eventController.deleteEvent);

export default router;
