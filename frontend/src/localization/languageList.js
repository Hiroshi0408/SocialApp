export const languages = [
  { code: "en", label: "English", flag: "🇬🇧" },
  { code: "fr", label: "Français", flag: "🇫🇷" },
  { code: "jp", label: "日本語", flag: "🇯🇵" },
  { code: "vi", label: "Tiếng Việt", flag: "🇻🇳" },
  { code: "de", label: "Deutsch", flag: "🇩🇪" },
];

// Helper function để lấy tên ngôn ngữ theo code
export const getLanguageLabel = (code) => {
  const language = languages.find((lang) => lang.code === code);
  return language ? language.label : "Unknown";
};

// Helper function để lấy flag theo code
export const getLanguageFlag = (code) => {
  const language = languages.find((lang) => lang.code === code);
  return language ? language.flag : "🌐";
};
