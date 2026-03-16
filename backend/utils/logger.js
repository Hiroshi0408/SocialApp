let logger;

try {
  const { createLogger, format, transports } = require("winston");

  logger = createLogger({
    level: process.env.LOG_LEVEL || "info",
    format: format.combine(
      format.timestamp(),
      format.errors({ stack: true }),
      format.splat(),
      format.json(),
    ),
    transports: [new transports.Console()],
  });
} catch (error) {
  const { format: utilFormat } = require("util");

  const writeLine = (stream, level, args) => {
    const message = utilFormat(...args);
    stream.write(`[${level}] ${message}\n`);
  };

  // Fallback for environments where winston is not installed yet.
  logger = {
    info: (...args) => writeLine(process.stdout, "info", args),
    warn: (...args) => writeLine(process.stdout, "warn", args),
    error: (...args) => writeLine(process.stderr, "error", args),
  };
}

module.exports = logger;
