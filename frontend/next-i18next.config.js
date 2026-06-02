const path = require("path");

module.exports = {
  i18n: {
    defaultLocale: "en",
    locales: ["en", "yo", "fr"],
    localeDetection: true,
  },
  ns: [
    "common",
    "dashboard",
    "learning",
    "quiz",
    "auth",
    "navigation",
    "errors",
    "success",
    "settings",
  ],
  defaultNS: "common",
  localePath: path.resolve("./public/locales"),
  load: "currentOnly",
  react: {
    useSuspense: false,
  },
  detection: {
    order: ["path", "localStorage", "navigator"],
    caches: ["localStorage"],
  },
};
