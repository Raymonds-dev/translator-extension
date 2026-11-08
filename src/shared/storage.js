(function initStorage(globalScope) {
  "use strict";

  const namespace = globalScope.TranslatorExt || {};
  const { STORAGE_KEYS, DEFAULTS, LIMITS, THEMES } = namespace.CONSTANTS;
  const { normalizeLanguageCode, resolveFallbackSecondaryLanguage, areSameLanguages } = namespace.Languages;

  function detectBrowserBaseLanguage() {
    if (typeof browser !== "undefined" && browser.i18n && typeof browser.i18n.getUILanguage === "function") {
      return normalizeLanguageCode(browser.i18n.getUILanguage());
    }
    if (typeof navigator !== "undefined" && navigator.language) {
      return normalizeLanguageCode(navigator.language);
    }
    return DEFAULTS.BASE_LANGUAGE;
  }

  function clampModalOpacity(value) {
    const numeric = Number(value);
    if (Number.isNaN(numeric)) {
      return DEFAULTS.MODAL_OPACITY;
    }
    return Math.min(
      LIMITS.MAX_MODAL_OPACITY,
      Math.max(LIMITS.MIN_MODAL_OPACITY, Math.round(numeric * 100) / 100)
    );
  }

  function normalizeTheme(themeValue) {
    return themeValue === THEMES.LIGHT ? THEMES.LIGHT : THEMES.DARK;
  }

  function getStorageArea() {
    if (typeof browser !== "undefined" && browser.storage && browser.storage.local) {
      return browser.storage.local;
    }
    return null;
  }

  async function getUserPreferences() {
    const defaultBaseLanguage = detectBrowserBaseLanguage();
    const defaultSecondaryLanguage = resolveFallbackSecondaryLanguage(defaultBaseLanguage);

    const fallbackPreferences = {
      [STORAGE_KEYS.API_KEY]: DEFAULTS.API_KEY,
      [STORAGE_KEYS.BASE_LANGUAGE]: defaultBaseLanguage,
      [STORAGE_KEYS.LAST_SECONDARY_LANGUAGE]: defaultSecondaryLanguage,
      [STORAGE_KEYS.SHORTCUT]: DEFAULTS.SHORTCUT,
      [STORAGE_KEYS.SIDEBAR_SHORTCUT]: DEFAULTS.SIDEBAR_SHORTCUT,
      [STORAGE_KEYS.SHOW_SELECTION_ICON]: DEFAULTS.SHOW_SELECTION_ICON,
      [STORAGE_KEYS.THEME]: DEFAULTS.THEME,
      [STORAGE_KEYS.MODAL_OPACITY]: DEFAULTS.MODAL_OPACITY,
      [STORAGE_KEYS.WELCOME_SHOWN]: false
    };

    const storageArea = getStorageArea();
    if (!storageArea) {
      return fallbackPreferences;
    }

    const storedValues = await storageArea.get(fallbackPreferences);
    const normalizedBase = normalizeLanguageCode(storedValues[STORAGE_KEYS.BASE_LANGUAGE] || defaultBaseLanguage);
    let normalizedSecondary = normalizeLanguageCode(
      storedValues[STORAGE_KEYS.LAST_SECONDARY_LANGUAGE] || defaultSecondaryLanguage
    );

    if (areSameLanguages(normalizedBase, normalizedSecondary)) {
      normalizedSecondary = resolveFallbackSecondaryLanguage(normalizedBase);
    }

    const sanitizedApiKey = typeof storedValues[STORAGE_KEYS.API_KEY] === "string"
      ? storedValues[STORAGE_KEYS.API_KEY].trim()
      : DEFAULTS.API_KEY;

    const sanitizedShortcut = typeof storedValues[STORAGE_KEYS.SHORTCUT] === "string" && storedValues[STORAGE_KEYS.SHORTCUT].trim()
      ? storedValues[STORAGE_KEYS.SHORTCUT].trim()
      : DEFAULTS.SHORTCUT;

    const sanitizedSidebarShortcut = typeof storedValues[STORAGE_KEYS.SIDEBAR_SHORTCUT] === "string" && storedValues[STORAGE_KEYS.SIDEBAR_SHORTCUT].trim()
      ? storedValues[STORAGE_KEYS.SIDEBAR_SHORTCUT].trim()
      : DEFAULTS.SIDEBAR_SHORTCUT;

    const showSelectionIcon = storedValues[STORAGE_KEYS.SHOW_SELECTION_ICON] !== false;

    return {
      [STORAGE_KEYS.API_KEY]: sanitizedApiKey,
      [STORAGE_KEYS.BASE_LANGUAGE]: normalizedBase,
      [STORAGE_KEYS.LAST_SECONDARY_LANGUAGE]: normalizedSecondary,
      [STORAGE_KEYS.SHORTCUT]: sanitizedShortcut,
      [STORAGE_KEYS.SIDEBAR_SHORTCUT]: sanitizedSidebarShortcut,
      [STORAGE_KEYS.SHOW_SELECTION_ICON]: showSelectionIcon,
      [STORAGE_KEYS.THEME]: normalizeTheme(storedValues[STORAGE_KEYS.THEME]),
      [STORAGE_KEYS.MODAL_OPACITY]: clampModalOpacity(storedValues[STORAGE_KEYS.MODAL_OPACITY]),
      [STORAGE_KEYS.WELCOME_SHOWN]: Boolean(storedValues[STORAGE_KEYS.WELCOME_SHOWN])
    };
  }

  async function saveUserPreferences(partialPreferences) {
    if (!partialPreferences || typeof partialPreferences !== "object") {
      return getUserPreferences();
    }

    const storageArea = getStorageArea();
    if (!storageArea) {
      return getUserPreferences();
    }

    const payloadToPersist = {};

    if (Object.prototype.hasOwnProperty.call(partialPreferences, STORAGE_KEYS.API_KEY)) {
      const rawKey = partialPreferences[STORAGE_KEYS.API_KEY];
      payloadToPersist[STORAGE_KEYS.API_KEY] = typeof rawKey === "string" ? rawKey.trim() : DEFAULTS.API_KEY;
    }

    if (Object.prototype.hasOwnProperty.call(partialPreferences, STORAGE_KEYS.BASE_LANGUAGE)) {
      payloadToPersist[STORAGE_KEYS.BASE_LANGUAGE] = normalizeLanguageCode(
        partialPreferences[STORAGE_KEYS.BASE_LANGUAGE]
      );
    }

    if (Object.prototype.hasOwnProperty.call(partialPreferences, STORAGE_KEYS.LAST_SECONDARY_LANGUAGE)) {
      payloadToPersist[STORAGE_KEYS.LAST_SECONDARY_LANGUAGE] = normalizeLanguageCode(
        partialPreferences[STORAGE_KEYS.LAST_SECONDARY_LANGUAGE]
      );
    }

    if (Object.prototype.hasOwnProperty.call(partialPreferences, STORAGE_KEYS.SHORTCUT)) {
      const rawShortcut = partialPreferences[STORAGE_KEYS.SHORTCUT];
      payloadToPersist[STORAGE_KEYS.SHORTCUT] = typeof rawShortcut === "string" && rawShortcut.trim()
        ? rawShortcut.trim()
        : DEFAULTS.SHORTCUT;
    }

    if (Object.prototype.hasOwnProperty.call(partialPreferences, STORAGE_KEYS.SIDEBAR_SHORTCUT)) {
      const rawSidebarShortcut = partialPreferences[STORAGE_KEYS.SIDEBAR_SHORTCUT];
      payloadToPersist[STORAGE_KEYS.SIDEBAR_SHORTCUT] = typeof rawSidebarShortcut === "string" && rawSidebarShortcut.trim()
        ? rawSidebarShortcut.trim()
        : DEFAULTS.SIDEBAR_SHORTCUT;
    }

    if (Object.prototype.hasOwnProperty.call(partialPreferences, STORAGE_KEYS.SHOW_SELECTION_ICON)) {
      payloadToPersist[STORAGE_KEYS.SHOW_SELECTION_ICON] = Boolean(
        partialPreferences[STORAGE_KEYS.SHOW_SELECTION_ICON]
      );
    }

    if (Object.prototype.hasOwnProperty.call(partialPreferences, STORAGE_KEYS.THEME)) {
      payloadToPersist[STORAGE_KEYS.THEME] = normalizeTheme(partialPreferences[STORAGE_KEYS.THEME]);
    }

    if (Object.prototype.hasOwnProperty.call(partialPreferences, STORAGE_KEYS.MODAL_OPACITY)) {
      payloadToPersist[STORAGE_KEYS.MODAL_OPACITY] = clampModalOpacity(
        partialPreferences[STORAGE_KEYS.MODAL_OPACITY]
      );
    }

    if (Object.prototype.hasOwnProperty.call(partialPreferences, STORAGE_KEYS.WELCOME_SHOWN)) {
      payloadToPersist[STORAGE_KEYS.WELCOME_SHOWN] = Boolean(
        partialPreferences[STORAGE_KEYS.WELCOME_SHOWN]
      );
    }

    await storageArea.set(payloadToPersist);
    return getUserPreferences();
  }

  namespace.Storage = Object.freeze({
    getUserPreferences,
    saveUserPreferences,
    detectBrowserBaseLanguage,
    clampModalOpacity,
    normalizeTheme
  });

  globalScope.TranslatorExt = namespace;
})(typeof globalThis !== "undefined" ? globalThis : window);
