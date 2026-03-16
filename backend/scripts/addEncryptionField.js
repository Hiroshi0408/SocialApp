// Load environment variables
require("dotenv").config();

const mongoose = require("mongoose");
const Message = require("../models/Message");
const logger = require("../utils/logger.js");

async function addEncryptionField() {
  try {
    if (!process.env.MONGODB_URI) {
      throw new Error("MONGODB_URI is not defined in .env file");
    }

    logger.info("🔄 Connecting to MongoDB...");
    await mongoose.connect(process.env.MONGODB_URI);
    logger.info("✅ Connected to MongoDB");

    // Đếm số messages cần update
    const messagesToUpdate = await Message.countDocuments({
      isEncrypted: { $exists: false },
    });

    logger.info(`📊 Found ${messagesToUpdate} messages to update`);

    if (messagesToUpdate === 0) {
      logger.info("✅ All messages already have encryption field");
      await mongoose.connection.close();
      process.exit(0);
    }

    // Update tất cả messages cũ - đánh dấu là KHÔNG mã hóa
    const result = await Message.updateMany(
      { isEncrypted: { $exists: false } },
      {
        $set: {
          isEncrypted: false, // Messages cũ không được mã hóa
        },
      },
    );

    logger.info(`✅ Updated ${result.modifiedCount} messages successfully`);
    logger.info("ℹ️  Old messages are marked as non-encrypted");
    logger.info("ℹ️  New messages will be encrypted by default");

    // Close connection
    await mongoose.connection.close();
    logger.info("👋 Database connection closed");

    process.exit(0);
  } catch (error) {
    logger.error("❌ Migration failed:", error.message);

    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.close();
    }

    process.exit(1);
  }
}

addEncryptionField();
