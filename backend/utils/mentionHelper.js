const userDAO = require("../dao/userDAO");

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

// Validate mentions against existing users — không cần truyền User model từ ngoài vào
const validateMentions = async (mentions) => {
  if (!mentions || mentions.length === 0) return [];

  return await userDAO.findMany(
    { username: { $in: mentions } },
    { select: "_id username", lean: true }
  );
};

module.exports = {
  extractMentions,
  validateMentions,
};
