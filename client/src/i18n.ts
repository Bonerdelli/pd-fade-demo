import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import chat from "./locales/en/chat.json";
import common from "./locales/en/common.json";
import graph from "./locales/en/graph.json";
import map from "./locales/en/map.json";

void i18n.use(initReactI18next).init({
  lng: "en",
  fallbackLng: "en",
  defaultNS: "common",
  ns: ["common", "chat", "graph", "map"],
  resources: {
    en: {
      common,
      chat,
      graph,
      map,
    },
  },
  interpolation: {
    escapeValue: false,
  },
});

export default i18n;
