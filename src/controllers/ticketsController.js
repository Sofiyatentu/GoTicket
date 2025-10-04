import pool from "../../config/db.js";
import catchAsync from "../utils/catchAsync.js";
import AppError from "../utils/AppError.js";

const getTickets = catchAsync(async (req, res, next) => {
  const result = await pool.query(`SELECT 
        t.id AS ticket_id,
        u.name AS user_name,
        u.email AS user_email,
        e.title AS event_title,
        e.description AS event_description,
        e.date AS event_date,
        e.location AS event_location,
        e.price AS event_price,
        t.booked_at 
      FROM tickets t 
      JOIN users u ON t.user_id = u.id 
      JOIN events e ON t.event_id = e.id 
      ORDER BY t.booked_at DESC`);

  res.status(200).json({
    success: true,
    count: result.rows.length,
    message: "Tickets fetched successfully",
    data: result.rows,
  });
});

const bookTicket = catchAsync(async (req, res, next) => {
  const { event_id } = req.body;
  const user_id = req.user.id;

  if (req.user.role === "admin") {
    return next(
      new AppError(
        "Admins cannot book tickets. Please use a regular user account.",
        403
      )
    );
  }

  if (!event_id) {
    return next(new AppError("event_id is required", 400));
  }

  // Use transaction for safety
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Get available_tickets and lock the row
    const eventResult = await client.query(
      `SELECT id, title, available_tickets, price FROM events WHERE id = $1 FOR UPDATE`,
      [event_id]
    );

    if (eventResult.rows.length === 0) {
      await client.query("ROLLBACK");
      return next(new AppError(`Event with id ${event_id} not found`, 404));
    }

    const event = eventResult.rows[0];

    // Check if tickets are available
    if (event.available_tickets <= 0) {
      await client.query("ROLLBACK");
      return next(new AppError("No tickets available for this event", 400));
    }

    // Check if user already booked this event
    const existingBooking = await client.query(
      "SELECT id FROM tickets WHERE user_id = $1 AND event_id = $2",
      [user_id, event_id]
    );

    if (existingBooking.rows.length > 0) {
      await client.query("ROLLBACK");
      return next(
        new AppError("You have already booked a ticket for this event", 400)
      );
    }

    // Insert the ticket
    const ticketResult = await client.query(
      `INSERT INTO tickets(user_id, event_id) VALUES($1, $2) RETURNING *`,
      [user_id, event_id]
    );

    // Decrement available_tickets
    await client.query(
      `UPDATE events SET available_tickets = available_tickets - 1 WHERE id = $1`,
      [event_id]
    );

    // Get updated event info
    const updatedEvent = await client.query(
      `SELECT available_tickets FROM events WHERE id = $1`,
      [event_id]
    );

    await client.query("COMMIT");

    res.status(201).json({
      success: true,
      message: "Ticket booked successfully",
      data: {
        ticket: ticketResult.rows[0],
        event: {
          id: event.id,
          title: event.title,
          price: event.price,
          remaining_tickets: updatedEvent.rows[0].available_tickets,
        },
      },
    });
  } catch (err) {
    await client.query("ROLLBACK");
    return next(new AppError("Server error during booking", 500));
  } finally {
    client.release();
  }
});

export default { getTickets, bookTicket };
