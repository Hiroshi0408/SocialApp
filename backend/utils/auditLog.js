/**
 * Best-effort audit logging.
 * If AuditLog model doesn't exist in your models folder, this becomes a no-op.
 */
const logAdminAction = async ({
  actorId,
  actorUsername,
  action,
  targetType,
  targetId,
  details = {},
  ip,
  userAgent,
}) => {
  try {
    // Optional dependency
    // eslint-disable-next-line global-require
    const AuditLog = require("../models/AuditLog");

    const entry = new AuditLog({
      actorId,
      actorUsername,
      action,
      targetType,
      targetId,
      details,
      ip,
      userAgent,
    });

    await entry.save();
  } catch (err) {
    // Intentionally ignore if model doesn't exist
  }
};

module.exports = { logAdminAction };
