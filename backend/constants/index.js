// ==================== AUTHENTICATION ====================
const JWT_EXPIRATION = "7d"; // 7 days
const JWT_REFRESH_EXPIRATION = "30d"; // 30 days for refresh token

// ==================== PAGINATION ====================
const DEFAULT_PAGE_SIZE = 10;
const MAX_PAGE_SIZE = 100;
const DEFAULT_POST_LIMIT = 10;
const MAX_POST_LIMIT = 50;
const DEFAULT_USER_LIMIT = 20;
const MAX_USER_LIMIT = 100;
const DEFAULT_COMMENT_LIMIT = 20;
const MAX_COMMENT_LIMIT = 100;
const DEFAULT_SUGGESTED_USERS_LIMIT = 5;

// ==================== RATE LIMITING ====================
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const RATE_LIMIT_MAX_REQUESTS = 1000; // max 1000 requests per window
const LOGIN_RATE_LIMIT_MAX = 5; // max 5 login attempts per 15 min
const REGISTER_RATE_LIMIT_MAX = 3; // max 3 register attempts per 15 min

// ==================== VALIDATION ====================
const MIN_PASSWORD_LENGTH = 6;
const MAX_PASSWORD_LENGTH = 128;
const MIN_USERNAME_LENGTH = 3;
const MAX_USERNAME_LENGTH = 30;
const MAX_BIO_LENGTH = 150;
const MAX_CAPTION_LENGTH = 2200;
const MAX_COMMENT_LENGTH = 500;
const MAX_FULLNAME_LENGTH = 50;
const MAX_COMMENT_DEPTH = 3;

// ==================== FILE UPLOAD ====================
const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
];
const CLOUDINARY_FOLDER = "social-app";
const DEFAULT_AVATAR_URL = "/images/default-avatar.png";

// ==================== USER ====================
const USER_STATUS = {
  ACTIVE: "active",
  SUSPENDED: "suspended",
};

// ==================== LIKE TARGET TYPES ====================
const LIKE_TARGET_TYPES = {
  POST: "post",
  COMMENT: "comment",
};

// ==================== CHARITY ====================
// Phải khớp thứ tự enum Status trong contracts/Charity.sol (uint8)
const CHARITY_STATUS_NAMES = [
  "OPEN",
  "FUNDED",
  "EXECUTING",
  "COMPLETED",
  "FAILED",
  "REFUNDED",
];
const CHARITY_CATEGORIES = [
  "education",
  "medical",
  "disaster",
  "animal",
  "other",
];
const MAX_CHARITY_MILESTONES = 10; // khớp MAX_MILESTONES trong contract
// Min 2: chống case "1 milestone gom 100% goal" — pattern scam phổ biến.
// Max 50%: buộc có ít nhất 2 mốc thực sự, không lệch về 1 mốc lớn.
// Cả 2 cũng được enforce trong contract (Charity.sol) khi redeploy.
const MIN_CHARITY_MILESTONES = 2;
const MAX_MILESTONE_PERCENT = 50;
const MIN_CAMPAIGN_DURATION_DAYS = 1;
const MAX_CAMPAIGN_DURATION_DAYS = 90;
const DEFAULT_CAMPAIGN_LIMIT = 12;
const MAX_CAMPAIGN_LIMIT = 50;
const DEFAULT_DONATION_LIMIT = 20;
const MAX_DONATION_LIMIT = 100;

module.exports = {
  // Auth
  JWT_EXPIRATION,
  JWT_REFRESH_EXPIRATION,

  // Pagination
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  DEFAULT_POST_LIMIT,
  MAX_POST_LIMIT,
  DEFAULT_USER_LIMIT,
  MAX_USER_LIMIT,
  DEFAULT_COMMENT_LIMIT,
  MAX_COMMENT_LIMIT,
  DEFAULT_SUGGESTED_USERS_LIMIT,

  // Rate Limiting
  RATE_LIMIT_WINDOW_MS,
  RATE_LIMIT_MAX_REQUESTS,
  LOGIN_RATE_LIMIT_MAX,
  REGISTER_RATE_LIMIT_MAX,

  // Validation
  MIN_PASSWORD_LENGTH,
  MAX_PASSWORD_LENGTH,
  MIN_USERNAME_LENGTH,
  MAX_USERNAME_LENGTH,
  MAX_BIO_LENGTH,
  MAX_CAPTION_LENGTH,
  MAX_COMMENT_LENGTH,
  MAX_FULLNAME_LENGTH,
  MAX_COMMENT_DEPTH,

  // File Upload
  MAX_FILE_SIZE,
  ALLOWED_IMAGE_TYPES,
  CLOUDINARY_FOLDER,
  DEFAULT_AVATAR_URL,

  // Enums
  USER_STATUS,
  LIKE_TARGET_TYPES,

  // Charity
  CHARITY_STATUS_NAMES,
  CHARITY_CATEGORIES,
  MAX_CHARITY_MILESTONES,
  MIN_CHARITY_MILESTONES,
  MAX_MILESTONE_PERCENT,
  MIN_CAMPAIGN_DURATION_DAYS,
  MAX_CAMPAIGN_DURATION_DAYS,
  DEFAULT_CAMPAIGN_LIMIT,
  MAX_CAMPAIGN_LIMIT,
  DEFAULT_DONATION_LIMIT,
  MAX_DONATION_LIMIT,
};
