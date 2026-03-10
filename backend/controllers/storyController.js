const Story = require("../models/Story");
const User = require("../models/User");
const { getTimeAgo } = require("../utils/timeHelper");

// Create new story
exports.createStory = async (req, res) => {
  try {
    const { image, caption } = req.body;
    const userId = req.user.id;

    if (!image) {
      return res.status(400).json({
        success: false,
        message: "Story image is required",
      });
    }

    const story = new Story({
      userId,
      image,
      caption: caption || "",
    });

    await story.save();
    await story.populate("userId", "username fullName avatar");

    console.log(`Story created by ${req.user.username}`);

    res.status(201).json({
      success: true,
      message: "Story created successfully",
      story: {
        ...story.toJSON(),
        user: story.userId,
        hasViewed: false,
        timestamp: "Just now",
      },
    });
  } catch (error) {
    console.error("Create story error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create story",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// Get all active stories
exports.getAllStories = async (req, res) => {
  try {
    const userId = req.user.id;

    // Get all active stories that haven't expired
    const stories = await Story.find({
      expiresAt: { $gt: new Date() },
      isActive: true,
    })
      .populate("userId", "username fullName avatar")
      .sort({ createdAt: -1 })
      .lean();

    // Group stories by user
    const storiesByUser = {};
    stories.forEach((story) => {
      const storyUserId = story.userId._id.toString();
      if (!storiesByUser[storyUserId]) {
        storiesByUser[storyUserId] = {
          user: story.userId,
          stories: [],
          hasUnviewed: false,
        };
      }

      const hasViewed = story.viewers.some(
        (viewer) => viewer.userId.toString() === userId
      );

      storiesByUser[storyUserId].stories.push({
        ...story,
        user: story.userId,
        hasViewed,
        timestamp: getTimeAgo(story.createdAt),
      });

      if (!hasViewed) {
        storiesByUser[storyUserId].hasUnviewed = true;
      }
    });

    // Convert to array and sort (users with unviewed stories first)
    const storyGroups = Object.values(storiesByUser).sort((a, b) => {
      if (a.hasUnviewed && !b.hasUnviewed) return -1;
      if (!a.hasUnviewed && b.hasUnviewed) return 1;
      return 0;
    });

    res.json({
      success: true,
      storyGroups,
    });
  } catch (error) {
    console.error("Get stories error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get stories",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// Get user's stories
exports.getUserStories = async (req, res) => {
  try {
    const { userId } = req.params;
    const currentUserId = req.user.id;

    const stories = await Story.find({
      userId,
      expiresAt: { $gt: new Date() },
      isActive: true,
    })
      .populate("userId", "username fullName avatar")
      .sort({ createdAt: 1 })
      .lean();

    const storiesWithMeta = stories.map((story) => ({
      ...story,
      user: story.userId,
      hasViewed: story.viewers.some(
        (viewer) => viewer.userId.toString() === currentUserId
      ),
      timestamp: getTimeAgo(story.createdAt),
    }));

    res.json({
      success: true,
      stories: storiesWithMeta,
    });
  } catch (error) {
    console.error("Get user stories error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get user stories",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// View story
exports.viewStory = async (req, res) => {
  try {
    const { storyId } = req.params;
    const userId = req.user.id;

    // Find the story to check author and existence first
    const story = await Story.findById(storyId, "userId viewers");
    if (!story) {
      return res.status(404).json({ success: false, message: "Story not found" });
    }

    // Don't count the author's own view
    if (story.userId.toString() === userId) {
      return res.json({
        success: true,
        message: "Author view not counted.",
        viewsCount: story.viewsCount
      });
    }

    // Atomically update the story if the user has not viewed it yet
    const updatedStory = await Story.findOneAndUpdate(
      { _id: storyId, "viewers.userId": { $ne: userId } },
      {
        $push: { viewers: { userId: userId } },
        $inc: { viewsCount: 1 },
      },
      { new: true }
    );

    res.json({
      success: true,
      message: "Story viewed",
      viewsCount: updatedStory ? updatedStory.viewsCount : story.viewsCount,
    });
  } catch (error) {
    console.error("View story error:", error);
    if (error.name === "ValidationError") {
      return res.status(400).json({ success: false, message: error.message });
    }
    res.status(500).json({
      success: false,
      message: "Failed to view story",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// Delete story
exports.deleteStory = async (req, res) => {
  try {
    const { storyId } = req.params;
    const userId = req.user.id;

    const story = await Story.findById(storyId);

    if (!story) {
      return res.status(404).json({
        success: false,
        message: "Story not found",
      });
    }

    if (story.userId.toString() !== userId.toString()) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to delete this story",
      });
    }

    await Story.findByIdAndDelete(storyId);

    res.json({
      success: true,
      message: "Story deleted successfully",
    });
  } catch (error) {
    console.error("Delete story error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete story",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// Get story viewers
exports.getStoryViewers = async (req, res) => {
  try {
    const { storyId } = req.params;
    const userId = req.user.id;

    const story = await Story.findById(storyId).populate(
      "viewers.userId",
      "username fullName avatar"
    );

    if (!story) {
      return res.status(404).json({
        success: false,
        message: "Story not found",
      });
    }

    const viewers = story.viewers.map((viewer) => ({
      user: viewer.userId,
      viewedAt: viewer.viewedAt,
    }));

    res.json({
      success: true,
      viewers,
      totalViews: story.viewsCount,
    });
  } catch (error) {
    console.error("Get story viewers error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get story viewers",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};
