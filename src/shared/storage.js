(function initStorage(globalScope) {
  "use strict";

  const namespace = globalScope.TranslatorExt || {};
  const { STORAGE_KEYS, DEFAULTS, LIMITS, THEMES, PROVIDERS } = namespace.CONSTANTS;
  const { normalizeLanguageCode, resolveFallbackSecondaryLanguage, areSameLanguages } = namespace.Languages;
  const { normalizeProviderId } = namespace.Providers || {
    normalizeProviderId: (val, fallback) => val || fallback
  };

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

  function clampTypingDebounceMs(value) {
    const numeric = Number(value);
    if (Number.isNaN(numeric)) {
      return DEFAULTS.TYPING_DEBOUNCE_MS;
    }
    const clamped = Math.min(
      LIMITS.MAX_TYPING_DEBOUNCE_MS,
      Math.max(LIMITS.MIN_TYPING_DEBOUNCE_MS, Math.round(numeric / 100) * 100)
    );
    return clamped;
  }

  function normalizeTheme(themeValue) {
    return themeValue === THEMES.LIGHT ? THEMES.LIGHT : THEMES.DARK;
  }

  function sanitizeModalPosition(rawPosition) {
    if (!rawPosition || typeof rawPosition !== "object" || !rawPosition.isCustom) {
      return {
        isCustom: false,
        x: null,
        y: null
      };
    }

    const x = Number(rawPosition.x);
    const y = Number(rawPosition.y);

    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      return {
        isCustom: false,
        x: null,
        y: null
      };
    }

    return {
      isCustom: true,
      x: Math.round(x),
      y: Math.round(y)
    };
  }

  function sanitizeHistoryList(rawHistory) {
    if (!Array.isArray(rawHistory)) {
      return [];
    }

    const validEntries = [];
    for (const item of rawHistory) {
      if (!item || typeof item !== "object") {
        continue;
      }
      const sourceText = typeof item.sourceText === "string" ? item.sourceText.trim() : "";
      const translatedText = typeof item.translatedText === "string" ? item.translatedText.trim() : "";
      if (!sourceText || !translatedText) {
        continue;
      }

      validEntries.push({
        id: typeof item.id === "string" && item.id ? item.id : `hist_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        sourceText: sourceText.slice(0, LIMITS.MAX_CHARS_PER_QUERY),
        translatedText,
        sourceLanguage: normalizeLanguageCode(item.sourceLanguage || DEFAULTS.SECONDARY_LANGUAGE_DEFAULT),
        targetLanguage: normalizeLanguageCode(item.targetLanguage || DEFAULTS.BASE_LANGUAGE),
        provider: normalizeProviderId(item.provider, DEFAULTS.PROVIDER),
        createdAt: Number.isFinite(Number(item.createdAt)) ? Number(item.createdAt) : Date.now()
      });

      if (validEntries.length >= LIMITS.MAX_HISTORY_ITEMS) {
        break;
      }
    }

    return validEntries;
  }

  function sanitizeDownloadedModelsList(rawList) {
    if (!Array.isArray(rawList)) {
      return [];
    }

    const seen = new Set();
    const valid = [];
    for (const item of rawList) {
      if (!item || typeof item !== "object" || typeof item.modelId !== "string" || !item.modelId.trim()) {
        continue;
      }
      const modelId = item.modelId.trim();
      if (seen.has(modelId)) {
        continue;
      }
      seen.add(modelId);
      valid.push({
        modelId,
        label: typeof item.label === "string" && item.label.trim() ? item.label.trim() : modelId,
        downloadedAt: Number.isFinite(Number(item.downloadedAt)) ? Number(item.downloadedAt) : Date.now()
      });
    }
    return valid;
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
      [STORAGE_KEYS.PROVIDER]: null,
      [STORAGE_KEYS.API_KEY]: DEFAULTS.API_KEY,
      [STORAGE_KEYS.LIBRE_TRANSLATE_URL]: DEFAULTS.LIBRE_TRANSLATE_URL,
      [STORAGE_KEYS.LIBRE_TRANSLATE_API_KEY]: DEFAULTS.LIBRE_TRANSLATE_API_KEY,
      [STORAGE_KEYS.OFFLINE_ENGINE_ENABLED]: DEFAULTS.OFFLINE_ENGINE_ENABLED,
      [STORAGE_KEYS.OFFLINE_DOWNLOADED_MODELS]: [],
      [STORAGE_KEYS.BASE_LANGUAGE]: defaultBaseLanguage,
      [STORAGE_KEYS.SECONDARY_LANGUAGE]: defaultSecondaryLanguage,
      [STORAGE_KEYS.LAST_SECONDARY_LANGUAGE]: defaultSecondaryLanguage,
      [STORAGE_KEYS.AUTO_TRANSLATE_ON_TYPE]: DEFAULTS.AUTO_TRANSLATE_ON_TYPE,
      [STORAGE_KEYS.TYPING_DEBOUNCE_MS]: DEFAULTS.TYPING_DEBOUNCE_MS,
      [STORAGE_KEYS.SHORTCUT]: DEFAULTS.SHORTCUT,
      [STORAGE_KEYS.SIDEBAR_SHORTCUT]: DEFAULTS.SIDEBAR_SHORTCUT,
      [STORAGE_KEYS.SHOW_SELECTION_ICON]: DEFAULTS.SHOW_SELECTION_ICON,
      [STORAGE_KEYS.THEME]: DEFAULTS.THEME,
      [STORAGE_KEYS.MODAL_OPACITY]: DEFAULTS.MODAL_OPACITY,
      [STORAGE_KEYS.MODAL_POSITION]: DEFAULTS.MODAL_POSITION,
      [STORAGE_KEYS.TRANSLATION_HISTORY]: [],
      [STORAGE_KEYS.WELCOME_SHOWN]: false
    };

    const storageArea = getStorageArea();
    if (!storageArea) {
      return {
        ...fallbackPreferences,
        [STORAGE_KEYS.PROVIDER]: DEFAULTS.PROVIDER
      };
    }

    const storedValues = await storageArea.get(fallbackPreferences);
    const normalizedBase = normalizeLanguageCode(storedValues[STORAGE_KEYS.BASE_LANGUAGE] || defaultBaseLanguage);
    let normalizedSecondary = normalizeLanguageCode(
      storedValues[STORAGE_KEYS.SECONDARY_LANGUAGE] ||
      storedValues[STORAGE_KEYS.LAST_SECONDARY_LANGUAGE] ||
      defaultSecondaryLanguage
    );

    if (areSameLanguages(normalizedBase, normalizedSecondary)) {
      normalizedSecondary = resolveFallbackSecondaryLanguage(normalizedBase);
    }

    const sanitizedApiKey = typeof storedValues[STORAGE_KEYS.API_KEY] === "string"
      ? storedValues[STORAGE_KEYS.API_KEY].trim()
      : DEFAULTS.API_KEY;

    const fallbackProvider = sanitizedApiKey ? PROVIDERS.GOOGLE : DEFAULTS.PROVIDER;
    const resolvedProvider = storedValues[STORAGE_KEYS.PROVIDER]
      ? normalizeProviderId(storedValues[STORAGE_KEYS.PROVIDER], fallbackProvider)
      : fallbackProvider;

    const sanitizedLibreUrl = typeof storedValues[STORAGE_KEYS.LIBRE_TRANSLATE_URL] === "string" &&
      storedValues[STORAGE_KEYS.LIBRE_TRANSLATE_URL].trim()
      ? storedValues[STORAGE_KEYS.LIBRE_TRANSLATE_URL].trim().replace(/\/+$/, "")
      : DEFAULTS.LIBRE_TRANSLATE_URL;

    const sanitizedLibreKey = typeof storedValues[STORAGE_KEYS.LIBRE_TRANSLATE_API_KEY] === "string"
      ? storedValues[STORAGE_KEYS.LIBRE_TRANSLATE_API_KEY].trim()
      : DEFAULTS.LIBRE_TRANSLATE_API_KEY;

    const sanitizedShortcut = typeof storedValues[STORAGE_KEYS.SHORTCUT] === "string" && storedValues[STORAGE_KEYS.SHORTCUT].trim()
      ? storedValues[STORAGE_KEYS.SHORTCUT].trim()
      : DEFAULTS.SHORTCUT;

    const sanitizedSidebarShortcut = typeof storedValues[STORAGE_KEYS.SIDEBAR_SHORTCUT] === "string" && storedValues[STORAGE_KEYS.SIDEBAR_SHORTCUT].trim()
      ? storedValues[STORAGE_KEYS.SIDEBAR_SHORTCUT].trim()
      : DEFAULTS.SIDEBAR_SHORTCUT;

    const showSelectionIcon = storedValues[STORAGE_KEYS.SHOW_SELECTION_ICON] !== false;
    const offlineEngineEnabled = storedValues[STORAGE_KEYS.OFFLINE_ENGINE_ENABLED] !== false;

    return {
      [STORAGE_KEYS.PROVIDER]: resolvedProvider,
      [STORAGE_KEYS.API_KEY]: sanitizedApiKey,
      [STORAGE_KEYS.LIBRE_TRANSLATE_URL]: sanitizedLibreUrl,
      [STORAGE_KEYS.LIBRE_TRANSLATE_API_KEY]: sanitizedLibreKey,
      [STORAGE_KEYS.OFFLINE_ENGINE_ENABLED]: offlineEngineEnabled,
      [STORAGE_KEYS.OFFLINE_DOWNLOADED_MODELS]: sanitizeDownloadedModelsList(
        storedValues[STORAGE_KEYS.OFFLINE_DOWNLOADED_MODELS]
      ),
      [STORAGE_KEYS.BASE_LANGUAGE]: normalizedBase,
      [STORAGE_KEYS.SECONDARY_LANGUAGE]: normalizedSecondary,
      [STORAGE_KEYS.LAST_SECONDARY_LANGUAGE]: normalizedSecondary,
      [STORAGE_KEYS.AUTO_TRANSLATE_ON_TYPE]: Boolean(storedValues[STORAGE_KEYS.AUTO_TRANSLATE_ON_TYPE]),
      [STORAGE_KEYS.TYPING_DEBOUNCE_MS]: clampTypingDebounceMs(storedValues[STORAGE_KEYS.TYPING_DEBOUNCE_MS]),
      [STORAGE_KEYS.SHORTCUT]: sanitizedShortcut,
      [STORAGE_KEYS.SIDEBAR_SHORTCUT]: sanitizedSidebarShortcut,
      [STORAGE_KEYS.SHOW_SELECTION_ICON]: showSelectionIcon,
      [STORAGE_KEYS.THEME]: normalizeTheme(storedValues[STORAGE_KEYS.THEME]),
      [STORAGE_KEYS.MODAL_OPACITY]: clampModalOpacity(storedValues[STORAGE_KEYS.MODAL_OPACITY]),
      [STORAGE_KEYS.MODAL_POSITION]: sanitizeModalPosition(storedValues[STORAGE_KEYS.MODAL_POSITION]),
      [STORAGE_KEYS.TRANSLATION_HISTORY]: sanitizeHistoryList(storedValues[STORAGE_KEYS.TRANSLATION_HISTORY]),
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

    if (Object.prototype.hasOwnProperty.call(partialPreferences, STORAGE_KEYS.PROVIDER)) {
      payloadToPersist[STORAGE_KEYS.PROVIDER] = normalizeProviderId(
        partialPreferences[STORAGE_KEYS.PROVIDER],
        DEFAULTS.PROVIDER
      );
    }

    if (Object.prototype.hasOwnProperty.call(partialPreferences, STORAGE_KEYS.API_KEY)) {
      const rawKey = partialPreferences[STORAGE_KEYS.API_KEY];
      payloadToPersist[STORAGE_KEYS.API_KEY] = typeof rawKey === "string" ? rawKey.trim() : DEFAULTS.API_KEY;
    }

    if (Object.prototype.hasOwnProperty.call(partialPreferences, STORAGE_KEYS.LIBRE_TRANSLATE_URL)) {
      const rawUrl = partialPreferences[STORAGE_KEYS.LIBRE_TRANSLATE_URL];
      payloadToPersist[STORAGE_KEYS.LIBRE_TRANSLATE_URL] = typeof rawUrl === "string" && rawUrl.trim()
        ? rawUrl.trim().replace(/\/+$/, "")
        : DEFAULTS.LIBRE_TRANSLATE_URL;
    }

    if (Object.prototype.hasOwnProperty.call(partialPreferences, STORAGE_KEYS.LIBRE_TRANSLATE_API_KEY)) {
      const rawLibreKey = partialPreferences[STORAGE_KEYS.LIBRE_TRANSLATE_API_KEY];
      payloadToPersist[STORAGE_KEYS.LIBRE_TRANSLATE_API_KEY] = typeof rawLibreKey === "string"
        ? rawLibreKey.trim()
        : DEFAULTS.LIBRE_TRANSLATE_API_KEY;
    }

    if (Object.prototype.hasOwnProperty.call(partialPreferences, STORAGE_KEYS.OFFLINE_ENGINE_ENABLED)) {
      payloadToPersist[STORAGE_KEYS.OFFLINE_ENGINE_ENABLED] = Boolean(
        partialPreferences[STORAGE_KEYS.OFFLINE_ENGINE_ENABLED]
      );
    }

    if (Object.prototype.hasOwnProperty.call(partialPreferences, STORAGE_KEYS.OFFLINE_DOWNLOADED_MODELS)) {
      payloadToPersist[STORAGE_KEYS.OFFLINE_DOWNLOADED_MODELS] = sanitizeDownloadedModelsList(
        partialPreferences[STORAGE_KEYS.OFFLINE_DOWNLOADED_MODELS]
      );
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

    if (Object.prototype.hasOwnProperty.call(partialPreferences, STORAGE_KEYS.AUTO_TRANSLATE_ON_TYPE)) {
      payloadToPersist[STORAGE_KEYS.AUTO_TRANSLATE_ON_TYPE] = Boolean(
        partialPreferences[STORAGE_KEYS.AUTO_TRANSLATE_ON_TYPE]
      );
    }

    if (Object.prototype.hasOwnProperty.call(partialPreferences, STORAGE_KEYS.TYPING_DEBOUNCE_MS)) {
      payloadToPersist[STORAGE_KEYS.TYPING_DEBOUNCE_MS] = clampTypingDebounceMs(
        partialPreferences[STORAGE_KEYS.TYPING_DEBOUNCE_MS]
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

    if (Object.prototype.hasOwnProperty.call(partialPreferences, STORAGE_KEYS.MODAL_POSITION)) {
      payloadToPersist[STORAGE_KEYS.MODAL_POSITION] = sanitizeModalPosition(
        partialPreferences[STORAGE_KEYS.MODAL_POSITION]
      );
    }

    if (Object.prototype.hasOwnProperty.call(partialPreferences, STORAGE_KEYS.TRANSLATION_HISTORY)) {
      payloadToPersist[STORAGE_KEYS.TRANSLATION_HISTORY] = sanitizeHistoryList(
        partialPreferences[STORAGE_KEYS.TRANSLATION_HISTORY]
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

  async function getTranslationHistory() {
    const preferences = await getUserPreferences();
    return preferences[STORAGE_KEYS.TRANSLATION_HISTORY] || [];
  }

  async function recordTranslationHistoryEntry(entry) {
    if (!entry || typeof entry !== "object") {
      return getTranslationHistory();
    }

    const sourceText = typeof entry.sourceText === "string" ? entry.sourceText.trim() : "";
    const translatedText = typeof entry.translatedText === "string" ? entry.translatedText.trim() : "";
    if (!sourceText || !translatedText) {
      return getTranslationHistory();
    }

    const currentHistory = await getTranslationHistory();
    const normalizedSourceLang = normalizeLanguageCode(entry.sourceLanguage || DEFAULTS.SECONDARY_LANGUAGE_DEFAULT);
    const normalizedTargetLang = normalizeLanguageCode(entry.targetLanguage || DEFAULTS.BASE_LANGUAGE);
    const normalizedProvider = normalizeProviderId(entry.provider, DEFAULTS.PROVIDER);
    const now = Date.now();

    const newRecord = {
      id: `hist_${now}_${Math.random().toString(36).slice(2, 7)}`,
      sourceText: sourceText.slice(0, LIMITS.MAX_CHARS_PER_QUERY),
      translatedText,
      sourceLanguage: normalizedSourceLang,
      targetLanguage: normalizedTargetLang,
      provider: normalizedProvider,
      createdAt: now
    };

    const updatedHistory = [...currentHistory];

    if (updatedHistory.length > 0) {
      const latest = updatedHistory[0];
      const isSameTarget = latest.targetLanguage === normalizedTargetLang;
      const latestLower = latest.sourceText.toLowerCase();
      const currentLower = newRecord.sourceText.toLowerCase();
      const isRapidTypingContinuation =
        now - latest.createdAt < 6000 &&
        (currentLower.startsWith(latestLower) || latestLower.startsWith(currentLower));

      if (isSameTarget && (latestLower === currentLower || isRapidTypingContinuation)) {
        updatedHistory[0] = {
          ...newRecord,
          id: latest.id
        };
        await saveUserPreferences({
          [STORAGE_KEYS.TRANSLATION_HISTORY]: updatedHistory.slice(0, LIMITS.MAX_HISTORY_ITEMS)
        });
        return updatedHistory.slice(0, LIMITS.MAX_HISTORY_ITEMS);
      }
    }

    const filteredHistory = updatedHistory.filter(
      (item) =>
        !(
          item.sourceText.toLowerCase() === newRecord.sourceText.toLowerCase() &&
          item.targetLanguage === newRecord.targetLanguage
        )
    );

    const nextHistory = [newRecord, ...filteredHistory].slice(0, LIMITS.MAX_HISTORY_ITEMS);
    await saveUserPreferences({
      [STORAGE_KEYS.TRANSLATION_HISTORY]: nextHistory
    });
    return nextHistory;
  }

  async function clearTranslationHistory() {
    await saveUserPreferences({
      [STORAGE_KEYS.TRANSLATION_HISTORY]: []
    });
    return [];
  }

  async function recordDownloadedOfflineModel({ modelId, label }) {
    if (!modelId || typeof modelId !== "string") {
      return [];
    }
    const preferences = await getUserPreferences();
    const existing = preferences[STORAGE_KEYS.OFFLINE_DOWNLOADED_MODELS] || [];
    const filtered = existing.filter((item) => item.modelId !== modelId);
    const nextList = [
      {
        modelId,
        label: label || modelId,
        downloadedAt: Date.now()
      },
      ...filtered
    ];
    await saveUserPreferences({
      [STORAGE_KEYS.OFFLINE_DOWNLOADED_MODELS]: nextList
    });
    return nextList;
  }

  async function clearDownloadedOfflineModels() {
    await saveUserPreferences({
      [STORAGE_KEYS.OFFLINE_DOWNLOADED_MODELS]: []
    });
    return [];
  }

  namespace.Storage = Object.freeze({
    getUserPreferences,
    saveUserPreferences,
    getTranslationHistory,
    recordTranslationHistoryEntry,
    clearTranslationHistory,
    recordDownloadedOfflineModel,
    clearDownloadedOfflineModels,
    detectBrowserBaseLanguage,
    clampModalOpacity,
    clampTypingDebounceMs,
    normalizeTheme,
    sanitizeModalPosition
  });

  globalScope.TranslatorExt = namespace;
})(typeof globalThis !== "undefined" ? globalThis : window);
