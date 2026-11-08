(function initLanguages(globalScope) {
  "use strict";

  const namespace = globalScope.TranslatorExt || {};
  const { DEFAULTS } = namespace.CONSTANTS;

  const SUPPORTED_LANGUAGES = Object.freeze([
    Object.freeze({ code: "pt", label: "Português" }),
    Object.freeze({ code: "en", label: "Inglês" }),
    Object.freeze({ code: "es", label: "Espanhol" }),
    Object.freeze({ code: "fr", label: "Francês" }),
    Object.freeze({ code: "de", label: "Alemão" }),
    Object.freeze({ code: "it", label: "Italiano" }),
    Object.freeze({ code: "ja", label: "Japonês" }),
    Object.freeze({ code: "ko", label: "Coreano" }),
    Object.freeze({ code: "zh-CN", label: "Chinês Simplificado" }),
    Object.freeze({ code: "zh-TW", label: "Chinês Tradicional" }),
    Object.freeze({ code: "ru", label: "Russo" }),
    Object.freeze({ code: "ar", label: "Árabe" }),
    Object.freeze({ code: "nl", label: "Holandês" }),
    Object.freeze({ code: "pl", label: "Polonês" }),
    Object.freeze({ code: "tr", label: "Turco" }),
    Object.freeze({ code: "hi", label: "Hindi" })
  ]);

  const LANGUAGE_LABEL_BY_CODE = new Map(
    SUPPORTED_LANGUAGES.map((language) => [language.code.toLowerCase(), language.label])
  );

  function normalizeLanguageCode(rawCode) {
    if (!rawCode || typeof rawCode !== "string") {
      return DEFAULTS.BASE_LANGUAGE;
    }

    const trimmedCode = rawCode.trim();
    if (!trimmedCode) {
      return DEFAULTS.BASE_LANGUAGE;
    }

    if (trimmedCode.toLowerCase() === DEFAULTS.AUTO_LANGUAGE) {
      return DEFAULTS.AUTO_LANGUAGE;
    }

    const normalizedLower = trimmedCode.toLowerCase();
    if (normalizedLower === "zh-cn" || normalizedLower === "zh-hans") {
      return "zh-CN";
    }
    if (normalizedLower === "zh-tw" || normalizedLower === "zh-hant") {
      return "zh-TW";
    }

    const primarySubtag = normalizedLower.split(/[-_]/)[0];
    const matchedLanguage = SUPPORTED_LANGUAGES.find(
      (language) => language.code.toLowerCase() === primarySubtag
    );

    if (!matchedLanguage) {
      return primarySubtag || DEFAULTS.BASE_LANGUAGE;
    }

    return matchedLanguage.code;
  }

  function areSameLanguages(firstCode, secondCode) {
    if (!firstCode || !secondCode) {
      return false;
    }
    if (firstCode === DEFAULTS.AUTO_LANGUAGE || secondCode === DEFAULTS.AUTO_LANGUAGE) {
      return false;
    }
    return normalizeLanguageCode(firstCode) === normalizeLanguageCode(secondCode);
  }

  function getLanguageLabel(code) {
    if (!code || code === DEFAULTS.AUTO_LANGUAGE) {
      return "Detectar idioma";
    }

    const normalizedCode = normalizeLanguageCode(code);
    return LANGUAGE_LABEL_BY_CODE.get(normalizedCode.toLowerCase()) || normalizedCode.toUpperCase();
  }

  function resolveFallbackSecondaryLanguage(baseLanguage) {
    const normalizedBase = normalizeLanguageCode(baseLanguage);
    if (normalizedBase === DEFAULTS.SECONDARY_LANGUAGE_DEFAULT) {
      return DEFAULTS.SECONDARY_LANGUAGE_ALT;
    }
    return DEFAULTS.SECONDARY_LANGUAGE_DEFAULT;
  }

  namespace.Languages = Object.freeze({
    SUPPORTED_LANGUAGES,
    normalizeLanguageCode,
    areSameLanguages,
    getLanguageLabel,
    resolveFallbackSecondaryLanguage
  });

  globalScope.TranslatorExt = namespace;
})(typeof globalThis !== "undefined" ? globalThis : window);
