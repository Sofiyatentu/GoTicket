import pool from "../../config/db.js";
import catchAsync from "../utils/catchAsync.js";
import AppError from "../utils/AppError.js";

// Unified booking creation - handles both seat-based and general admission
const createBooking = catchAsync(async (req, res, next) => {
  const { eventId } = req.params;
  const { seatIds, ticketCount } = req.body; // Support both
  const userId = req.user.id;

  // Validation
  if (seatIds && ticketCount) {
    return next(
      new AppError("Cannot specify both seatIds and ticketCount", 400)
    );
  }

  if (!seatIds && !ticketCount) {
    return next(new AppError("Specify either seatIds or ticketCount", 400));
  }

  if (seatIds && (!Array.isArray(seatIds) || seatIds.length === 0)) {
    return next(new AppError("seatIds must be a non-empty array", 400));
  }

  if (ticketCount && (typeof ticketCount !== "number" || ticketCount < 1)) {
    return next(new AppError("ticketCount must be a positive number", 400));
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Check event exists
    const eventCheck = await client.query(
      `SELECT id, title FROM events WHERE id = $1`,
      [eventId]
    );

    if (eventCheck.rows.length === 0) {
      await client.query("ROLLBACK");
      return next(new AppError("Event not found", 404));
    }

    let seatsToBook = [];
    let totalAmount = 0;

    if (seatIds) {
      // ========== SEAT-BASED BOOKING ==========
      console.log("Processing seat-based booking for seats:", seatIds);

      // Lock and check seat availability
      const seatsResult = await client.query(
        `SELECT id, seat_code, price, status, reserved_until 
         FROM seats 
         WHERE id = ANY($1) AND event_id = $2
         FOR UPDATE`,
        [seatIds, eventId]
      );

      // Check if all seats exist
      if (seatsResult.rows.length !== seatIds.length) {
        await client.query("ROLLBACK");
        return next(new AppError("Some seats not found", 404));
      }

      // Check if all seats are available
      const unavailableSeats = seatsResult.rows.filter(
        (seat) =>
          seat.status !== "available" ||
          (seat.reserved_until && seat.reserved_until > new Date())
      );

      if (unavailableSeats.length > 0) {
        await client.query("ROLLBACK");
        const unavailableCodes = unavailableSeats
          .map((s) => s.seat_code)
          .join(", ");
        return next(
          new AppError(`Seats not available: ${unavailableCodes}`, 400)
        );
      }

      seatsToBook = seatsResult.rows;
      totalAmount = seatsResult.rows.reduce(
        (sum, seat) => sum + parseFloat(seat.price),
        0
      );
    } else {
      // ========== GENERAL ADMISSION BOOKING ==========
      console.log(
        "Processing general admission booking for",
        ticketCount,
        "tickets"
      );

      // Find available seats (auto-assign)
      const availableSeats = await client.query(
        `SELECT id, seat_code, price 
         FROM seats 
         WHERE event_id = $1 AND status = 'available'
         AND (reserved_until IS NULL OR reserved_until < NOW())
         LIMIT $2
         FOR UPDATE`,
        [eventId, ticketCount]
      );

      if (availableSeats.rows.length < ticketCount) {
        await client.query("ROLLBACK");
        return next(
          new AppError(
            `Only ${availableSeats.rows.length} tickets available`,
            400
          )
        );
      }

      seatsToBook = availableSeats.rows;
      totalAmount = availableSeats.rows.reduce(
        (sum, seat) => sum + parseFloat(seat.price),
        0
      );
    }

    // ========== CREATE BOOKING RECORD ==========
    const bookingResult = await client.query(
      `INSERT INTO bookings (user_id, event_id, total_amount, status, booking_type) 
       VALUES ($1, $2, $3, 'reserved', $4) 
       RETURNING *`,
      [
        userId,
        eventId,
        totalAmount,
        seatIds ? "seat_based" : "general_admission",
      ]
    );

    const booking = bookingResult.rows[0];

    // ========== RESERVE SEATS ==========
    const reserveUntil = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
    const seatIdsToBook = seatsToBook.map((seat) => seat.id);

    await client.query(
      `UPDATE seats 
       SET status = 'reserved', reserved_until = $1, booking_id = $2
       WHERE id = ANY($3)`,
      [reserveUntil, booking.id, seatIdsToBook]
    );

    // ========== CREATE BOOKING_SEATS RECORDS ==========
    for (const seat of seatsToBook) {
      await client.query(
        `INSERT INTO booking_seats (booking_id, seat_id, price) 
         VALUES ($1, $2, $3)`,
        [booking.id, seat.id, seat.price]
      );
    }

    await client.query("COMMIT");

    res.status(201).json({
      success: true,
      message:
        "Booking created successfully. Complete payment within 10 minutes.",
      data: {
        bookingId: booking.id,
        bookingType: seatIds ? "seat_based" : "general_admission",
        totalAmount: totalAmount,
        reservedUntil: reserveUntil,
        seats: seatsToBook.map((seat) => ({
          id: seat.id,
          seat_code: seat.seat_code,
          price: seat.price,
        })),
      },
    });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Booking creation error:", error);
    return next(new AppError("Booking creation failed", 500));
  } finally {
    client.release();
  }
});

