import pool from "../../config/db.js";
import catchAsync from "../utils/catchAsync.js";
import AppError from "../utils/AppError.js";

// Mock payment - simulates payment processing
const createMockPayment = catchAsync(async (req, res, next) => {
  const { bookingId } = req.body;
  const userId = req.user.id;

  console.log(`Processing mock payment for booking ${bookingId}`);

  // Verify booking belongs to user and is still reserved
  const bookingResult = await pool.query(
    `SELECT b.*, 
            json_agg(
              json_build_object(
                'seat_id', s.id,
                'seat_code', s.seat_code,
                'price', s.price
              )
            ) as seats
     FROM bookings b
     JOIN seats s ON s.booking_id = b.id
     WHERE b.id = $1 AND b.user_id = $2 AND b.status = 'reserved'
       AND s.reserved_until > NOW()
     GROUP BY b.id`,
    [bookingId, userId]
  );

  if (bookingResult.rows.length === 0) {
    return next(new AppError("Booking expired or not found", 400));
  }

  const booking = bookingResult.rows[0];

  // Simulate payment processing delay
  await new Promise((resolve) => setTimeout(resolve, 2000));

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Mark seats as sold and booking as confirmed
    await client.query(
      `UPDATE seats 
       SET status = 'sold', reserved_until = NULL 
       WHERE booking_id = $1`,
      [bookingId]
    );

    const mockPaymentId = `mock_pay_${Date.now()}`;

    await client.query(
      `UPDATE bookings 
       SET status = 'confirmed', payment_id = $1 
       WHERE id = $2`,
      [mockPaymentId, bookingId]
    );

    await client.query("COMMIT");

    res.status(200).json({
      success: true,
      message: "Payment processed successfully",
      data: {
        bookingId: booking.id,
        paymentId: mockPaymentId,
        totalAmount: booking.total_amount,
        confirmedAt: new Date(),
        seats: booking.seats,
      },
    });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Mock payment error:", error);
    return next(new AppError("Payment processing failed", 500));
  } finally {
    client.release();
  }
});

// Get payment status
const getPaymentStatus = catchAsync(async (req, res, next) => {
  const { bookingId } = req.params;
  const userId = req.user.id;

  const result = await pool.query(
    `SELECT id, status, payment_id, total_amount
     FROM bookings 
     WHERE id = $1 AND user_id = $2`,
    [bookingId, userId]
  );

  if (result.rows.length === 0) {
    return next(new AppError("Booking not found", 404));
  }

  res.status(200).json({
    success: true,
    data: result.rows[0],
  });
});

export default {
  createMockPayment,
  getPaymentStatus,
};
