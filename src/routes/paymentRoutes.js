import express from "express";
import paymentController from "../controllers/paymentController.js";
import protect from "../middlewares/authMiddleware.js";

const router = express.Router();

// Mock payment endpoint
router.post("/mock-pay", protect, paymentController.createMockPayment);

// Check payment status
router.get("/status/:bookingId", protect, paymentController.getPaymentStatus);

export default router;
