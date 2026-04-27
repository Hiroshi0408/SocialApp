const { ethers } = require("ethers");
const postDAO = require("../dao/postDAO");
const likeDAO = require("../dao/likeDAO");
const saveDAO = require("../dao/saveDAO");
const userDAO = require("../dao/userDAO");
const commentDAO = require("../dao/commentDAO");
const followDAO = require("../dao/followDAO");
const friendDAO = require("../dao/friendDAO");
const notificationDAO = require("../dao/notificationDAO");
const groupDAO = require("../dao/groupDAO");
const campaignDAO = require("../dao/campaignDAO");
const organizationDAO = require("../dao/organizationDAO");
const notificationService = require("./notificationService");
const AppError = require("../utils/AppError");
const logger = require("../utils/logger");
const { getTimeAgo } = require("../utils/timeHelper");
const { validateMentions } = require("../utils/mentionHelper");
const { formatPostsWithMetadata } = require("../helpers/postHelper");
const { moderateText } = require("./geminiModeration");
const contentRegistryService = require("./contentRegistryService");

const SEPOLIA_ETHERSCAN_BASE = "https://sepolia.etherscan.io";
const {
  DEFAULT_POST_LIMIT,
  MAX_POST_LIMIT,
  DEFAULT_COMMENT_LIMIT,
} = require("../constants");

class PostService {
  // ========== FEED ==========

