import pool from "../../config/db.js";
import cron from "node-cron";

const releaseExpiredSeats = async () => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Release seats where reservation expired
    const result = await client.query(
      `UPDATE seats 
       SET status = 'available', reserved_until = NULL, booking_id = NULL
       WHERE status = 'reserved' AND reserved_until < NOW()`
    );

    // Mark expired bookings
    await client.query(
      `UPDATE bookings 
       SET status = 'expired' 
       WHERE status = 'reserved' AND id IN (
         SELECT DISTINCT booking_id FROM seats 
         WHERE reserved_until < NOW() AND status = 'available'
       )`
    );

    await client.query("COMMIT");

    if (result.rowCount > 0) {
      console.log(`Released ${result.rowCount} expired seat reservations`);
    }
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error releasing expired seats:", error);
  } finally {
    client.release();
  }
};

// Run every minute
cron.schedule("* * * * *", releaseExpiredSeats);

console.log("Seat cleanup job started - running every minute");

export default releaseExpiredSeats;
