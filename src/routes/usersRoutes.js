import express from "express";
import usersController from "../controllers/usersController.js";
import protect from "../middlewares/authMiddleware.js";
import adminOnly from "../middlewares/adminMiddleware.js";
import {
  validateUserRegistration,
  validateUserLogin,
  validateUserUpdate,
  handleValidationErrors,
} from "../middlewares/validationMiddleware.js";

const router = express.Router();

router.post(
  "/",
  validateUserRegistration,
  handleValidationErrors,
  usersController.createUser
);

router.post(
  "/login",
  validateUserLogin,
  handleValidationErrors,
  usersController.loginUser
);

router.get("/", protect, adminOnly, usersController.getUsers);

router.put(
  "/:id",
  protect,
  validateUserUpdate,
  handleValidationErrors,
  usersController.updateUser
);
router.delete("/:id", protect, usersController.deleteUser);

export default router;
