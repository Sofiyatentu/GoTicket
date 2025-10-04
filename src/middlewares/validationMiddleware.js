import { body, validationResult } from "express-validator";

// Validation rules for user registration
export const validateUserRegistration = [
  body("name")
    .trim()
    .notEmpty()
    .withMessage("Name is required")
    .isLength({ min: 2 })
    .withMessage("Name must be at least 2 characters")
    .isLength({ max: 100 })
    .withMessage("Name must be less than 100 characters")
    .escape(), // Prevents XSS attacks

  body("email")
    .isEmail()
    .withMessage("Please provide a valid email")
    .normalizeEmail(), // Converts email to lowercase

  body("password")
    .isLength({ min: 6 })
    .withMessage("Password must be at least 6 characters")
    .isLength({ max: 100 })
    .withMessage("Password must be less than 100 characters"),
];

// Validation rules for user login
export const validateUserLogin = [
  body("email")
    .isEmail()
    .withMessage("Please provide a valid email")
    .normalizeEmail(),

  body("password").notEmpty().withMessage("Password is required"),
];

// Validation rules for event creation
export const validateEventCreation = [
  body("title")
    .trim()
    .notEmpty()
    .withMessage("Title is required")
    .isLength({ min: 5 })
    .withMessage("Title must be at least 5 characters")
    .isLength({ max: 200 })
    .withMessage("Title must be less than 200 characters")
    .escape(),

  body("description").optional().trim().escape(),

  body("date")
    .isISO8601()
    .withMessage("Please provide a valid date")
    .custom((value) => {
      const eventDate = new Date(value);
      const now = new Date();
      if (eventDate <= now) {
        throw new Error("Event date must be in the future");
      }
      return true;
    }),

  body("location")
    .trim()
    .notEmpty()
    .withMessage("Location is required")
    .isLength({ max: 200 })
    .withMessage("Location must be less than 200 characters")
    .escape(),
  body("venue_id")
    .isInt({ min: 1 })
    .withMessage("Please provide a valid venue ID"),
  // Seat configuration validation
  body("seat_config").notEmpty().withMessage("Seat configuration is required"),
  body("seat_config.rows")
    .isInt({ min: 1 })
    .withMessage("Total tickets must be a positive number"),
  body("seat_config.seats_per_row")
    .isInt({ min: 1 })
    .withMessage("Seats per row must be a positive number"),
  body("seat_config.categories")
    .isArray({ min: 1 })
    .withMessage("Categories must be an array with at least one category"),
  body("seat_config.base_price")
    .isFloat({ min: 0 })
    .withMessage("Price must be a positive number"),
];

// Validation rules for ticket booking
export const validateTicketBooking = [
  body("event_id")
    .isInt({ min: 1 })
    .withMessage("Please provide a valid event ID"),
];

// Validation rules for user update
export const validateUserUpdate = [
  body("name")
    .optional()
    .trim()
    .isLength({ min: 2 })
    .withMessage("Name must be at least 2 characters")
    .isLength({ max: 100 })
    .withMessage("Name must be less than 100 characters")
    .escape(),

  body("email")
    .optional()
    .isEmail()
    .withMessage("Please provide a valid email")
    .normalizeEmail(),
];

// Validation rules for event update
export const validateEventUpdate = [
  body("title")
    .optional()
    .trim()
    .isLength({ min: 5 })
    .withMessage("Title must be at least 5 characters")
    .isLength({ max: 200 })
    .withMessage("Title must be less than 200 characters")
    .escape(),

  body("description").optional().trim().escape(),

  body("date")
    .optional()
    .isISO8601()
    .withMessage("Please provide a valid date"),

  body("location")
    .optional()
    .trim()
    .isLength({ max: 200 })
    .withMessage("Location must be less than 200 characters")
    .escape(),

  body("total_tickets")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Total tickets must be a positive number"),

  body("price")
    .optional()
    .isFloat({ min: 0 })
    .withMessage("Price must be a positive number"),
];

// Middleware to check validation results
export const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: "Validation failed",
      errors: errors.array().map((error) => ({
        field: error.path,
        message: error.msg,
        value: error.value,
      })),
    });
  }

  next();
};
