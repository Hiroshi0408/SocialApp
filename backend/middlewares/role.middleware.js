/**
 * Role-based access control middleware
 * Usage: requireRole("admin") or requireRole("admin","mod")
 */
const requireRole = (...roles) => {
  const allowed = new Set(roles.map((r) => String(r).toLowerCase()));

  return (req, res, next) => {
    const role = String(req.user?.role || "user").toLowerCase();

    if (!allowed.has(role)) {
      return res.status(403).json({
        success: false,
        message: "Forbidden: insufficient permissions",
      });
    }

    next();
  };
};

module.exports = { requireRole };
