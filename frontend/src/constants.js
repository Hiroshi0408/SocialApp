export const DEFAULT_IMAGES = {
  AVATAR:
    "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='150' height='150'%3E%3Crect fill='%23cccccc' width='150' height='150'/%3E%3Ctext fill='%23666666' font-family='Arial' font-size='48' x='50%25' y='50%25' text-anchor='middle' dominant-baseline='middle'%3EUser%3C/text%3E%3C/svg%3E",
};

export const POST_LIMITS = {
  CAPTION_MAX_LENGTH: 2200,
  LOCATION_MAX_LENGTH: 100,
};

export const FILE_LIMITS = {
  IMAGE_MAX_SIZE: 5 * 1024 * 1024,
  IMAGE_MAX_SIZE_MB: 5,
};

export const API_DEFAULTS = {
  PAGINATION: {
    DEFAULT_PAGE: 1,
    NOTIFICATIONS_PER_PAGE: 20,
    POSTS_PER_PAGE: 10,
    USERS_PER_PAGE: 20,
    USER_POSTS_PER_PAGE: 12,
    COMMENTS_PER_PAGE: 20,
    FOLLOWERS_PER_PAGE: 20,
    FOLLOWING_PER_PAGE: 20,
    MESSAGES_PER_PAGE: 50,
    SUGGESTIONS_LIMIT: 5,
    SEARCH_RESULTS_PER_PAGE: 20,
  },
};