const mongoose = require("mongoose");
const logger = require("../utils/logger.js");

const connectDatabase = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI);

    logger.info(`MongoDB Connected: ${conn.connection.host}`);
    logger.info(`Database Name: ${conn.connection.name}`);
  } catch (error) {
    logger.error("MongoDB Connection Error:", error.message);
    process.exit(1);
  }
};

module.exports = connectDatabase;