  async getFeed(userId, query = {}) {
    const page = parseInt(query.page) || 1;
    const limit = Math.min(
      parseInt(query.limit) || DEFAULT_POST_LIMIT,
      MAX_POST_LIMIT,
    );
    const skip = (page - 1) * limit;
    const scope = query.scope === "friends" ? "friends" : "following";

    let targetUserIds = [];

    if (scope === "friends") {
      targetUserIds = await friendDAO.findFriendIds(userId);
    } else {
      targetUserIds = await followDAO.findFollowingIds(userId);
    }

    // Bao gồm bài của chính mình
    targetUserIds.push(userId);

    // Feed Home loại bỏ post trong group — bài group chỉ hiện ở GroupDetail
    const filter = { userId: { $in: targetUserIds }, groupId: null };
    const populate = { path: "userId", select: "username fullName avatar" };

    const [posts, total] = await Promise.all([
      postDAO.findMany(filter, { populate, skip, limit, lean: true }),
      postDAO.count(filter),
    ]);

    const postIds = posts.map((p) => p._id);
    const [likes, saves] = await Promise.all([
      likeDAO.findByUserAndTargets(userId, postIds, "post"),
      saveDAO.findByUserAndPosts(userId, postIds),
    ]);

    const likedSet = new Set(likes.map((l) => l.targetId.toString()));
    const savedSet = new Set(saves.map((s) => s.postId.toString()));

    return {
      posts: formatPostsWithMetadata(posts, likedSet, savedSet),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasMore: skip + posts.length < total,
      },
    };
  }

  async getAllPosts(userId, query = {}) {
    const page = parseInt(query.page) || 1;
    const limit = Math.min(
      parseInt(query.limit) || DEFAULT_POST_LIMIT,
      MAX_POST_LIMIT,
    );
    const skip = (page - 1) * limit;
    const populate = { path: "userId", select: "username fullName avatar" };

    const filter = { groupId: null };
    const [posts, total] = await Promise.all([
      postDAO.findMany(filter, { populate, skip, limit, lean: true }),
      postDAO.count(filter),
    ]);

    const postIds = posts.map((p) => p._id);
    const [likes, saves] = await Promise.all([
      likeDAO.findByUserAndTargets(userId, postIds, "post"),
      saveDAO.findByUserAndPosts(userId, postIds),
    ]);

    const likedSet = new Set(likes.map((l) => l.targetId.toString()));
    const savedSet = new Set(saves.map((s) => s.postId.toString()));

    return {
      posts: formatPostsWithMetadata(posts, likedSet, savedSet),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasMore: skip + posts.length < total,
      },
    };
  }

  async getUserPosts(userId, currentUserId, query = {}) {
    const page = parseInt(query.page) || 1;
    const limit = Math.min(
      parseInt(query.limit) || DEFAULT_POST_LIMIT,
      MAX_POST_LIMIT,
    );
    const skip = (page - 1) * limit;
    const populate = { path: "userId", select: "username fullName avatar" };

    // Profile không hiện bài group (nội bộ group)
    const filter = { userId, groupId: null };
    const [posts, total] = await Promise.all([
      postDAO.findMany(filter, { populate, skip, limit, lean: true }),
      postDAO.count(filter),
    ]);

    const postIds = posts.map((p) => p._id);
    const [likes, saves] = await Promise.all([
      likeDAO.findByUserAndTargets(currentUserId, postIds, "post"),
      saveDAO.findByUserAndPosts(currentUserId, postIds),
    ]);

    const likedSet = new Set(likes.map((l) => l.targetId.toString()));
    const savedSet = new Set(saves.map((s) => s.postId.toString()));

    return {
      posts: formatPostsWithMetadata(posts, likedSet, savedSet),
      pagination: { page, limit, total, hasMore: skip + posts.length < total },
    };
  }

  async getGroupFeed(groupId, userId, query = {}) {
    const group = await groupDAO.findById(groupId, { lean: true });
    if (!group) throw new AppError("Group not found", 404);

    const isMember = group.members.some(
      (m) => m.toString() === userId.toString(),
    );
    if (!isMember) {
      throw new AppError("Only group members can view posts", 403);
    }

    const page = parseInt(query.page) || 1;
    const limit = Math.min(
      parseInt(query.limit) || DEFAULT_POST_LIMIT,
      MAX_POST_LIMIT,
    );
    const skip = (page - 1) * limit;
    const populate = { path: "userId", select: "username fullName avatar" };

    const filter = { groupId };
    const [posts, total] = await Promise.all([
      postDAO.findMany(filter, { populate, skip, limit, lean: true }),
      postDAO.count(filter),
    ]);

    const postIds = posts.map((p) => p._id);
    const [likes, saves] = await Promise.all([
      likeDAO.findByUserAndTargets(userId, postIds, "post"),
      saveDAO.findByUserAndPosts(userId, postIds),
    ]);

    const likedSet = new Set(likes.map((l) => l.targetId.toString()));
    const savedSet = new Set(saves.map((s) => s.postId.toString()));

    return {
      posts: formatPostsWithMetadata(posts, likedSet, savedSet),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasMore: skip + posts.length < total,
      },
    };
  }

  // ========== SINGLE POST ==========

  async getPostById(postId, currentUserId) {
    const post = await postDAO.findById(postId, {
      populate: { path: "userId", select: "username fullName avatar" },
    });

    if (!post) {
      throw new AppError("Post not found", 404);
    }

    // Post trong group riêng — chỉ member mới xem được. Giữ privacy đúng
    // với feed loại bỏ groupId: người ngoài không lẻn được qua URL trực tiếp.
    if (post.groupId) {
      const isMember = await groupDAO.isMember(post.groupId, currentUserId);
      if (!isMember) {
        throw new AppError("Only group members can view this post", 403);
      }
    }

    const [like, save, commentsData] = await Promise.all([
      likeDAO.findOne({
        userId: currentUserId,
        targetId: postId,
        targetType: "post",
      }),
      saveDAO.findOne({ userId: currentUserId, postId }),
      commentDAO.findByPost(postId, { limit: DEFAULT_COMMENT_LIMIT }),
    ]);

    const formattedComments = commentsData.map((c) => ({
      ...c,
      user: c.userId,
      timestamp: getTimeAgo(c.createdAt),
    }));

    return {
      ...post.toJSON(),
      user: post.userId,
      likes: post.likesCount,
      comments: post.commentsCount,
      isLiked: !!like,
      isSaved: !!save,
      timestamp: getTimeAgo(post.createdAt),
      commentsList: formattedComments,
    };
  }

  // ========== CRUD ==========

  async createPost(userId, data) {
    const {
      image,
      video,
      mediaType,
      videoDuration,
      caption,
      location,
      taggedUsers,
      registerOnChain,
      groupId,
    } = data;

    if (!image && !video) {
      throw new AppError("Image or video is required", 400);
    }

    // Nếu post vào group → bắt buộc user phải là member
    if (groupId) {
      const isMember = await groupDAO.isMember(groupId, userId);
      if (!isMember) {
        throw new AppError("You must join the group before posting", 403);
      }
    }

    if (caption && caption.trim()) {
      const moderation = await moderateText(caption);
      if (!moderation.allowed) {
        throw new AppError("Caption violates community guidelines", 400, {
          moderation: {
            verdict: moderation.verdict,
            reasons: moderation.reasons,
            categories: moderation.categories,
          },
        });
      }
    }

    const post = await postDAO.create({
      userId,
      groupId: groupId || null,
      image: image || "",
      video: video || "",
      mediaType: mediaType || (video ? "video" : "image"),
      videoDuration: videoDuration || 0,
      caption: caption || "",
      location: location || "",
      taggedUsers: taggedUsers || [],
      // mentions và hashtags tự động extract từ caption bởi pre-save hook trong Post model
    });

    await userDAO.incrementPostsCount(userId);

    // Đóng dấu on-chain nếu user chọn — fire-and-forget không block response
    // Dùng fire-and-forget vì tx Sepolia có thể mất 10-30s, không nên bắt user chờ
    if (registerOnChain === true) {
      contentRegistryService
        .registerPost(post._id.toString(), post, userId)
        .then(async ({ contentHash, txHash, blockNumber, version }) => {
          await postDAO.updateById(post._id, {
            "onChain.registered": true,
            "onChain.version": version,
            "onChain.contentHash": contentHash,
            "onChain.txHash": txHash,
            "onChain.blockNumber": blockNumber,
          });
          logger.info(`Post ${post._id} registered on-chain (${version}): tx=${txHash}`);
        })
        .catch((err) =>
          logger.error(`On-chain registration failed for post ${post._id}:`, err.message),
        );
    }

    await post.populate({ path: "userId", select: "username fullName avatar" });

    // Mention notifications (fire-and-forget)
    if (post.mentions && post.mentions.length > 0) {
      const mentionedUsers = await validateMentions(post.mentions);
      for (const mentionedUser of mentionedUsers) {
        if (mentionedUser._id.toString() !== userId.toString()) {
          notificationService
            .createNotification({
              recipientId: mentionedUser._id,
              senderId: userId,
              type: "mention",
              targetType: "post",
              targetId: post._id,
              text: (caption || "").substring(0, 100),
            })
            .catch((err) =>
              logger.error("Mention notification failed:", err.message),
            );
        }
      }
    }

    if (post.taggedUsers && post.taggedUsers.length > 0) {
      for (const taggedUserId of post.taggedUsers) {
        if (taggedUserId.toString() !== userId.toString()) {
          notificationService
            .createNotification({
              recipientId: taggedUserId,
              senderId: userId,
              type: "mention",
              targetType: "post",
              targetId: post._id,
            })
            .catch((err) =>
              logger.error("Tag notification failed:", err.message),
            );
        }
      }
    }

    return post;
  }

  async updatePost(postId, userId, data) {
    const post = await postDAO.findById(postId);

    if (!post) {
      throw new AppError("Post not found", 404);
    }

    if (post.userId.toString() !== userId.toString()) {
      throw new AppError("You are not authorized to update this post", 403);
    }

    const { caption, location, taggedUsers } = data;

    if (caption !== undefined && caption && caption.trim()) {
      const moderation = await moderateText(caption);
      if (!moderation.allowed) {
        throw new AppError("Caption violates community guidelines", 400, {
          moderation: {
            verdict: moderation.verdict,
            reasons: moderation.reasons,
            categories: moderation.categories,
          },
        });
      }
    }

    if (caption !== undefined) post.caption = caption;
    if (location !== undefined) post.location = location;
    if (taggedUsers !== undefined) post.taggedUsers = taggedUsers;

    await post.save();
    await post.populate({ path: "userId", select: "username fullName avatar" });

    return post;
  }

  async deletePost(postId, userId) {
    const post = await postDAO.findById(postId);

    if (!post) {
      throw new AppError("Post not found", 404);
    }

    if (post.userId.toString() !== userId.toString()) {
      throw new AppError("You are not authorized to delete this post", 403);
    }

    await postDAO.softDeleteById(postId);

    await Promise.all([
      commentDAO.softDeleteMany({ postId, deleted: false }),
      likeDAO.deleteManyByTarget(postId, "post"),
      saveDAO.deleteByPostId(postId),
      notificationDAO.deleteMany({ targetId: postId, targetType: "post" }),
      userDAO.decrementPostsCount(userId),
    ]);
  }

  // ========== LIKE ==========

  async toggleLike(postId, userId) {
    const post = await postDAO.findById(postId);

    if (!post) {
      throw new AppError("Post not found", 404);
    }

    const existingLike = await likeDAO.findOne({
      userId,
      targetId: postId,
      targetType: "post",
    });

    if (existingLike) {
      await likeDAO.deleteById(existingLike._id);
      await postDAO.decrementLikesCount(postId);
      // Xóa notification like
      await notificationDAO.deleteOne({
        senderId: userId,
        targetId: postId,
        type: "like",
      });

      return { isLiked: false, likesCount: Math.max(0, post.likesCount - 1) };
    } else {
      try {
        await likeDAO.create({ userId, targetId: postId, targetType: "post" });
      } catch (error) {
        if (error.code === 11000) {
          return { isLiked: true, likesCount: post.likesCount };
        }
        throw error;
      }

      await postDAO.incrementLikesCount(postId);

      notificationService
        .createNotification({
          recipientId: post.userId,
          senderId: userId,
          type: "like",
          targetType: "post",
          targetId: postId,
        })
        .catch((err) => logger.error("Like notification failed:", err.message));

      return { isLiked: true, likesCount: post.likesCount + 1 };
    }
  }

  // ========== SEARCH / TAGGED ==========

  async searchByHashtag(userId, query = {}) {
    const { q } = query;

    if (!q || q.trim().length === 0) {
      throw new AppError("Search query is required", 400);
    }

    const page = parseInt(query.page) || 1;
    const limit = Math.min(
      parseInt(query.limit) || DEFAULT_POST_LIMIT,
      MAX_POST_LIMIT,
    );
    const skip = (page - 1) * limit;

    let searchTag = q.trim().toLowerCase();
    if (!searchTag.startsWith("#")) searchTag = "#" + searchTag;

    // Hashtag search chỉ trả post public, không lộ bài group
    const filter = { hashtags: searchTag, groupId: null };
    const populate = { path: "userId", select: "username fullName avatar" };

    const [posts, total] = await Promise.all([
      postDAO.findMany(filter, { populate, skip, limit, lean: true }),
      postDAO.count(filter),
    ]);

    const postIds = posts.map((p) => p._id);
    const [likes, saves] = await Promise.all([
      likeDAO.findByUserAndTargets(userId, postIds, "post"),
      saveDAO.findByUserAndPosts(userId, postIds),
    ]);

    const likedSet = new Set(likes.map((l) => l.targetId.toString()));
    const savedSet = new Set(saves.map((s) => s.postId.toString()));

    return {
      hashtag: searchTag,
      posts: formatPostsWithMetadata(posts, likedSet, savedSet),
      pagination: { page, limit, total, hasMore: skip + posts.length < total },
    };
  }

  async getTaggedPosts(targetUserId, currentUserId, query = {}) {
    const page = parseInt(query.page) || 1;
    const limit = Math.min(
      parseInt(query.limit) || DEFAULT_POST_LIMIT,
      MAX_POST_LIMIT,
    );
    const skip = (page - 1) * limit;

    // Tagged posts page không lộ bài group (post group chỉ hiện trong GroupDetail)
    const filter = { taggedUsers: targetUserId, groupId: null };
    const populate = [
      { path: "userId", select: "username fullName avatar" },
      { path: "taggedUsers", select: "username fullName avatar" },
    ];

    const [posts, total] = await Promise.all([
      postDAO.findMany(filter, { populate, skip, limit, lean: true }),
      postDAO.count(filter),
    ]);

    const postIds = posts.map((p) => p._id);
    const [likes, saves] = await Promise.all([
      likeDAO.findByUserAndTargets(currentUserId, postIds, "post"),
      saveDAO.findByUserAndPosts(currentUserId, postIds),
    ]);

    const likedSet = new Set(likes.map((l) => l.targetId.toString()));
    const savedSet = new Set(saves.map((s) => s.postId.toString()));

    return {
      posts: formatPostsWithMetadata(posts, likedSet, savedSet),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasMore: skip + posts.length < total,
      },
    };
  }

  // ========== AUTO MILESTONE POST ==========
  // Tự build + đăng 1 post báo cáo khi Charity unlock 1 milestone. Caller là
  // charityService.unlockMilestone — chỉ gọi khi admin KHÔNG truyền reportPostId
  // thủ công. Idempotent qua unique index (campaignId, milestoneIdx) ở Post model.
  // - Author = org owner (Post yêu cầu userId là User, chưa có khái niệm "post của Org")
  // - Group = official group của org (auto-spawn khi org verified) → member nhận
  //   noti tự nhiên qua group post flow, không cần noti type mới.
  // - Skip moderation: nội dung do BE tự build từ data đã verified, không có UGC.
  // - Skip ContentRegistry: caption đã embed unlockTxHash → user verify được,
  //   tránh tốn gas Sepolia gấp đôi cho mỗi milestone.
  async createAutoMilestonePost({ campaignId, milestoneIdx, txHash }) {
    // 1. Idempotent — milestone đã có auto-post → trả về luôn
    const existing = await postDAO.findByMilestoneRef(campaignId, milestoneIdx);
    if (existing) {
      logger.info(
        `Auto milestone post already exists: post=${existing._id} campaign=${campaignId} idx=${milestoneIdx}`
      );
      return existing;
    }

    // 2. Re-fetch để lấy state mới nhất (markMilestoneUnlocked đã chạy trước đó)
    const campaign = await campaignDAO.findById(campaignId);
    if (!campaign) throw new AppError("Campaign not found for auto post", 404);
    const milestone = campaign.milestones?.[milestoneIdx];
    if (!milestone) {
      throw new AppError("Milestone index out of range for auto post", 400);
    }

    // 3. Lấy org để biết owner + officialGroupId
    const org = await organizationDAO.findById(campaign.organizationId, {
      lean: true,
    });
    if (!org) {
      throw new AppError("Organization not found for auto post", 404);
    }

    // 4. Build caption từ data có sẵn — tiếng Việt vì user app chính là VN
    let amountEth = "0";
    try {
      amountEth = ethers.formatEther(milestone.amountWei || "0");
    } catch {
      // Nếu amountWei lạ/không parse được, vẫn cho post chạy với "0"
      amountEth = "0";
    }
    const total = campaign.milestones.length;
    const unlockedCount = campaign.milestones.filter((m) => m.unlocked).length;
    const txUrl = `${SEPOLIA_ETHERSCAN_BASE}/tx/${txHash}`;

    const lines = [
      `🎯 ${campaign.title} — Milestone ${milestoneIdx + 1} hoàn thành`,
      ``,
      `Tổ chức vừa nhận ${amountEth} ETH cho giai đoạn: ${milestone.title}`,
    ];
    if (milestone.description) {
      lines.push(``, milestone.description);
    }
    lines.push(
      ``,
      `📊 Tiến độ: ${unlockedCount}/${total} milestone hoàn thành`,
      `🔗 Xem on-chain: ${txUrl}`,
      ``,
      `#milestone #charity`
    );
    const caption = lines.join("\n");

    // 5. Tạo post trực tiếp qua DAO — bypass createPost service để skip
    //    moderation/registerOnChain/membership check. Owner luôn là member của
    //    official group của chính họ (Group.creator = owner khi auto-spawn).
    const post = await postDAO.create({
      userId: org.owner,
      groupId: org.groupId || null,
      image: campaign.coverImage || "",
      caption,
      campaignMilestoneRef: {
        campaignId: campaign._id,
        milestoneIdx,
      },
    });

    await userDAO.incrementPostsCount(org.owner);

    logger.info(
      `Auto milestone post created: post=${post._id} campaign=${campaignId} idx=${milestoneIdx} group=${
        org.groupId || "none"
      }`
    );
    return post;
  }
}

module.exports = new PostService();
