(function initBackground(globalScope) {
  "use strict";

  const namespace = globalScope.TranslatorExt || {};
  const {
    LIMITS,
    STORAGE_KEYS,
    COMMAND_NAMES,
    DEFAULTS,
    SESSION_STATUS,
    MESSAGE_TYPES,
    CONTEXT_MENU_IDS,
    UI_MESSAGES
  } = namespace.CONSTANTS;
  const {
    normalizeLanguageCode,
    areSameLanguages,
    resolveFallbackSecondaryLanguage
  } = namespace.Languages;
  const { getUserPreferences, saveUserPreferences } = namespace.Storage;
  const { requestGoogleTranslation } = namespace.ApiClient;

  const CONTENT_SCRIPT_FILES = Object.freeze([
    "src/shared/constants.js",
    "src/shared/languages.js",
    "src/content/widget-styles.js",
    "src/content/translator-widget.js",
    "src/content/content.js"
  ]);

  async function recordSecondaryLanguageIfForeign(languageCode, baseLanguage) {
    if (!languageCode || languageCode === DEFAULTS.AUTO_LANGUAGE) {
      return;
    }

    const normalizedCandidate = normalizeLanguageCode(languageCode);
    if (areSameLanguages(normalizedCandidate, baseLanguage)) {
      return;
    }

    await saveUserPreferences({
      [STORAGE_KEYS.LAST_SECONDARY_LANGUAGE]: normalizedCandidate
    });
  }

  function resolveSecondaryRedirectTarget(preferences) {
    const baseLanguage = preferences[STORAGE_KEYS.BASE_LANGUAGE];
    const storedSecondary = preferences[STORAGE_KEYS.LAST_SECONDARY_LANGUAGE];

    if (storedSecondary && !areSameLanguages(storedSecondary, baseLanguage)) {
      return normalizeLanguageCode(storedSecondary);
    }

    return resolveFallbackSecondaryLanguage(baseLanguage);
  }

  async function handleGetSessionBootstrap() {
    const preferences = await getUserPreferences();
    return {
      hasApiKey: Boolean(preferences[STORAGE_KEYS.API_KEY]),
      baseLanguage: preferences[STORAGE_KEYS.BASE_LANGUAGE],
      lastSecondaryLanguage: preferences[STORAGE_KEYS.LAST_SECONDARY_LANGUAGE],
      shortcut: preferences[STORAGE_KEYS.SHORTCUT],
      sidebarShortcut: preferences[STORAGE_KEYS.SIDEBAR_SHORTCUT],
      showSelectionIcon: preferences[STORAGE_KEYS.SHOW_SELECTION_ICON],
      theme: preferences[STORAGE_KEYS.THEME],
      modalOpacity: preferences[STORAGE_KEYS.MODAL_OPACITY]
    };
  }

  async function handleTranslateText(payload) {
    const preferences = await getUserPreferences();
    const apiKey = preferences[STORAGE_KEYS.API_KEY];

    if (!apiKey) {
      return {
        ok: false,
        status: SESSION_STATUS.MISSING_API_KEY,
        errorMessage: UI_MESSAGES.MISSING_API_KEY
      };
    }

    const rawText = typeof payload?.text === "string" ? payload.text : "";
    const trimmedText = rawText.trim();

    if (!trimmedText) {
      return {
        ok: true,
        status: SESSION_STATUS.IDLE,
        data: {
          translatedText: "",
          detectedSourceLanguage: null,
          effectiveTargetLanguage: normalizeLanguageCode(
            payload?.targetLanguage || preferences[STORAGE_KEYS.BASE_LANGUAGE]
          ),
          autoRedirected: false
        }
      };
    }

    if (rawText.length > LIMITS.MAX_CHARS_PER_QUERY) {
      return {
        ok: false,
        status: SESSION_STATUS.TEXT_TOO_LONG,
        errorMessage: UI_MESSAGES.TEXT_TOO_LONG
      };
    }

    const baseLanguage = preferences[STORAGE_KEYS.BASE_LANGUAGE];
    const requestedSource = payload?.sourceLanguage || DEFAULTS.AUTO_LANGUAGE;
    const allowAutoRedirect = payload?.allowAutoRedirect !== false;
    let effectiveTargetLanguage = normalizeLanguageCode(payload?.targetLanguage || baseLanguage);
    let autoRedirected = false;

    if (
      allowAutoRedirect &&
      requestedSource !== DEFAULTS.AUTO_LANGUAGE &&
      areSameLanguages(requestedSource, baseLanguage) &&
      areSameLanguages(effectiveTargetLanguage, baseLanguage)
    ) {
      effectiveTargetLanguage = resolveSecondaryRedirectTarget(preferences);
      autoRedirected = true;
    }

    let translationResult = await requestGoogleTranslation({
      apiKey,
      text: rawText,
      sourceLanguage: requestedSource,
      targetLanguage: effectiveTargetLanguage
    });

    if (!translationResult.ok) {
      return translationResult;
    }

    const detectedSourceLanguage = translationResult.data.detectedSourceLanguage;

    if (
      allowAutoRedirect &&
      areSameLanguages(detectedSourceLanguage, baseLanguage) &&
      areSameLanguages(effectiveTargetLanguage, baseLanguage)
    ) {
      const redirectedTarget = resolveSecondaryRedirectTarget(preferences);
      const redirectedResult = await requestGoogleTranslation({
        apiKey,
        text: rawText,
        sourceLanguage: detectedSourceLanguage,
        targetLanguage: redirectedTarget
      });

      if (!redirectedResult.ok) {
        return redirectedResult;
      }

      translationResult = redirectedResult;
      effectiveTargetLanguage = redirectedTarget;
      autoRedirected = true;
    }

    await recordSecondaryLanguageIfForeign(detectedSourceLanguage, baseLanguage);
    await recordSecondaryLanguageIfForeign(effectiveTargetLanguage, baseLanguage);

    return {
      ok: true,
      status: SESSION_STATUS.SUCCESS,
      data: {
        translatedText: translationResult.data.translatedText,
        detectedSourceLanguage: translationResult.data.detectedSourceLanguage,
        effectiveTargetLanguage,
        autoRedirected
      }
    };
  }

  async function handleOpenOptionsPage() {
    if (typeof browser !== "undefined" && browser.runtime && typeof browser.runtime.openOptionsPage === "function") {
      await browser.runtime.openOptionsPage();
    }
    return { ok: true };
  }

  async function handleOpenWelcomePage() {
    if (typeof browser !== "undefined" && browser.tabs && typeof browser.tabs.create === "function") {
      const welcomeUrl = browser.runtime.getURL("src/welcome/welcome.html");
      await browser.tabs.create({ url: welcomeUrl });
    }
    return { ok: true };
  }

  async function openWelcomePageOnFirstRun() {
    try {
      const preferences = await getUserPreferences();
      if (preferences[STORAGE_KEYS.WELCOME_SHOWN]) {
        return;
      }
      await saveUserPreferences({
        [STORAGE_KEYS.WELCOME_SHOWN]: true
      });
      await handleOpenWelcomePage();
    } catch (_welcomeError) {
      // Ignora erro caso abas ainda não estejam prontas
    }
  }

  function isInjectableTabUrl(url) {
    if (!url || typeof url !== "string") {
      return false;
    }
    return (
      url.startsWith("http://") ||
      url.startsWith("https://") ||
      url.startsWith("file://")
    );
  }

  async function ensureContentScriptsInjected(tabId) {
    if (typeof tabId !== "number") {
      return false;
    }

    try {
      const pingResponse = await browser.tabs.sendMessage(tabId, {
        type: MESSAGE_TYPES.PING_CONTENT_SCRIPT
      });
      if (pingResponse && pingResponse.alive) {
        return true;
      }
    } catch (_notInjectedYet) {
      // Continua para injetar programaticamente na aba.
    }

    if (!browser.tabs || typeof browser.tabs.executeScript !== "function") {
      return false;
    }

    try {
      for (const filePath of CONTENT_SCRIPT_FILES) {
        await browser.tabs.executeScript(tabId, {
          file: `/${filePath}`,
          runAt: "document_idle"
        });
      }
      return true;
    } catch (_injectionError) {
      return false;
    }
  }

  async function injectIntoExistingTabsOnStartup() {
    if (typeof browser === "undefined" || !browser.tabs || typeof browser.tabs.query !== "function") {
      return;
    }

    try {
      const allTabs = await browser.tabs.query({});
      for (const tab of allTabs) {
        if (tab && typeof tab.id === "number" && isInjectableTabUrl(tab.url)) {
          await ensureContentScriptsInjected(tab.id);
        }
      }
    } catch (_queryError) {
      // Ignora erro caso alguma aba esteja inacessível.
    }
  }

  async function sendMessageToTabWithAutoInject(tabId, message) {
    const isReady = await ensureContentScriptsInjected(tabId);
    if (!isReady) {
      return { ok: false };
    }

    try {
      const response = await browser.tabs.sendMessage(tabId, message);
      return { ok: true, response };
    } catch (_sendError) {
      return { ok: false };
    }
  }

  async function triggerShortcutInActiveTab() {
    if (typeof browser === "undefined" || !browser.tabs) {
      return;
    }

    const activeTabs = await browser.tabs.query({ active: true, currentWindow: true });
    const activeTab = activeTabs?.[0];
    if (!activeTab || typeof activeTab.id !== "number") {
      return;
    }

    await sendMessageToTabWithAutoInject(activeTab.id, {
      type: MESSAGE_TYPES.TRIGGER_SHORTCUT_MODAL
    });
  }

  function registerContextMenus() {
    const menusApi = browser.contextMenus || browser.menus;
    if (!menusApi || typeof menusApi.create !== "function") {
      return;
    }

    menusApi.removeAll().then(() => {
      menusApi.create({
        id: CONTEXT_MENU_IDS.TRANSLATE_SELECTION,
        title: "Traduzir seleção",
        contexts: ["selection"]
      });

      menusApi.create({
        id: CONTEXT_MENU_IDS.OPEN_FREE_TRANSLATOR,
        title: "Abrir tradutor",
        contexts: ["page", "frame", "editable"]
      });

      menusApi.create({
        id: CONTEXT_MENU_IDS.OPEN_OPTIONS,
        title: "Opções",
        contexts: ["all"]
      });
    }).catch(() => {});

    menusApi.onClicked.addListener(async (info, tab) => {
      if (info.menuItemId === CONTEXT_MENU_IDS.OPEN_OPTIONS) {
        await handleOpenOptionsPage();
        return;
      }

      if (info.menuItemId === CONTEXT_MENU_IDS.TRANSLATE_SELECTION) {
        const selectedText = typeof info.selectionText === "string" ? info.selectionText.trim() : "";
        if (tab && typeof tab.id === "number") {
          await sendMessageToTabWithAutoInject(tab.id, {
            type: MESSAGE_TYPES.OPEN_MODAL_WITH_TEXT,
            payload: { text: selectedText }
          });
        }
        return;
      }

      if (info.menuItemId === CONTEXT_MENU_IDS.OPEN_FREE_TRANSLATOR) {
        if (tab && typeof tab.id === "number") {
          await sendMessageToTabWithAutoInject(tab.id, {
            type: MESSAGE_TYPES.OPEN_MODAL_WITH_TEXT,
            payload: { text: "" }
          });
        }
      }
    });
  }

  async function syncBrowserShortcutsWithStorage() {
    if (typeof browser === "undefined" || !browser.commands || typeof browser.commands.getAll !== "function") {
      return;
    }

    try {
      const registeredCommands = await browser.commands.getAll();
      const partialUpdates = {};

      for (const cmd of registeredCommands) {
        if (cmd.name === COMMAND_NAMES.TRANSLATE_SELECTION && cmd.shortcut) {
          partialUpdates[STORAGE_KEYS.SHORTCUT] = cmd.shortcut;
        }
        if (cmd.name === COMMAND_NAMES.EXECUTE_SIDEBAR_ACTION && cmd.shortcut) {
          partialUpdates[STORAGE_KEYS.SIDEBAR_SHORTCUT] = cmd.shortcut;
        }
      }

      if (Object.keys(partialUpdates).length > 0) {
        await saveUserPreferences(partialUpdates);
      }
    } catch (_syncError) {
      // Ignora erro caso commands.getAll não esteja disponível
    }
  }

  if (typeof browser !== "undefined" && browser.runtime && browser.runtime.onMessage) {
    browser.runtime.onMessage.addListener((message) => {
      if (!message || typeof message.type !== "string") {
        return undefined;
      }

      if (message.type === MESSAGE_TYPES.GET_SESSION_BOOTSTRAP) {
        return handleGetSessionBootstrap();
      }

      if (message.type === MESSAGE_TYPES.TRANSLATE_TEXT) {
        return handleTranslateText(message.payload);
      }

      if (message.type === MESSAGE_TYPES.OPEN_OPTIONS_PAGE) {
        return handleOpenOptionsPage();
      }

      if (message.type === MESSAGE_TYPES.OPEN_WELCOME_PAGE) {
        return handleOpenWelcomePage();
      }

      return undefined;
    });
  }

  if (typeof browser !== "undefined" && browser.commands && browser.commands.onCommand) {
    browser.commands.onCommand.addListener((commandName) => {
      if (commandName !== COMMAND_NAMES.TRANSLATE_SELECTION) {
        return;
      }
      triggerShortcutInActiveTab();
    });
  }

  if (typeof browser !== "undefined" && browser.runtime && browser.runtime.onInstalled) {
    browser.runtime.onInstalled.addListener((details) => {
      if (details.reason === "install") {
        openWelcomePageOnFirstRun();
      }
    });
  }

  registerContextMenus();
  syncBrowserShortcutsWithStorage();
  injectIntoExistingTabsOnStartup();
  openWelcomePageOnFirstRun();
})(typeof globalThis !== "undefined" ? globalThis : window);
