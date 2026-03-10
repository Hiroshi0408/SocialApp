// Load environment variables
require("dotenv").config();

const mongoose = require("mongoose");
const crypto = require("crypto");
const Message = require("../models/Message");
const Conversation = require("../models/Conversation");

const ENCRYPTION_ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

async function generateConversationKey(conversationId, userId1, userId2) {
  const sortedUsers = [userId1, userId2].sort();
  const keyMaterial = `${conversationId}-${sortedUsers[0]}-${sortedUsers[1]}`;

  return crypto.createHash("sha256").update(keyMaterial).digest();
}

function encryptMessage(message, key) {
  if (!message || typeof message !== "string") {
    return message; // Return as-is if not a valid string
  }

  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ENCRYPTION_ALGORITHM, key, iv);

  const encryptedBuffer = Buffer.concat([
    cipher.update(message, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  const combined = Buffer.concat([iv, encryptedBuffer, authTag]);
  return combined.toString("base64");
}

// --- Main Script ---

async function encryptOldMessages() {
  if (!process.env.MONGODB_URI) {
    throw new Error("MONGODB_URI is not defined in .env file");
  }

  let connection;
  try {
    connection = await mongoose.connect(process.env.MONGODB_URI);
    const messagesToEncrypt = await Message.find({
      isEncrypted: { $ne: true },
      content: { $ne: "[Message deleted]", $ne: null, $ne: "" },
    }).populate("conversationId");

    if (messagesToEncrypt.length === 0) {
      return;
    }

    let successCount = 0;
    let errorCount = 0;

    for (const message of messagesToEncrypt) {
      try {
        const conversation = message.conversationId;
        if (
          !conversation ||
          !conversation.participants ||
          conversation.participants.length < 2
        ) {
          console.warn(
            `Skipping message ${message._id}: Cannot find valid conversation or participants.`,
          );
          errorCount++;
          continue;
        }

        const [user1, user2] = conversation.participants;

        // 1. Generate the correct key for this conversation
        const key = await generateConversationKey(
          conversation._id,
          user1,
          user2,
        );

        // 2. Encrypt content and mediaUrl
        const encryptedContent = encryptMessage(message.content, key);
        const encryptedMediaUrl = encryptMessage(message.mediaUrl, key);

        // 3. Update the message in the database
        await Message.updateOne(
          { _id: message._id },
          {
            $set: {
              content: encryptedContent,
              mediaUrl: encryptedMediaUrl,
              isEncrypted: true,
            },
          },
        );
        successCount++;
      } catch (err) {
        errorCount++;
      }
    }
  } catch (error) {
    process.exitCode = 1;
  } finally {
    if (connection) {
      await mongoose.connection.close();
    }
  }
}

encryptOldMessages().catch((e) => {
  console.error("Unhandled exception in script:", e);
  process.exit(1);
});
