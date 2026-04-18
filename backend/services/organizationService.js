const organizationDAO = require("../dao/organizationDAO");
const groupDAO = require("../dao/groupDAO");
const AppError = require("../utils/AppError");
const logger = require("../utils/logger");

const POPULATE_OWNER = { path: "owner", select: "_id username fullName avatar" };
const POPULATE_VERIFIER = { path: "verifiedBy", select: "_id username fullName" };

// Format org cho FE — ẩn field admin-only khi viewer không phải owner/admin
const formatOrganization = (org, { isAdmin = false, isOwner = false } = {}) => {
  if (!org) return null;
  const base = {
    id: org._id,
    name: org.name,
    slug: org.slug,
    description: org.description,
    logo: org.logo,
    coverImage: org.coverImage,
    categories: org.categories || [],
    walletAddress: org.walletAddress,
    status: org.status,
    verifiedAt: org.verifiedAt,
    campaignsCount: org.campaignsCount || 0,
    totalRaised: org.totalRaised || "0",
    groupId: org.groupId || null,
    contactEmail: org.contactEmail || "",
    website: org.website || "",
    owner: org.owner,
    createdAt: org.createdAt,
  };

  if (isAdmin || isOwner) {
    base.proofDocuments = org.proofDocuments || [];
    base.rejectedReason = org.rejectedReason || "";
    base.verifiedBy = org.verifiedBy || null;
  }
  return base;
};

// slug từ name, thêm suffix random nếu đụng
const generateSlug = async (name) => {
  const base = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .substring(0, 60);

  if (!base) throw new AppError("Organization name is invalid for slug", 400);

  let slug = base;
  let tries = 0;
  while (await organizationDAO.findOne({ slug }, { lean: true })) {
    tries += 1;
    slug = `${base}-${Math.random().toString(36).slice(2, 7)}`;
    if (tries > 5) throw new AppError("Cannot generate unique slug", 500);
  }
  return slug;
};

const isValidEthAddress = (addr) =>
  typeof addr === "string" && /^0x[a-fA-F0-9]{40}$/.test(addr);

class OrganizationService {
  // User apply tạo Organization mới — status mặc định pending
  async apply(ownerId, data) {
    const {
      name,
      description = "",
      logo = "",
      coverImage = "",
      categories = [],
      walletAddress,
      proofDocuments = [],
      contactEmail = "",
      website = "",
    } = data;

    if (!name || !name.trim()) throw new AppError("Name is required", 400);
    if (!walletAddress) throw new AppError("Wallet address is required", 400);
    if (!isValidEthAddress(walletAddress))
      throw new AppError("Invalid wallet address format", 400);

    const walletLower = walletAddress.toLowerCase();

    // 1 ví chỉ map 1 org
    const existingWallet = await organizationDAO.findByWallet(walletLower, { lean: true });
    if (existingWallet) throw new AppError("Wallet already linked to another organization", 400);

    // 1 user chỉ có 1 org đang pending/verified (tránh spam apply)
    const existingOwner = await organizationDAO.findOne(
      { owner: ownerId, status: { $in: ["pending", "verified"] } },
      { lean: true }
    );
    if (existingOwner) throw new AppError("You already have an active organization", 400);

    const slug = await generateSlug(name);

    const org = await organizationDAO.create({
      name: name.trim(),
      slug,
      description: description.trim(),
      logo,
      coverImage,
      categories: Array.isArray(categories) ? categories : [],
      walletAddress: walletLower,
      proofDocuments: Array.isArray(proofDocuments) ? proofDocuments : [],
      contactEmail: contactEmail.trim(),
      website: website.trim(),
      owner: ownerId,
      status: "pending",
    });

    logger.info(`Organization apply - id=${org._id}, owner=${ownerId}`);
    return formatOrganization(org, { isOwner: true });
  }