// Confirm booking (works for both types)
// const confirmBooking = catchAsync(async (req, res, next) => {
//   const { bookingId } = req.params;
//   const { paymentId } = req.body;
//   const userId = req.user.id;

//   console.log(`Confirming booking ${bookingId} for user ${userId}`);

//   const client = await pool.connect();

//   try {
//     await client.query("BEGIN");

//     // Verify booking belongs to user and is still reserved
//     const bookingResult = await client.query(
//       `SELECT b.*,
//               json_agg(
//                 json_build_object(
//                   'seat_id', s.id,
//                   'seat_code', s.seat_code,
//                   'price', s.price
//                 )
//               ) as seats
//        FROM bookings b
//        JOIN seats s ON s.booking_id = b.id
//        WHERE b.id = $1 AND b.user_id = $2 AND b.status = 'reserved'
//          AND s.reserved_until > NOW()
//        GROUP BY b.id`,
//       [bookingId, userId]
//     );

//     if (bookingResult.rows.length === 0) {
//       await client.query("ROLLBACK");
//       return next(new AppError("Booking expired or not found", 400));
//     }

//     const booking = bookingResult.rows[0];

//     // Mark seats as sold and booking as confirmed
//     await client.query(
//       `UPDATE seats
//        SET status = 'sold', reserved_until = NULL
//        WHERE booking_id = $1`,
//       [bookingId]
//     );

//     await client.query(
//       `UPDATE bookings
//        SET status = 'confirmed', payment_id = $1
//        WHERE id = $2`,
//       [paymentId, bookingId]
//     );

//     await client.query("COMMIT");

//     res.status(200).json({
//       success: true,
//       message: "Booking confirmed successfully",
//       data: {
//         bookingId: booking.id,
//         bookingType: booking.booking_type,
//         totalAmount: booking.total_amount,
//         confirmedAt: new Date(),
//         seats: booking.seats,
//       },
//     });
//   } catch (error) {
//     await client.query("ROLLBACK");
//     console.error("Booking confirmation error:", error);
//     return next(new AppError("Booking confirmation failed", 500));
//   } finally {
//     client.release();
//   }
// });

// Get user's bookings (both types)
const getUserBookings = catchAsync(async (req, res, next) => {
  const userId = req.user.id;

  const result = await pool.query(
    `SELECT 
       b.id, b.total_amount, b.status, b.booking_type, b.created_at, b.payment_id,
       e.title, e.date, e.location,
       json_agg(
         json_build_object(
           'seat_code', s.seat_code,
           'category', s.category,
           'price', s.price
         )
       ) as seats
     FROM bookings b
     JOIN events e ON b.event_id = e.id
     JOIN seats s ON s.booking_id = b.id
     WHERE b.user_id = $1
     GROUP BY b.id, e.title, e.date, e.location
     ORDER BY b.created_at DESC`,
    [userId]
  );

  res.status(200).json({
    success: true,
    data: result.rows,
  });
});

// Get booking details with tickets
const getBookingDetails = catchAsync(async (req, res, next) => {
  const { bookingId } = req.params;
  const userId = req.user.id;

  const result = await pool.query(
    `SELECT 
       b.*,
       e.title as event_title,
       e.date as event_date,
       e.location as event_location,
       json_agg(
         json_build_object(
           'ticket_id', t.id,
           'seat_code', s.seat_code,
           'category', s.category,
           'price', s.price
         )
       ) as tickets
     FROM bookings b
     JOIN events e ON b.event_id = e.id
     JOIN seats s ON s.booking_id = b.id
     LEFT JOIN tickets t ON t.booking_id = b.id AND t.seat_id = s.id
     WHERE b.id = $1 AND b.user_id = $2
     GROUP BY b.id, e.title, e.date, e.location`,
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
  createBooking,
  getUserBookings,
  getBookingDetails,
};
