import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import en from "./locales/en.json";
import fr from "./locales/fr.json";
import de from "./locales/de.json";
import jp from "./locales/jp.json";
import vi from "./locales/vi.json";

const resources = {
  en: {
    translation: en,
  },
  fr: {
    translation: fr,
  },
  de: {
    translation: de,
  },
  jp: {
    translation: jp,
  },
  vi: {
    translation: vi,
  },
};

const LANGUAGE_KEY = "LANGUAGE";
const DEFAULT_LANGUAGE = "vi";

const languageDetector = {
  type: "languageDetector",
  async: true,
  init: () => {},
  detect: function (callback) {
    const language = localStorage.getItem(LANGUAGE_KEY);
    callback(language || DEFAULT_LANGUAGE);
  },
  cacheUserLanguage: function (language) {
    try {
      // Lưu vào localStorage
      localStorage.setItem(LANGUAGE_KEY, language);
    } catch (error) {
      console.error("Error saving language to localStorage:", error);
    }
  },
};

i18n
  .use(languageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: DEFAULT_LANGUAGE,
    interpolation: {
      escapeValue: false, // React đã escape XSS sẵn
    },
    react: {
      useSuspense: false, // Tắt suspense để tránh lỗi
    },
  });

export default i18n;
