require("dotenv").config();

const mongoose = require("mongoose");
const Follow = require("../models/Follow");
const Friendship = require("../models/Friendship");
const FriendRequest = require("../models/FriendRequest");
const User = require("../models/User");
const logger = require("../utils/logger.js");

const toPairKey = (a, b) => `${a}_${b}`;

async function migrateMutualFollowsToFriends() {
  try {
    if (!process.env.MONGODB_URI) {
      throw new Error("MONGODB_URI is not defined in .env file");
    }

    logger.info("Connecting to MongoDB...");
    await mongoose.connect(process.env.MONGODB_URI);
    logger.info("Connected to MongoDB");

    logger.info("Finding mutual follow pairs...");
    const mutualPairs = await Follow.aggregate([
      {
        $project: {
          followerStr: { $toString: "$follower" },
          followingStr: { $toString: "$following" },
        },
      },
      {
        $project: {
          low: {
            $cond: [
              { $lt: ["$followerStr", "$followingStr"] },
              "$followerStr",
              "$followingStr",
            ],
          },
          high: {
            $cond: [
              { $lt: ["$followerStr", "$followingStr"] },
              "$followingStr",
              "$followerStr",
            ],
          },
        },
      },
      {
        $group: {
          _id: {
            low: "$low",
            high: "$high",
          },
          count: { $sum: 1 },
        },
      },
      {
        $match: {
          count: { $gte: 2 },
        },
      },
    ]);

    logger.info(`Found ${mutualPairs.length} mutual follow pairs`);

    if (mutualPairs.length === 0) {
      logger.info("No mutual follows found. Nothing to migrate.");
      await mongoose.connection.close();
      process.exit(0);
    }

    const existingFriendships = await Friendship.find({})
      .select("userA userB")
      .lean();
    const existingPairSet = new Set(
      existingFriendships.map((item) =>
        toPairKey(item.userA.toString(), item.userB.toString()),
      ),
    );

    const friendshipsToCreate = [];

    for (const pair of mutualPairs) {
      const low = pair._id.low;
      const high = pair._id.high;
      const key = toPairKey(low, high);

      if (!existingPairSet.has(key)) {
        friendshipsToCreate.push({
          userA: new mongoose.Types.ObjectId(low),
          userB: new mongoose.Types.ObjectId(high),
        });
      }
    }

    logger.info(`Need to create ${friendshipsToCreate.length} new friendships`);

    if (friendshipsToCreate.length > 0) {
      const friendshipOps = friendshipsToCreate.map((item) => ({
        updateOne: {
          filter: { userA: item.userA, userB: item.userB },
          update: { $setOnInsert: item },
          upsert: true,
        },
      }));

      const createResult = await Friendship.bulkWrite(friendshipOps, {
        ordered: false,
      });

      logger.info(
        `Friendship migration finished - inserted: ${createResult.upsertedCount || 0}`,
      );

      const requestOps = friendshipsToCreate.map((pair) => ({
        updateMany: {
          filter: {
            status: "pending",
            $or: [
              { fromUserId: pair.userA, toUserId: pair.userB },
              { fromUserId: pair.userB, toUserId: pair.userA },
            ],
          },
          update: {
            $set: {
              status: "canceled",
              respondedAt: new Date(),
            },
          },
        },
      }));

      const requestResult = await FriendRequest.bulkWrite(requestOps, {
        ordered: false,
      });
      logger.info(
        `Canceled ${requestResult.modifiedCount || 0} pending friend requests for migrated pairs`,
      );
    }

    logger.info("Recalculating friendsCount for all users...");
    await User.updateMany({}, { $set: { friendsCount: 0 } });

    const friendCounts = await Friendship.aggregate([
      {
        $project: {
          users: ["$userA", "$userB"],
        },
      },
      { $unwind: "$users" },
      {
        $group: {
          _id: "$users",
          count: { $sum: 1 },
        },
      },
    ]);

    if (friendCounts.length > 0) {
      const countOps = friendCounts.map((item) => ({
        updateOne: {
          filter: { _id: item._id },
          update: { $set: { friendsCount: item.count } },
        },
      }));

      await User.bulkWrite(countOps, { ordered: false });
    }

    logger.info(`Updated friendsCount for ${friendCounts.length} users`);
    logger.info("Migration completed successfully");

    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    logger.error("Mutual follow migration failed:", error.message);

    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.close();
    }

    process.exit(1);
  }
}

migrateMutualFollowsToFriends();
