const { body, param, query, validationResult } = require("express-validator");
const {
  MIN_PASSWORD_LENGTH,
  MAX_PASSWORD_LENGTH,
  MIN_USERNAME_LENGTH,
  MAX_USERNAME_LENGTH,
  MAX_BIO_LENGTH,
  MAX_CAPTION_LENGTH,
  MAX_COMMENT_LENGTH,
  MAX_FULLNAME_LENGTH,
  CHARITY_CATEGORIES,
  MAX_CHARITY_MILESTONES,
  MIN_CAMPAIGN_DURATION_DAYS,
  MAX_CAMPAIGN_DURATION_DAYS,
} = require("../constants");
const { ethers } = require("ethers");

// Middleware to handle validation errors
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: "Validation failed",
      errors: errors.array().reduce((acc, error) => {
        acc[error.path] = error.msg;
        return acc;
      }, {}),
    });
  }
  next();
};

// AUTH VALIDATIONS

const registerValidation = [
  body("username")
    .trim()
    .notEmpty()
    .withMessage("Username is required")
    .isLength({ min: MIN_USERNAME_LENGTH, max: MAX_USERNAME_LENGTH })
    .withMessage(
      `Username must be between ${MIN_USERNAME_LENGTH} and ${MAX_USERNAME_LENGTH} characters`,
    )
    .matches(/^[a-zA-Z0-9_]+$/)
    .withMessage("Username can only contain letters, numbers and underscores")
    .toLowerCase(),

  body("email")
    .trim()
    .notEmpty()
    .withMessage("Email is required")
    .isEmail()
    .withMessage("Please provide a valid email")
    .normalizeEmail(),

  body("password")
    .notEmpty()
    .withMessage("Password is required")
    .isLength({ min: MIN_PASSWORD_LENGTH, max: MAX_PASSWORD_LENGTH })
    .withMessage(
      `Password must be between ${MIN_PASSWORD_LENGTH} and ${MAX_PASSWORD_LENGTH} characters`,
    ),

  body("fullName")
    .trim()
    .notEmpty()
    .withMessage("Full name is required")
    .isLength({ max: MAX_FULLNAME_LENGTH })
    .withMessage(`Full name cannot exceed ${MAX_FULLNAME_LENGTH} characters`)
    .escape(),

  handleValidationErrors,
];

const loginValidation = [
  body("username")
    .trim()
    .notEmpty()
    .withMessage("Username or email is required"),

  body("password").notEmpty().withMessage("Password is required"),

  handleValidationErrors,
];

const googleLoginValidation = [
  body("googleToken")
    .trim()
    .notEmpty()
    .withMessage("Google token is required")
    .isLength({ min: 100 })
    .withMessage("Invalid Google token format"),

  body("email")
    .trim()
    .notEmpty()
    .withMessage("Email is required")
    .isEmail()
    .withMessage("Must be a valid email")
    .normalizeEmail(),

  body("displayName")
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage("Display name is too long"),

  body("photoURL")
    .optional()
    .trim()
    .isURL()
    .withMessage("Photo URL must be a valid URL"),

  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: errors.array()[0].msg,
        errors: errors.array(),
      });
    }
    next();
  },
];
// POST VALIDATIONS

const createPostValidation = [
  body("image")
    .optional({ values: "falsy" })
    .isURL()
    .withMessage("Image must be a valid URL"),

  body("video")
    .optional({ values: "falsy" })
    .isURL()
    .withMessage("Video must be a valid URL"),

  body("mediaType")
    .optional({ values: "falsy" })
    .isIn(["image", "video"])
    .withMessage("Media type must be image or video"),

  body("videoDuration")
    .optional({ values: "falsy" })
    .isNumeric()
    .withMessage("Video duration must be a number"),

  body("caption")
    .optional({ values: "falsy" })
    .trim()
    .isLength({ max: MAX_CAPTION_LENGTH })
    .withMessage(`Caption cannot exceed ${MAX_CAPTION_LENGTH} characters`)
    .escape(),

  body("location")
    .optional({ values: "falsy" })
    .trim()
    .isLength({ max: 100 })
    .withMessage("Location cannot exceed 100 characters")
    .escape(),

  handleValidationErrors,
];

const updatePostValidation = [
  param("id").isMongoId().withMessage("Invalid post ID"),

  body("caption")
    .optional()
    .trim()
    .isLength({ max: MAX_CAPTION_LENGTH })
    .withMessage(`Caption cannot exceed ${MAX_CAPTION_LENGTH} characters`)
    .escape(),

  body("location")
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage("Location cannot exceed 100 characters")
    .escape(),

  handleValidationErrors,
];

