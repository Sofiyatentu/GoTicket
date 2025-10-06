import express from "express";
import bookingController from "../controllers/bookingController.js";
import protect from "../middlewares/authMiddleware.js";

import {
  validateBooking,
  handleValidationErrors,
} from "../middlewares/validationMiddleware.js";

const router = express.Router();

// Routes
router.post(
  "/events/:eventId/book",
  protect,
  validateBooking,
  handleValidationErrors,
  bookingController.createBooking
);

// router.post(
//   "/:bookingId/confirm",
//   protect,
//   validatePayment,
//   handleValidationErrors,
//   bookingController.confirmBooking
// );

router.get("/my-bookings", protect, bookingController.getUserBookings);

router.get("/:bookingId", protect, bookingController.getBookingDetails);

export default router;
