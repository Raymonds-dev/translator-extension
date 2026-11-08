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
    pt: /\b(o|a|os|as|um|uma|uns|umas|de|do|da|dos|das|em|no|na|nos|nas|por|pelo|pela|pelos|pelas|para|pra|com|sem|sob|sobre|que|se|como|mas|e|ou|já|mais|muito|muita|muitos|muitas|tudo|nada|algo|este|esta|esse|essa|isto|isso|aquilo|eu|você|ele|ela|nós|eles|elas|meu|minha|seu|sua|nosso|nossa|dele|dela|quem|qual|onde|quando|porque|porquê|aqui|ali|lá|agora|hoje|ontem|amanhã|bem|sempre|nunca|sim|não|olá|oi|bom|boa|obrigado|obrigada|fazer|estar|está|estão|ser|é|são|foi|era|vai|ter|tem|têm|tinha|há|pode|podem|também|então|ainda)\b|[áéíóúâêôãõç]/i,
    en: /\b(the|and|that|have|for|not|with|you|this|but|his|from|they|say|her|she|will|one|all|would|there|their|what|about|which|when|make|can|like|time|just|him|know|take|people|into|year|your|good|some|could|them|see|other|than|then|now|look|only|come|its|over|think|also|hello|world|is|are|was|were|been|has|had|do|does|did|to|in|on|at|by|of|it)\b/i,
    es: /\b(el|la|los|las|un|una|unos|unas|de|del|en|por|para|con|sin|sobre|que|si|como|pero|más|este|esta|esto|son|todo|también|muy|hacer|hola|gracias|buenos|días|noches|tardes|yo|tú|él|ella|nosotros|ellos|ellas|mi|tu|su|aquí|ahora|bien|siempre|nunca|estar|está|ser|es|fue|tener|tiene|hay|puede)\b|[áéíóúüñ¿¡]/i,
    fr: /\b(le|la|les|un|une|des|du|de|dans|en|pour|par|sur|avec|sans|sous|est|sont|que|qui|quoi|pas|plus|mais|comme|tout|tous|toute|cette|ce|cet|ces|nous|vous|ils|elles|bonjour|merci|être|avoir|fait|faire|aussi|bien|ici|maintenant)\b|[àâæçéèêëîïôœùûüÿ]/i,
    de: /\b(der|die|das|den|dem|des|ein|eine|einer|einem|einen|und|in|von|zu|mit|sich|auf|für|nicht|ist|sind|war|als|auch|es|an|werden|wird|aus|er|sie|hat|dass|nach|bei|um|am|noch|wie|über|danke|hallo|bitte|hier|jetzt|immer|gut)\b|[äöüß]/i,
    it: /\b(il|lo|la|i|gli|le|un|uno|una|del|dello|della|dei|degli|delle|che|non|per|con|su|tra|fra|sono|come|più|questo|questa|questi|queste|anche|tutto|tutti|molto|fare|fatto|ciao|grazie|buongiorno|buonasera|bene|essere|avere|qui|adesso)\b|[àèéìíîòóùú]/i
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
