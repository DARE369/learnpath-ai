import React, { useState } from "react";
import { useRouter } from "next/router";

export function LanguageSwitcher() {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);

  const languages = [
    { code: "en", name: "English" },
    { code: "yo", name: "Yorùbá" },
    { code: "fr", name: "Français" },
  ];

  const currentLanguage = languages.find((lang) => lang.code === router.locale);

  const handleLanguageChange = (langCode: string) => {
    router.push(router.asPath, router.asPath, { locale: langCode });
    setIsOpen(false);
    localStorage.setItem("preferredLanguage", langCode);
  };

  return (
    <div className="language-switcher">
      <button
        className="language-button"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-label="Switch language"
      >
        <span className="flag">{(currentLanguage?.code || "en").toUpperCase()}</span>
        <span className="label">{currentLanguage?.name}</span>
        <span className={`icon ${isOpen ? "open" : ""}`}>▼</span>
      </button>

      {isOpen && (
        <div className="language-menu" role="menu">
          {languages.map((lang) => (
            <button
              key={lang.code}
              className={`language-option ${lang.code === router.locale ? "active" : ""}`}
              onClick={() => handleLanguageChange(lang.code)}
              role="menuitem"
              aria-current={lang.code === router.locale ? "true" : "false"}
            >
              <span className="flag">{lang.code.toUpperCase()}</span>
              <span className="name">{lang.name}</span>
            </button>
          ))}
        </div>
      )}

      <style jsx>{`
        .language-switcher {
          position: relative;
          display: inline-block;
        }

        .language-button {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 12px;
          background: transparent;
          border: 1px solid #e5e7eb;
          border-radius: 6px;
          cursor: pointer;
          font-size: 14px;
          font-weight: 500;
          color: #1f2937;
          transition: all 0.2s;
        }

        .language-button:hover {
          background: #f3f4f6;
          border-color: #d1d5db;
        }

        .language-button:focus {
          outline: 2px solid #3b82f6;
          outline-offset: 2px;
        }

        .flag {
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.04em;
          opacity: 0.7;
        }

        .icon {
          display: inline-block;
          font-size: 10px;
          transition: transform 0.2s;
        }

        .icon.open {
          transform: rotate(180deg);
        }

        .language-menu {
          position: absolute;
          top: 100%;
          right: 0;
          margin-top: 4px;
          background: white;
          border: 1px solid #e5e7eb;
          border-radius: 6px;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
          z-index: 1000;
          min-width: 150px;
          animation: slideDown 0.2s ease-out;
        }

        @keyframes slideDown {
          from {
            opacity: 0;
            transform: translateY(-8px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .language-option {
          display: flex;
          align-items: center;
          gap: 8px;
          width: 100%;
          padding: 10px 12px;
          background: none;
          border: none;
          cursor: pointer;
          font-size: 14px;
          color: #6b7280;
          text-align: left;
          transition: all 0.2s;
        }

        .language-option:first-child {
          border-radius: 6px 6px 0 0;
        }

        .language-option:last-child {
          border-radius: 0 0 6px 6px;
        }

        .language-option:hover {
          background: #f3f4f6;
        }

        .language-option.active {
          background: #eff6ff;
          color: #3b82f6;
          font-weight: 600;
        }

        .language-option:focus {
          outline: 2px solid #3b82f6;
          outline-offset: -2px;
        }

        .name {
          flex: 1;
        }

        @media (max-width: 640px) {
          .label {
            display: none;
          }

          .language-button {
            padding: 8px;
          }
        }
      `}</style>
    </div>
  );
}
