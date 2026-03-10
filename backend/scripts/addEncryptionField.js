// Load environment variables
require("dotenv").config();

const mongoose = require("mongoose");
const Message = require("../models/Message");

async function addEncryptionField() {
  try {
    if (!process.env.MONGODB_URI) {
      throw new Error("MONGODB_URI is not defined in .env file");
    }

    console.log("🔄 Connecting to MongoDB...");
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("✅ Connected to MongoDB");

    // Đếm số messages cần update
    const messagesToUpdate = await Message.countDocuments({
      isEncrypted: { $exists: false },
    });

    console.log(`📊 Found ${messagesToUpdate} messages to update`);

    if (messagesToUpdate === 0) {
      console.log("✅ All messages already have encryption field");
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

    console.log(`✅ Updated ${result.modifiedCount} messages successfully`);
    console.log("ℹ️  Old messages are marked as non-encrypted");
    console.log("ℹ️  New messages will be encrypted by default");

    // Close connection
    await mongoose.connection.close();
    console.log("👋 Database connection closed");

    process.exit(0);
  } catch (error) {
    console.error("❌ Migration failed:", error.message);

    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.close();
    }

    process.exit(1);
  }
}

addEncryptionField();