const addCommentValidation = [
  param("id").isMongoId().withMessage("Invalid post ID"),

  body("text")
    .trim()
    .notEmpty()
    .withMessage("Comment text is required")
    .isLength({ max: MAX_COMMENT_LENGTH })
    .withMessage(`Comment cannot exceed ${MAX_COMMENT_LENGTH} characters`)
    .escape(),

  body("parentCommentId")
    .optional()
    .isMongoId()
    .withMessage("Invalid parent comment ID"),

  handleValidationErrors,
];

// USER VALIDATIONS

const updateProfileValidation = [
  body("fullName")
    .optional()
    .trim()
    .isLength({ max: MAX_FULLNAME_LENGTH })
    .withMessage(`Full name cannot exceed ${MAX_FULLNAME_LENGTH} characters`)
    .escape(),

  body("bio")
    .optional()
    .trim()
    .isLength({ max: MAX_BIO_LENGTH })
    .withMessage(`Bio cannot exceed ${MAX_BIO_LENGTH} characters`)
    .escape(),

  body("website")
    .optional()
    .trim()
    .custom((value) => {
      if (value && value.length > 0) {
        // Allow empty string or valid URL
        const urlPattern =
          /^(https?:\/\/)?([\da-z\.-]+)\.([a-z\.]{2,6})([\/\w \.-]*)*\/?$/;
        if (!urlPattern.test(value)) {
          throw new Error("Please provide a valid website URL");
        }
      }
      return true;
    }),

  handleValidationErrors,
];

const uploadAvatarValidation = [
  body("avatar")
    .notEmpty()
    .withMessage("Avatar URL is required")
    .isURL()
    .withMessage("Avatar must be a valid URL"),

  handleValidationErrors,
];

const searchUsersValidation = [
  query("q")
    .trim()
    .notEmpty()
    .withMessage("Search query is required")
    .isLength({ min: 1, max: 100 })
    .withMessage("Search query must be between 1 and 100 characters"),

  handleValidationErrors,
];

const walletLoginValidation = [
  body("walletAddress")
    .notEmpty()
    .custom((value) => {
      if (!ethers.isAddress(value)) throw new Error("Invalid wallet address");
      return true;
    }),
  body("signature").notEmpty().withMessage("Signature is required"),
  body("message").notEmpty().withMessage("Message is required"),
  handleValidationErrors,
];
// CHARITY VALIDATIONS

// Goal/amount nhập dạng ETH (string thập phân, vd "0.5"). BE convert sang wei.
// Pattern chấp nhận tối đa 18 số thập phân (giới hạn của ether).
const ETH_AMOUNT_REGEX = /^\d+(\.\d{1,18})?$/;

const createCampaignValidation = [
  body("organizationId")
    .isMongoId()
    .withMessage("Invalid organization ID"),

  body("title")
    .trim()
    .notEmpty()
    .withMessage("Title is required")
    .isLength({ max: 200 })
    .withMessage("Title cannot exceed 200 characters"),

  body("description")
    .optional({ values: "falsy" })
    .trim()
    .isLength({ max: 5000 })
    .withMessage("Description cannot exceed 5000 characters"),

  body("coverImage")
    .optional({ values: "falsy" })
    .isURL()
    .withMessage("Cover image must be a valid URL"),

  body("category")
    .optional({ values: "falsy" })
    .isIn(CHARITY_CATEGORIES)
    .withMessage("Invalid category"),

  body("goalEth")
    .notEmpty()
    .withMessage("Goal is required")
    .matches(ETH_AMOUNT_REGEX)
    .withMessage("Goal must be a positive decimal number (ETH)"),

  body("durationDays")
    .notEmpty()
    .withMessage("Duration is required")
    .isInt({ min: MIN_CAMPAIGN_DURATION_DAYS, max: MAX_CAMPAIGN_DURATION_DAYS })
    .withMessage(
      `Duration must be between ${MIN_CAMPAIGN_DURATION_DAYS} and ${MAX_CAMPAIGN_DURATION_DAYS} days`
    ),

  body("milestones")
    .isArray({ min: 1, max: MAX_CHARITY_MILESTONES })
    .withMessage(`Milestones must be 1-${MAX_CHARITY_MILESTONES} items`),

  body("milestones.*.title")
    .trim()
    .notEmpty()
    .withMessage("Milestone title is required")
    .isLength({ max: 200 })
    .withMessage("Milestone title cannot exceed 200 characters"),

  body("milestones.*.description")
    .optional({ values: "falsy" })
    .trim()
    .isLength({ max: 1000 })
    .withMessage("Milestone description cannot exceed 1000 characters"),

  body("milestones.*.amountEth")
    .notEmpty()
    .withMessage("Milestone amount is required")
    .matches(ETH_AMOUNT_REGEX)
    .withMessage("Milestone amount must be a positive decimal number (ETH)"),

  handleValidationErrors,
];

