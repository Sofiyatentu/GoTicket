const adminOnly = (req, res, next) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Access denied. Admin rights required.",
      });
    }
    next();
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Server error in admin check",
    });
  }
};

export default adminOnly;
