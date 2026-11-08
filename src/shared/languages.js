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

  const LANGUAGE_PATTERNS = Object.freeze({
    pt: /\b(não|você|para|com|uma|está|são|isso|muito|também|então|porque|quando|onde|fazer|obrigado|olá|bom|dia|noite|tradução|palavra)\b|[ãõç]/i,
    en: /\b(the|and|that|have|for|not|with|you|this|but|his|from|they|say|her|she|will|one|all|would|there|their|what|about|which|when|make|can|like|time|just|him|know|take|people|into|year|your|good|some|could|them|see|other|than|then|now|look|only|come|its|over|think|also|hello|world)\b/i,
    es: /\b(que|para|como|pero|más|este|esta|esto|son|por|una|con|del|los|las|todo|también|muy|hacer|hola|gracias|buenos|días)\b|[ñ¿¡]/i,
    fr: /\b(les|des|est|pour|dans|une|que|pas|plus|avec|sur|sont|mais|comme|tout|cette|nous|vous|bonjour|merci|être)\b|[œæ]/i,
    de: /\b(der|die|das|und|in|den|von|zu|mit|sich|auf|für|nicht|ist|dem|als|auch|es|an|werden|aus|er|hat|dass|sie|nach|wird|bei|einer|um|am|sind|noch|wie|einem|über|einen|danke|hallo)\b|[äöüß]/i,
    it: /\b(che|non|per|una|con|del|della|sono|come|più|questo|questa|anche|tutto|molto|fare|ciao|grazie|buongiorno)\b/i
  });

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

  function detectLanguageLocally(text, baseLanguage = DEFAULTS.BASE_LANGUAGE, secondaryLanguage = DEFAULTS.SECONDARY_LANGUAGE_DEFAULT) {
    const sample = typeof text === "string" ? text.trim() : "";
    if (!sample) {
      return normalizeLanguageCode(secondaryLanguage || DEFAULTS.SECONDARY_LANGUAGE_DEFAULT);
    }

    if (/[\u3040-\u30ff]/.test(sample)) {
      return "ja";
    }
    if (/[\uac00-\ud7af]/.test(sample)) {
      return "ko";
    }
    if (/[\u4e00-\u9fff]/.test(sample)) {
      return "zh-CN";
    }
    if (/[\u0400-\u04ff]/.test(sample)) {
      return "ru";
    }
    if (/[\u0600-\u06ff]/.test(sample)) {
      return "ar";
    }
    if (/[\u0900-\u097f]/.test(sample)) {
      return "hi";
    }

    let bestLang = null;
    let bestScore = 0;

    for (const [langCode, regex] of Object.entries(LANGUAGE_PATTERNS)) {
      const globalRegex = new RegExp(regex.source, "gi");
      const matches = sample.match(globalRegex);
      const count = matches ? matches.length : 0;
      if (count > bestScore) {
        bestScore = count;
        bestLang = langCode;
      }
    }

    if (bestLang) {
      return bestLang;
    }

    const normalizedBase = normalizeLanguageCode(baseLanguage);
    const normalizedSecondary = normalizeLanguageCode(secondaryLanguage || resolveFallbackSecondaryLanguage(normalizedBase));
    return normalizedSecondary;
  }

  namespace.Languages = Object.freeze({
    SUPPORTED_LANGUAGES,
    normalizeLanguageCode,
    areSameLanguages,
    getLanguageLabel,
    resolveFallbackSecondaryLanguage,
    detectLanguageLocally
  });

  globalScope.TranslatorExt = namespace;
})(typeof globalThis !== "undefined" ? globalThis : window);
