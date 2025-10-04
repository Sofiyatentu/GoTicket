import pool from "../../config/db.js";
import catchAsync from "../utils/catchAsync.js";

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

export default { getEventSeats, getAvailableSeats };
