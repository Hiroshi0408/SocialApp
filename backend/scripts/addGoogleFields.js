// Load environment variables TRƯỚC KHI require User model
require("dotenv").config();

const mongoose = require("mongoose");
const User = require("../models/User");

async function addGoogleFields() {
  try {
    // Check nếu MONGODB_URI không tồn tại
    if (!process.env.MONGODB_URI) {
      throw new Error("MONGODB_URI is not defined in .env file");
    }

    console.log("🔄 Connecting to MongoDB...");
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("✅ Connected to MongoDB");

    // Đếm số users cần update
    const usersToUpdate = await User.countDocuments({
      isGoogleAccount: { $exists: false },
    });

    console.log(`📊 Found ${usersToUpdate} users to update`);

    if (usersToUpdate === 0) {
      console.log("✅ All users already have Google fields");
      await mongoose.connection.close();
      process.exit(0);
    }

    // Update tất cả users hiện tại
    const result = await User.updateMany(
      { isGoogleAccount: { $exists: false } },
      {
        $set: {
          isGoogleAccount: false,
          firebaseUid: null,
        },
      },
    );

    console.log(`✅ Updated ${result.modifiedCount} users successfully`);

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

addGoogleFields();
