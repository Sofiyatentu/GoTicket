import express from "express";
import ticketsController from "../controllers/ticketsController.js";
import protect from "../middlewares/authMiddleware.js";
import {
  validateTicketBooking,
  handleValidationErrors,
} from "../middlewares/validationMiddleware.js";

const router = express.Router();

router.get("/", ticketsController.getTickets);
router.post(
  "/",
  protect,
  validateTicketBooking,
  handleValidationErrors,
  ticketsController.bookTicket
);

export default router;
