const extractMentions = (text) => {
  if (!text) return [];

  const regex = /@([a-zA-Z0-9]([a-zA-Z0-9._]*[a-zA-Z0-9])?)/g;
  const mentions = [];
  let match;

  while ((match = regex.exec(text)) !== null) {
    const username = match[1].toLowerCase();
    if (!mentions.includes(username)) {
      mentions.push(username);
    }
  }

  return mentions;
};

// Remove duplicate mentions and validate against existing users
const validateMentions = async (mentions, User) => {
  if (!mentions || mentions.length === 0) return [];

  const users = await User.find({
    username: { $in: mentions },
  }).select("_id username");

  return users;
};

module.exports = {
  extractMentions,
  validateMentions,
};
