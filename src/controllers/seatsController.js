import pool from "../../config/db.js";
import catchAsync from "../utils/catchAsync.js";
import AppError from "../utils/AppError.js";

// Get all seats for an event
const getEventSeats = catchAsync(async (req, res, next) => {
  const { eventId } = req.params;
  const { category } = req.query;

  let query = `
    SELECT id, seat_code, category, price, status, reserved_until
    FROM seats 
    WHERE event_id = $1
  `;
  let params = [eventId];

  if (category) {
    query += ` AND category = $2`;
    params.push(category);
  }

  query += ` ORDER BY seat_code`;

  const result = await pool.query(query, params);

  res.status(200).json({
    success: true,
    count: result.rows.length,
    data: result.rows,
  });
});

// Get only available seats
const getAvailableSeats = catchAsync(async (req, res, next) => {
  const { eventId } = req.params;
  const { category } = req.query;

  let query = `
    SELECT id, seat_code, category, price
    FROM seats 
    WHERE event_id = $1 AND status = 'available'
    AND (reserved_until IS NULL OR reserved_until < NOW())
  `;
  let params = [eventId];

  if (category) {
    query += ` AND category = $2`;
    params.push(category);
  }

  query += ` ORDER BY seat_code`;

  const result = await pool.query(query, params);

  res.status(200).json({
    success: true,
    count: result.rows.length,
    data: result.rows,
  });
});

// Hold seats temporarily (10 minutes)
const holdSeats = catchAsync(async (req, res, next) => {
  const { eventId } = req.params;
  const { seat_ids } = req.body;
  const user_id = req.user.id;

  if (req.user.role === "admin") {
    return next(
      new AppError(
        "Admins cannot hold seats. Please use a regular user account.",
        403
      )
    );
  }

  if (!seat_ids || !Array.isArray(seat_ids) || seat_ids.length === 0) {
    return next(new AppError("Please provide an array of seat IDs", 400));
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Lock and check seats
    const seatCheck = await client.query(
      `SELECT id, seat_code, status, reserved_until 
       FROM seats 
       WHERE id = ANY($1) AND event_id = $2
       FOR UPDATE`,
      [seat_ids, eventId]
    );

    // Check if all seats exist
    if (seatCheck.rows.length !== seat_ids.length) {
      await client.query("ROLLBACK");
      return next(new AppError("Some seats not found", 404));
    }

    // Check availability
    const unavailableSeats = seatCheck.rows.filter(
      (seat) =>
        seat.status !== "available" ||
        (seat.reserved_until && seat.reserved_until > new Date())
    );

    if (unavailableSeats.length > 0) {
      await client.query("ROLLBACK");
      return next(
        new AppError(
          `Seats not available: ${unavailableSeats
            .map((s) => s.seat_code)
            .join(", ")}`,
          400
        )
      );
    }

    // Reserve for 10 minutes
    const reserveUntil = new Date(Date.now() + 10 * 60 * 1000);

    await client.query(
      `UPDATE seats 
       SET status = 'reserved', reserved_until = $1 
       WHERE id = ANY($2)`,
      [reserveUntil, seat_ids]
    );

    await client.query("COMMIT");

    res.status(200).json({
      success: true,
      message: `Seats reserved for 10 minutes`,
      data: {
        seat_ids: seat_ids,
        reserved_until: reserveUntil,
      },
    });
  } catch (err) {
    await client.query("ROLLBACK");
    return next(new AppError("Error reserving seats", 500));
  } finally {
    client.release();
  }
});

// Release seats
const releaseSeats = catchAsync(async (req, res, next) => {
  const { eventId } = req.params;
  const { seat_ids } = req.body;

  const result = await pool.query(
    `UPDATE seats 
     SET status = 'available', reserved_until = NULL 
     WHERE id = ANY($1) AND event_id = $2`,
    [seat_ids, eventId]
  );

  res.status(200).json({
    success: true,
    message: "Seats released successfully",
    seats_released: result.rowCount,
  });
});

export default { getEventSeats, getAvailableSeats, holdSeats, releaseSeats };