  // Public list — default chỉ trả verified. Admin có thể filter status khác.
  async list(query = {}, viewer = {}) {
    const {
      status = "verified",
      category,
      limit: rawLimit = 20,
      page: rawPage = 1,
      search,
    } = query;

    const limit = Math.min(parseInt(rawLimit, 10) || 20, 50);
    const page = Math.max(parseInt(rawPage, 10) || 1, 1);
    const skip = (page - 1) * limit;

    // Guard: non-admin không được xem pending/rejected
    const effectiveStatus = viewer.isAdmin ? status : "verified";

    const filter = { status: effectiveStatus };
    if (category) filter.categories = category;
    if (search) filter.name = { $regex: search, $options: "i" };

    const [orgs, total] = await Promise.all([
      organizationDAO.findMany(filter, {
        limit,
        skip,
        populate: POPULATE_OWNER,
        lean: true,
      }),
      organizationDAO.count(filter),
    ]);

    return {
      organizations: orgs.map((o) => formatOrganization(o, { isAdmin: viewer.isAdmin })),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async getBySlug(slug, viewer = {}) {
    const org = await organizationDAO.findBySlug(slug, {
      populate: [POPULATE_OWNER, POPULATE_VERIFIER],
    });
    if (!org) throw new AppError("Organization not found", 404);

    const isOwner = viewer.userId && org.owner._id?.toString() === viewer.userId.toString();

    // Non-admin, non-owner chỉ xem được verified
    if (org.status !== "verified" && !isOwner && !viewer.isAdmin) {
      throw new AppError("Organization not found", 404);
    }

    return formatOrganization(org, { isAdmin: viewer.isAdmin, isOwner });
  }

  async getMine(ownerId) {
    const org = await organizationDAO.findOne(
      { owner: ownerId, status: { $in: ["pending", "verified", "rejected"] } },
      { populate: [POPULATE_OWNER, POPULATE_VERIFIER] }
    );
    if (!org) return null;
    return formatOrganization(org, { isOwner: true });
  }

  // Owner update — chỉ cho update field "mềm" khi pending.
  // Verified thì khoá name/wallet để admin không bị lừa sau verify.
  async update(ownerId, orgId, data) {
    const org = await organizationDAO.findById(orgId);
    if (!org) throw new AppError("Organization not found", 404);
    if (org.owner.toString() !== ownerId.toString())
      throw new AppError("Forbidden", 403);

    const patch = {};
    const softFields = ["description", "logo", "coverImage", "categories", "contactEmail", "website"];
    for (const key of softFields) {
      if (data[key] !== undefined) patch[key] = data[key];
    }

    // Field nhạy cảm chỉ update được khi status=pending
    if (org.status === "pending") {
      if (data.name !== undefined) patch.name = data.name.trim();
      if (data.walletAddress !== undefined) {
        if (!isValidEthAddress(data.walletAddress))
          throw new AppError("Invalid wallet address format", 400);
        const walletLower = data.walletAddress.toLowerCase();
        const dup = await organizationDAO.findByWallet(walletLower, { lean: true });
        if (dup && dup._id.toString() !== orgId.toString())
          throw new AppError("Wallet already linked to another organization", 400);
        patch.walletAddress = walletLower;
      }
      if (data.proofDocuments !== undefined) patch.proofDocuments = data.proofDocuments;
    }

    const updated = await organizationDAO.updateById(orgId, patch);
    return formatOrganization(updated, { isOwner: true });
  }

  // ==================== ADMIN ACTIONS ====================

  async adminList(query = {}) {
    return this.list(query, { isAdmin: true });
  }

  // Admin verify — auto-create official group chat cho org, link 2 chiều.
  // TODO(charity): khi Charity contract xong, gọi charityService.whitelistOrg(walletAddress).
  async verify(adminId, orgId) {
    const org = await organizationDAO.findById(orgId);
    if (!org) throw new AppError("Organization not found", 404);
    if (org.status === "verified") throw new AppError("Already verified", 400);

    // Tạo group chat official, creator = owner org
    const group = await groupDAO.create({
      name: `${org.name} - Official`,
      description: `Official community for ${org.name}`,
      image: org.logo || "",
      creator: org.owner,
      members: [org.owner],
      membersCount: 1,
      organizationId: org._id,
    });

    const updated = await organizationDAO.updateById(orgId, {
      status: "verified",
      verifiedAt: new Date(),
      verifiedBy: adminId,
      rejectedReason: "",
      groupId: group._id,
    });

    logger.info(`Organization verified - id=${orgId}, admin=${adminId}, group=${group._id}`);
    return formatOrganization(updated, { isAdmin: true });
  }

  async reject(adminId, orgId, reason = "") {
    const org = await organizationDAO.findById(orgId);
    if (!org) throw new AppError("Organization not found", 404);
    if (org.status === "verified")
      throw new AppError("Cannot reject a verified organization", 400);

    const updated = await organizationDAO.updateById(orgId, {
      status: "rejected",
      verifiedBy: adminId,
      rejectedReason: reason,
    });

    logger.info(`Organization rejected - id=${orgId}, admin=${adminId}`);
    return formatOrganization(updated, { isAdmin: true });
  }
}

module.exports = new OrganizationService();
