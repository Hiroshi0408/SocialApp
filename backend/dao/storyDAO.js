const Story = require("../models/Story");

class StoryDAO {
  async findById(id, options = {}) {
    const { populate = "", lean = false } = options;
    let query = Story.findById(id);
    if (populate) query = query.populate(populate);
    if (lean) query = query.lean();
    return await query;
  }

  async findActive(filter = {}) {
    return await Story.find({
      ...filter,
      expiresAt: { $gt: new Date() },
    })
      .populate("userId", "username fullName avatar")
      .sort({ createdAt: -1 })
      .lean();
  }

  async findActiveByUser(userId) {
    return await Story.find({
      userId,
      expiresAt: { $gt: new Date() },
    })
      .populate("userId", "username fullName avatar")
      .sort({ createdAt: 1 })
      .lean();
  }

  async create(data) {
    const story = new Story(data);
    return await story.save();
  }

  async deleteById(id) {
    return await Story.findByIdAndDelete(id);
  }

  // Ghi nhận lượt xem — atomically, chỉ ghi nếu viewer chưa xem
  async recordView(storyId, viewerId) {
    return await Story.findOneAndUpdate(
      { _id: storyId, "viewers.userId": { $ne: viewerId } },
      {
        $push: { viewers: { userId: viewerId } },
        $inc: { viewsCount: 1 },
      },
      { new: true }
    );
  }

  async findWithViewers(storyId) {
    return await Story.findById(storyId).populate("viewers.userId", "username fullName avatar");
  }
}

module.exports = new StoryDAO();
