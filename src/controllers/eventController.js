import pool from "../../config/db.js";
import catchAsync from "../utils/catchAsync.js";
import AppError from "../utils/AppError.js";
import generateSeats from "../utils/seatGenerator.js";

const getEvents = catchAsync(async (req, res, next) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const search = req.query.search || "";
  const upcoming = req.query.upcoming === "true";

  const offset = (page - 1) * limit;

  // UPDATED: Include price column
  let query = `
    SELECT id, title, description, date, location, 
            created_at,venue_id
           
    FROM events 
    WHERE 1=1
  `;
  let queryParams = [];

  if (search) {
    query += ` AND (title ILIKE $${
      queryParams.length + 1
    } OR description ILIKE $${queryParams.length + 1})`;
    queryParams.push(`%${search}%`);
  }

  if (upcoming) {
    query += ` AND date >= NOW()`;
  }

  query += ` ORDER BY date ASC LIMIT $${queryParams.length + 1} OFFSET $${
    queryParams.length + 2
  }`;
  queryParams.push(limit, offset);

  const result = await pool.query(query, queryParams);

  // Get total count
  let countQuery = `SELECT COUNT(*) FROM events WHERE 1=1`;
  let countParams = [];

  if (search) {
    countQuery += ` AND (title ILIKE $1 OR description ILIKE $1)`;
    countParams.push(`%${search}%`);
  }
  if (upcoming) {
    countQuery += ` AND date >= NOW()`;
  }

  const countResult = await pool.query(countQuery, countParams);
  const totalCount = parseInt(countResult.rows[0].count);

  res.status(200).json({
    success: true,
    message: "Events fetched successfully",
    data: result.rows,
    pagination: {
      page,
      limit,
      totalCount,
      totalPages: Math.ceil(totalCount / limit),
      hasNext: page < Math.ceil(totalCount / limit),
      hasPrev: page > 1,
    },
  });
});

// Replace the existing createEvent function
const createEvent = catchAsync(async (req, res, next) => {
  const { title, description, date, location, venue_id, seat_config } =
    req.body;

  if (!title || !date || !location || !venue_id || !seat_config) {
    return next(
      new AppError(
        "Please provide title, date, location, venue_id, and seat_config",
        400
      )
    );
  }

  // Validate seat config
  const { rows, seats_per_row, categories, base_price } = seat_config;
  if (!rows || !seats_per_row || !categories || !base_price) {
    return next(
      new AppError(
        "Please provide rows, seats_per_row, categories, and base_price in seat_config",
        400
      )
    );
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Check if venue exists
    const venueCheck = await client.query(
      "SELECT id FROM venues WHERE id = $1",
      [venue_id]
    );
    if (venueCheck.rows.length === 0) {
      await client.query("ROLLBACK");
      return next(new AppError("Venue not found", 404));
    }

    // Create event
    const eventResult = await client.query(
      `INSERT INTO events (title, description, date, location, venue_id) 
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [title, description, date, location, venue_id]
    );

    const event = eventResult.rows[0];

    // Generate and insert seats
    const seats = generateSeats(rows, seats_per_row, categories, base_price);

    for (const seat of seats) {
      await client.query(
        `INSERT INTO seats (event_id, seat_code, category, price, status) 
         VALUES ($1, $2, $3, $4, $5)`,
        [event.id, seat.seat_code, seat.category, seat.price, seat.status]
      );
    }

    await client.query("COMMIT");

    res.status(201).json({
      success: true,
      message: `Event created with ${seats.length} seats`,
      data: {
        event: event,
        seats_created: seats.length,
      },
    });
  } catch (err) {
    await client.query("ROLLBACK");
    return next(new AppError("Error creating event with seats", 500));
  } finally {
    client.release();
  }
});

const getEventById = catchAsync(async (req, res, next) => {
  const eventId = req.params.id;

  // UPDATED: Include price column
  const result = await pool.query(
    `SELECT id, title, description, date, location, 
             venue_id,created_at,
            
     FROM events WHERE id = $1`,
    [eventId]
  );

  if (result.rows.length === 0) {
    return next(new AppError("Event not found", 404));
  }

  res.status(200).json({
    success: true,
    message: "Event fetched successfully",
    data: result.rows[0],
  });
});

const updateEvent = catchAsync(async (req, res, next) => {
  const eventId = req.params.id;
  const { title, description, date, location, venue_id } = req.body;

  const eventResult = await pool.query(`SELECT * FROM events WHERE id = $1`, [
    eventId,
  ]);

  if (eventResult.rows.length === 0) {
    return next(new AppError("Event not found", 404));
  }

  const event = eventResult.rows[0];
  const updatedTitle = title || event.title;
  const updatedDescription = description || event.description;
  const updatedDate = date || event.date;
  const updatedLocation = location || event.location;
  const updatedVenueId = venue_id || event.venue_id;

  // Check for duplicate event
  if (date || location) {
    const existingEvent = await pool.query(
      `SELECT id FROM events WHERE date = $1 AND location = $2 AND id != $3`,
      [updatedDate, updatedLocation, eventId]
    );
    if (existingEvent.rows.length > 0) {
      return next(
        new AppError(
          "Another event already exists at this date and location",
          400
        )
      );
    }
  }

  // UPDATED: Include price in UPDATE
  const result = await pool.query(
    `UPDATE events 
     SET title = $1, description = $2, date = $3, location = $4, 
         venue_id=$5
     WHERE id = $6 
     RETURNING *`,
    [
      updatedTitle,
      updatedDescription,
      updatedDate,
      updatedLocation,

      updatedVenueId,
      eventId,
    ]
  );

  res.status(200).json({
    success: true,
    message: "Event updated successfully",
    data: result.rows[0],
  });
});

const deleteEvent = catchAsync(async (req, res, next) => {
  const eventId = req.params.id;
  const eventResult = await pool.query(`SELECT * FROM events WHERE id = $1`, [
    eventId,
  ]);

  if (eventResult.rows.length === 0) {
    return next(new AppError("Event not found", 404));
  }

  await pool.query(`DELETE FROM events WHERE id = $1`, [eventId]);

  res.status(200).json({
    success: true,
    message: "Event deleted successfully",
  });
});

export default {
  getEvents,
  createEvent,
  getEventById,
  updateEvent,
  deleteEvent,
};
