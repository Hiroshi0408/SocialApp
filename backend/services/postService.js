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
      // Pre-write contentHash + version SYNCHRONOUSLY trước khi fire tx, lý do:
      // mọi post mới đều có sub-doc onChain {registered:false, ...} mặc định
      // (Mongoose default), nên FE không thể phân biệt "post đang chờ register"
      // vs "post không liên quan blockchain" chỉ từ field `registered`. Set
      // contentHash + version ngay = signal cho FE biết post này có trong
      // tiến trình → hiện spinner; post không có contentHash → không spinner.
      const version = "v2";
      const contentHash = contentRegistryService.computeContentHash(post, {
        version,
        authorId: userId,
      });
      await postDAO.updateById(post._id, {
        "onChain.version": version,
        "onChain.contentHash": contentHash,
      });
      post.onChain = {
        ...(post.onChain?.toObject?.() || post.onChain || {}),
        version,
        contentHash,
      };

      contentRegistryService
        .registerPost(post._id.toString(), post, userId)
        .then(async ({ contentHash: confirmedHash, txHash, blockNumber, version: v }) => {
          await postDAO.updateById(post._id, {
            "onChain.registered": true,
            "onChain.version": v,
            "onChain.contentHash": confirmedHash,
            "onChain.txHash": txHash,
            "onChain.blockNumber": blockNumber,
          });
          logger.info(`Post ${post._id} registered on-chain (${v}): tx=${txHash}`);
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

  // ========== AUTO CHARITY POSTS ==========
  // BE tự đăng 3 loại post liên quan Charity Campaign:
  //   - kickoff:   khi org tạo xong campaign (recordCampaignCreate)
  //   - funded:    khi đạt mục tiêu (donate đẩy status OPEN→FUNDED)
  //   - milestone: khi admin unlock 1 milestone
  // Mọi post đều:
  // - Author = org owner (Post schema yêu cầu userId là User)
  // - Group = official group của org (member tự nhận noti qua group post flow)
  // - Bypass moderation/registerOnChain (data BE tự build, đã verified)
  // - Idempotent qua unique index (campaignId, kind, milestoneIdx)
  // - Fire noti type "auto_post" cho org owner để họ vào xem/edit caption

  // Helper: format số wei → "0.025 ETH" (4 chữ số thập phân)
  _formatEth(wei) {
    try {
      const n = parseFloat(ethers.formatEther(wei || "0"));
      if (Number.isNaN(n)) return "0 ETH";
      return `${n.toLocaleString("vi-VN", { maximumFractionDigits: 4 })} ETH`;
    } catch {
      return "0 ETH";
    }
  }

  // Helper: tạo post + tăng counter + fire noti cho owner — dùng chung 3 loại
  async _createAutoCampaignPost(campaign, org, { kind, milestoneIdx, caption }) {
    const post = await postDAO.create({
      userId: org.owner,
      groupId: org.groupId || null,
      image: campaign.coverImage || "",
      caption,
      campaignMilestoneRef: {
        campaignId: campaign._id,
        milestoneIdx: milestoneIdx ?? null,
        kind,
      },
    });

    await userDAO.incrementPostsCount(org.owner);

    // Noti cho org owner — text ngắn để FE render trực tiếp dòng tiêu đề
    const notiTextMap = {
      kickoff: `Đã đăng bài khởi động cho chiến dịch "${campaign.title}". Bạn có thể chỉnh sửa nếu cần.`,
      funded: `Chiến dịch "${campaign.title}" đã đạt mục tiêu — bài thông báo đã được đăng tự động.`,
      milestone: `Đã đăng bài cập nhật cột mốc cho "${campaign.title}". Bạn có thể chỉnh sửa nếu cần.`,
      completed: `Chiến dịch "${campaign.title}" đã hoàn tất — bài tổng kết đã được đăng tự động.`,
    };
    notificationService
      .createNotification({
        recipientId: org.owner,
        senderId: org.owner,
        type: "auto_post",
        targetType: "post",
        targetId: post._id,
        text: notiTextMap[kind] || "",
      })
      .catch((err) =>
        logger.error(`Auto-post notification failed (${kind}):`, err.message)
      );

    logger.info(
      `Auto post created kind=${kind} post=${post._id} campaign=${campaign._id}` +
        ` idx=${milestoneIdx ?? "null"} group=${org.groupId || "none"}`
    );
    return post;
  }

  // ─── Kickoff post ─── khi org tạo campaign thành công (onChain confirmed)
  async createAutoKickoffPost({ campaignId }) {
    const existing = await postDAO.findByCampaignEvent(campaignId, "kickoff");
    if (existing) {
      logger.info(
        `Auto kickoff post already exists: post=${existing._id} campaign=${campaignId}`
      );
      return existing;
    }

    const campaign = await campaignDAO.findById(campaignId);
    if (!campaign) throw new AppError("Campaign not found for kickoff post", 404);

    const org = await organizationDAO.findById(campaign.organizationId, { lean: true });
    if (!org) throw new AppError("Organization not found for kickoff post", 404);

    const goal = this._formatEth(campaign.goalWei);
    const deadlineStr = campaign.deadline
      ? new Date(campaign.deadline).toLocaleDateString("vi-VN", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
        })
      : "—";
    const milestoneCount = campaign.milestones?.length || 0;

    const lines = [
      `${org.name} vừa khởi động chiến dịch "${campaign.title}".`,
      ``,
      `Mục tiêu: ${goal}`,
      `Hạn đóng góp: ${deadlineStr}`,
      `Số cột mốc giải ngân: ${milestoneCount}`,
    ];
    if (campaign.description) {
      lines.push(``, campaign.description.trim().slice(0, 400));
    }
    lines.push(
      ``,
      `Mọi đóng góp được ghi nhận on-chain trên Sepolia và chỉ giải ngân theo từng cột mốc đã cam kết.`
    );

    return this._createAutoCampaignPost(campaign, org, {
      kind: "kickoff",
      milestoneIdx: null,
      caption: lines.join("\n"),
    });
  }

  // ─── Funded post ─── khi campaign đạt goal (recordDonation phát hiện status FUNDED)
  async createAutoFundedPost({ campaignId, txHash = null }) {
    const existing = await postDAO.findByCampaignEvent(campaignId, "funded");
    if (existing) {
      logger.info(
        `Auto funded post already exists: post=${existing._id} campaign=${campaignId}`
      );
      return existing;
    }

    const campaign = await campaignDAO.findById(campaignId);
    if (!campaign) throw new AppError("Campaign not found for funded post", 404);

    const org = await organizationDAO.findById(campaign.organizationId, { lean: true });
    if (!org) throw new AppError("Organization not found for funded post", 404);

    const goal = this._formatEth(campaign.goalWei);
    const raised = this._formatEth(campaign.raisedWei);
    const donors = campaign.donorsCount || 0;

    const lines = [
      `Chiến dịch "${campaign.title}" đã đạt mục tiêu ${goal}.`,
      ``,
      `Cảm ơn ${donors} người đã đóng góp tổng cộng ${raised}.`,
      `Quỹ sẽ được giải ngân theo từng cột mốc đã cam kết, mỗi đợt đều có báo cáo công khai.`,
    ];
    if (txHash) {
      const shortTx = `${txHash.slice(0, 10)}...${txHash.slice(-8)}`;
      lines.push(``, `Giao dịch đạt mục tiêu: ${shortTx}`);
    }

    return this._createAutoCampaignPost(campaign, org, {
      kind: "funded",
      milestoneIdx: null,
      caption: lines.join("\n"),
    });
  }

  // ─── Milestone post ─── khi admin unlock 1 milestone (legacy: tên cũ giữ nguyên)
  async createAutoMilestonePost({ campaignId, milestoneIdx, txHash }) {
    const existing = await postDAO.findByMilestoneRef(campaignId, milestoneIdx);
    if (existing) {
      logger.info(
        `Auto milestone post already exists: post=${existing._id} campaign=${campaignId} idx=${milestoneIdx}`
      );
      return existing;
    }

    const campaign = await campaignDAO.findById(campaignId);
    if (!campaign) throw new AppError("Campaign not found for auto post", 404);
    const milestone = campaign.milestones?.[milestoneIdx];
    if (!milestone) {
      throw new AppError("Milestone index out of range for auto post", 400);
    }

    const org = await organizationDAO.findById(campaign.organizationId, { lean: true });
    if (!org) throw new AppError("Organization not found for auto post", 404);

    const amount = this._formatEth(milestone.amountWei);
    const total = campaign.milestones.length;
    const unlockedCount = campaign.milestones.filter((m) => m.unlocked).length;
    const isFinal = unlockedCount === total;

    const lines = [
      `Cập nhật chiến dịch "${campaign.title}"`,
      `Cột mốc ${milestoneIdx + 1}/${total}: ${milestone.title}`,
      ``,
      `${org.name} vừa nhận ${amount} để thực hiện giai đoạn này.`,
    ];
    if (milestone.description) {
      lines.push(``, milestone.description.trim());
    }
    lines.push(``, `Đã hoàn thành ${unlockedCount}/${total} cột mốc.`);
    if (isFinal) {
      lines.push(`Toàn bộ quỹ đã được giải ngân — chiến dịch hoàn tất.`);
    }
    if (txHash) {
      const shortTx = `${txHash.slice(0, 10)}...${txHash.slice(-8)}`;
      lines.push(``, `Giao dịch giải ngân: ${shortTx}`);
    }

    return this._createAutoCampaignPost(campaign, org, {
      kind: "milestone",
      milestoneIdx,
      caption: lines.join("\n"),
    });
  }
}

module.exports = new PostService();
