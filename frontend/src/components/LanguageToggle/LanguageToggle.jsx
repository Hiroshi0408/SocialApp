import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import ReactCountryFlag from "react-country-flag";
import "./LanguageToggle.css";

const languages = [
  { code: "en", countryCode: "US", name: "English" },
  { code: "vi", countryCode: "VN", name: "Tiếng Việt" },
  { code: "jp", countryCode: "JP", name: "日本語" },
  { code: "de", countryCode: "DE", name: "Deutsch" },
  { code: "fr", countryCode: "FR", name: "Français" },
];

function LanguageToggle() {
  const { i18n } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);

  const changeLanguage = (lng) => {
    i18n.changeLanguage(lng);
    setIsOpen(false);
  };

  const toggleDropdown = () => {
    setIsOpen(!isOpen);
  };

  return (
    <div className="language-toggle">
      <button className="dropdown-toggle" onClick={toggleDropdown}>
        🌐 Language
      </button>
      {isOpen && (
        <div className="dropdown-menu">
          {languages.map((lang) => (
            <button
              key={lang.code}
              onClick={() => changeLanguage(lang.code)}
              className={`dropdown-item ${i18n.language === lang.code ? "active" : ""}`}
              title={lang.name}
            >
              <ReactCountryFlag
                countryCode={lang.countryCode}
                svg
                style={{
                  width: "20px",
                  height: "14px",
                  marginRight: "8px",
                }}
              />
              {lang.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default LanguageToggle;