// recordCampaign: kế thừa shape của createCampaign + thêm txHash
const recordCampaignValidation = [
  ...createCampaignValidation.slice(0, -1), // bỏ handleValidationErrors cuối cùng
  body("txHash")
    .notEmpty()
    .withMessage("txHash is required")
    .matches(/^0x[a-fA-F0-9]{64}$/)
    .withMessage("Invalid txHash format"),
  handleValidationErrors,
];

const recordDonationValidation = [
  param("id").isMongoId().withMessage("Invalid campaign ID"),

  body("onChainCampaignId")
    .exists({ checkNull: true })
    .withMessage("onChainCampaignId is required")
    .isInt({ min: 0 })
    .withMessage("onChainCampaignId must be a non-negative integer"),

  body("txHash")
    .notEmpty()
    .withMessage("txHash is required")
    .matches(/^0x[a-fA-F0-9]{64}$/)
    .withMessage("Invalid txHash format"),

  handleValidationErrors,
];

const listCampaignsValidation = [
  query("status")
    .optional()
    .isIn(["OPEN", "FUNDED", "EXECUTING", "COMPLETED", "FAILED", "REFUNDED"])
    .withMessage("Invalid status"),
  query("category")
    .optional()
    .isIn(CHARITY_CATEGORIES)
    .withMessage("Invalid category"),
  query("organizationId")
    .optional()
    .isMongoId()
    .withMessage("Invalid organization ID"),
  query("page").optional().isInt({ min: 1 }).withMessage("page must be >= 1"),
  query("limit").optional().isInt({ min: 1, max: 50 }).withMessage("limit 1-50"),
  query("sort")
    .optional()
    .isIn(["newest", "ending-soon", "most-funded"])
    .withMessage("Invalid sort"),
  handleValidationErrors,
];

const recordRefundValidation = [
  param("id").isMongoId().withMessage("Invalid campaign ID"),

  body("onChainCampaignId")
    .exists({ checkNull: true })
    .withMessage("onChainCampaignId is required")
    .isInt({ min: 0 })
    .withMessage("onChainCampaignId must be a non-negative integer"),

  body("txHash")
    .notEmpty()
    .withMessage("txHash is required")
    .matches(/^0x[a-fA-F0-9]{64}$/)
    .withMessage("Invalid txHash format"),

  handleValidationErrors,
];

// ── Charity admin validations ──

const unlockMilestoneValidation = [
  param("id").isMongoId().withMessage("Invalid campaign ID"),
  param("idx").isInt({ min: 0 }).withMessage("Milestone index must be a non-negative integer"),
  body("reportPostId")
    .optional({ nullable: true })
    .isMongoId()
    .withMessage("reportPostId must be a valid Mongo ID"),
  handleValidationErrors,
];

const whitelistOrgValidation = [
  body("orgId").isMongoId().withMessage("orgId must be a valid Mongo ID"),
  handleValidationErrors,
];

// PARAM VALIDATIONS

const mongoIdValidation = [
  param("id").isMongoId().withMessage("Invalid ID"),
  handleValidationErrors,
];

const userIdValidation = [
  param("userId").isMongoId().withMessage("Invalid user ID"),
  handleValidationErrors,
];

const conversationIdValidation = [
  param("conversationId").isMongoId().withMessage("Invalid conversation ID"),
  handleValidationErrors,
];

const postIdValidation = [
  param("postId").isMongoId().withMessage("Invalid post ID"),
  handleValidationErrors,
];

const storyIdValidation = [
  param("storyId").isMongoId().withMessage("Invalid story ID"),
  handleValidationErrors,
];

module.exports = {
  // Auth
  registerValidation,
  loginValidation,
  googleLoginValidation,
  walletLoginValidation,

  // Post
  createPostValidation,
  updatePostValidation,
  addCommentValidation,

  // User
  updateProfileValidation,
  uploadAvatarValidation,
  searchUsersValidation,

  // Charity
  createCampaignValidation,
  recordCampaignValidation,
  recordDonationValidation,
  recordRefundValidation,
  listCampaignsValidation,
  unlockMilestoneValidation,
  whitelistOrgValidation,

  // Common
  mongoIdValidation,
  userIdValidation,
  conversationIdValidation,
  postIdValidation,
  storyIdValidation,
  handleValidationErrors,
};
