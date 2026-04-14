const User = require("../models/User");
const crypto = require("crypto");

class UserDAO {
  // ==================== FIND ====================

  async findOne(filter, options = {}) {
    const { select = "", populate = "", lean = false } = options;

    let query = User.findOne(filter);

    if (select) query = query.select(select);
    if (populate) query = query.populate(populate);
    if (lean) query = query.lean();

    return await query.exec();
  }

  async findById(id, options = {}) {
    const { select = "", populate = "", lean = false } = options;

    let query = User.findById(id);

    if (select) query = query.select(select);
    if (populate) query = query.populate(populate);
    if (lean) query = query.lean();

    return await query.exec();
  }

  async findMany(filter, options = {}) {
    const {
      select = "",
      populate = "",
      lean = false,
      sort = { createdAt: -1 },
      limit = 20,
      skip = 0,
    } = options;

    let query = User.find(filter).sort(sort).skip(skip).limit(limit);

    if (select) query = query.select(select);
    if (populate) query = query.populate(populate);
    if (lean) query = query.lean();

    return await query.exec();
  }

  async findByIdWithPassword(id) {
    return await User.findById(id).select("+password").exec();
  }

  async findByUsernameOrEmail(identifier) {
    return await User.findOne({
      $or: [
        { username: identifier.toLowerCase() },
        { email: identifier.toLowerCase() },
      ],
      deleted: false,
      status: "active",
    })
      .select("+password")
      .exec();
  }

  async findByEmail(email) {
    return await User.findOne({
      email: email.toLowerCase(),
      deleted: false,
      status: "active",
    }).exec();
  }

  async findByUsername(username) {
    return await User.findOne({ username: username.toLowerCase() }).exec();
  }

  async findByFirebaseUid(uid) {
    return await User.findOne({ firebaseUid: uid }).exec();
  }

  async findByVerificationToken(rawToken) {
    const hashedToken = crypto
      .createHash("sha256")
      .update(rawToken)
      .digest("hex");

    return await User.findOne({
      emailVerificationToken: hashedToken,
      emailVerificationExpires: { $gt: Date.now() },
    })
      .select("+emailVerificationToken +emailVerificationExpires")
      .exec();
  }

  async findByResetToken(rawToken) {
    const hashedToken = crypto
      .createHash("sha256")
      .update(rawToken)
      .digest("hex");

    return await User.findOne({
      passwordResetToken: hashedToken,
      passwordResetExpires: { $gt: Date.now() },
    })
      .select("+password +passwordResetToken +passwordResetExpires")
      .exec();
  }

  async existsByUsername(username) {
    return await User.exists({ username: username.toLowerCase() });
  }

  async existsByEmail(email) {
    return await User.exists({ email: email.toLowerCase() });
  }

  // ==================== CREATE ====================

  async createUser(data) {
    const user = new User(data);
    return await user.save();
  }

  // ==================== UPDATE ====================

  async updateById(id, data, options = {}) {
    const { new: returnNew = true, runValidators = true } = options;

    return await User.findByIdAndUpdate(id, data, {
      new: returnNew,
      runValidators,
    }).exec();
  }

  async updateOne(filter, data, options = {}) {
    const { new: returnNew = true, runValidators = true } = options;

    return await User.findOneAndUpdate(filter, data, {
      new: returnNew,
      runValidators,
    }).exec();
  }

  async softDeleteById(id) {
    return await User.findByIdAndUpdate(
      id,
      { deleted: true, deletedAt: new Date(), status: "suspended" },
      { new: true },
    ).exec();
  }

  // ==================== TOKEN HELPERS ====================

  async saveVerificationToken(userId, rawToken) {
    const hashedToken = crypto
      .createHash("sha256")
      .update(rawToken)
      .digest("hex");

    const expires = Date.now() + 24 * 60 * 60 * 1000; // 24h

    await User.findByIdAndUpdate(userId, {
      emailVerificationToken: hashedToken,
      emailVerificationExpires: expires,
    }).exec();
  }

  async clearVerificationToken(userId) {
    await User.findByIdAndUpdate(userId, {
      $unset: {
        emailVerificationToken: 1,
        emailVerificationExpires: 1,
      },
      isEmailVerified: true,
    }).exec();
  }

  async savePasswordResetToken(userId, rawToken) {
    const hashedToken = crypto
      .createHash("sha256")
      .update(rawToken)
      .digest("hex");

    await User.findByIdAndUpdate(userId, {
      passwordResetToken: hashedToken,
      passwordResetExpires: Date.now() + 60 * 60 * 1000, // 1h
    }).exec();
  }

  async clearPasswordResetToken(userId) {
    await User.findByIdAndUpdate(userId, {
      $unset: {
        passwordResetToken: 1,
        passwordResetExpires: 1,
      },
    }).exec();
  }

  // ==================== COUNTER HELPERS ====================

  async incrementPostsCount(userId) {
    return await User.findByIdAndUpdate(
      userId,
      { $inc: { postsCount: 1 } },
      { new: true },
    ).exec();
  }

  async decrementPostsCount(userId) {
    return await User.findByIdAndUpdate(
      userId,
      { $inc: { postsCount: -1 } },
      { new: true },
    ).exec();
  }

  async incrementFollowCounters(followerId, followingId) {
    await Promise.all([
      User.findByIdAndUpdate(followerId, { $inc: { followingCount: 1 } }),
      User.findByIdAndUpdate(followingId, { $inc: { followersCount: 1 } }),
    ]);
  }

  async decrementFollowCounters(followerId, followingId) {
    // Dùng $max để đảm bảo counter không bao giờ xuống dưới 0
    await Promise.all([
      User.findByIdAndUpdate(followerId, [
        {
          $set: {
            followingCount: { $max: [0, { $subtract: ["$followingCount", 1] }] },
          },
        },
      ]),
      User.findByIdAndUpdate(followingId, [
        {
          $set: {
            followersCount: { $max: [0, { $subtract: ["$followersCount", 1] }] },
          },
        },
      ]),
    ]);
  }

  async incrementFriendsCount(userId, session = null) {
    const update = { $inc: { friendsCount: 1 } };
    const opts = { new: true, ...(session ? { session } : {}) };
    return await User.findByIdAndUpdate(userId, update, opts).exec();
  }

  async decrementFriendsCount(userId, session = null) {
    // Dùng $max để đảm bảo counter không bao giờ xuống dưới 0
    const update = [
      { $set: { friendsCount: { $max: [0, { $subtract: ["$friendsCount", 1] }] } } },
    ];
    const opts = { new: true, ...(session ? { session } : {}) };
    return await User.findByIdAndUpdate(userId, update, opts).exec();
  }

  // ==================== COUNT ====================

  async count(filter) {
    return await User.countDocuments(filter);
  }
}

module.exports = new UserDAO();
