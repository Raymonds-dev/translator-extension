(function initBackground(globalScope) {
  "use strict";

  const namespace = globalScope.TranslatorExt || {};
  const {
    LIMITS,
    PROVIDERS,
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
  const { normalizeProviderId, getNextFreeProviderId } = namespace.Providers;
  const {
    getUserPreferences,
    saveUserPreferences,
    getTranslationHistory,
    recordTranslationHistoryEntry,
    clearTranslationHistory
  } = namespace.Storage;
  const {
    requestTranslationByProvider,
    isOfflineWorkerRunning,
    terminateOfflineWorker,
    inspectCachedOfflineModels,
    uninstallOfflineModels
  } = namespace.ApiClient;

  const CONTENT_SCRIPT_FILES = Object.freeze([
    "src/shared/constants.js",
    "src/shared/languages.js",
    "src/shared/providers.js",
    "src/content/widget-styles.js",
    "src/content/translator-widget.js",
    "src/content/content.js"
  ]);

  const openSidebarPorts = new Set();

  if (typeof browser !== "undefined" && browser.runtime && browser.runtime.onConnect) {
    browser.runtime.onConnect.addListener((port) => {
      if (!port || port.name !== "sidebar-live-channel") {
        return;
      }
      openSidebarPorts.add(port);
      port.onDisconnect.addListener(() => {
        openSidebarPorts.delete(port);
      });
    });
  }

  function pushTextToOpenSidebars(text) {
    if (!text || openSidebarPorts.size === 0) {
      return false;
    }

    let delivered = false;
    for (const port of openSidebarPorts) {
      try {
        port.postMessage({
          type: MESSAGE_TYPES.PAGE_TEXT_SELECTED,
          payload: { text }
        });
        delivered = true;
      } catch (_portErr) {
        openSidebarPorts.delete(port);
      }
    }
    return delivered;
  }

  if (typeof browser !== "undefined" && browser.storage && browser.storage.onChanged) {
    browser.storage.onChanged.addListener((changes, areaName) => {
      if (areaName !== "local") {
        return;
      }
      if (changes[STORAGE_KEYS.PROVIDER]) {
        const nextProvider = changes[STORAGE_KEYS.PROVIDER].newValue;
        if (nextProvider !== PROVIDERS.OFFLINE && isOfflineWorkerRunning()) {
          terminateOfflineWorker();
        }
      }
      if (changes[STORAGE_KEYS.OFFLINE_ENGINE_ENABLED]) {
        const enabled = changes[STORAGE_KEYS.OFFLINE_ENGINE_ENABLED].newValue !== false;
        if (!enabled && isOfflineWorkerRunning()) {
          terminateOfflineWorker();
        }
      }
    });
  }

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
      provider: preferences[STORAGE_KEYS.PROVIDER],
      hasApiKey: Boolean(preferences[STORAGE_KEYS.API_KEY]),
      offlineEngineEnabled: preferences[STORAGE_KEYS.OFFLINE_ENGINE_ENABLED] !== false,
      baseLanguage: preferences[STORAGE_KEYS.BASE_LANGUAGE],
      lastSecondaryLanguage: preferences[STORAGE_KEYS.LAST_SECONDARY_LANGUAGE],
      shortcut: preferences[STORAGE_KEYS.SHORTCUT],
      sidebarShortcut: preferences[STORAGE_KEYS.SIDEBAR_SHORTCUT],
      showSelectionIcon: preferences[STORAGE_KEYS.SHOW_SELECTION_ICON],
      theme: preferences[STORAGE_KEYS.THEME],
      modalOpacity: preferences[STORAGE_KEYS.MODAL_OPACITY],
      modalPosition: preferences[STORAGE_KEYS.MODAL_POSITION],
      history: preferences[STORAGE_KEYS.TRANSLATION_HISTORY] || []
    };
  }

  async function handleGetOfflineRuntimeStatus() {
    const preferences = await getUserPreferences();
    const enabled = preferences[STORAGE_KEYS.OFFLINE_ENGINE_ENABLED] !== false;
    const storedModels = preferences[STORAGE_KEYS.OFFLINE_DOWNLOADED_MODELS] || [];
    const cachedModels = await inspectCachedOfflineModels(storedModels);

    return {
      ok: true,
      enabled,
      workerRunning: isOfflineWorkerRunning(),
      downloadedModels: cachedModels
    };
  }

  async function handleSetOfflineEngineEnabled(payload) {
    const enabled = Boolean(payload?.enabled);
    if (!enabled) {
      terminateOfflineWorker();
    }
    await saveUserPreferences({
      [STORAGE_KEYS.OFFLINE_ENGINE_ENABLED]: enabled
    });
    return handleGetOfflineRuntimeStatus();
  }

  async function handleUninstallOfflineModels() {
    await uninstallOfflineModels();
    return handleGetOfflineRuntimeStatus();
  }

  async function handleTranslateText(payload) {
    const preferences = await getUserPreferences();
    const activeProvider = normalizeProviderId(
      payload?.provider || preferences[STORAGE_KEYS.PROVIDER],
      DEFAULTS.PROVIDER
    );
    const apiKey = preferences[STORAGE_KEYS.API_KEY];
    const offlineEngineEnabled = preferences[STORAGE_KEYS.OFFLINE_ENGINE_ENABLED] !== false;

    if (activeProvider === PROVIDERS.GOOGLE && !apiKey) {
      return {
        ok: false,
        status: SESSION_STATUS.MISSING_API_KEY,
        provider: activeProvider,
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
          provider: activeProvider,
          autoRedirected: false,
          history: preferences[STORAGE_KEYS.TRANSLATION_HISTORY] || []
        }
      };
    }

    if (rawText.length > LIMITS.MAX_CHARS_PER_QUERY) {
      return {
        ok: false,
        status: SESSION_STATUS.TEXT_TOO_LONG,
        provider: activeProvider,
        errorMessage: UI_MESSAGES.TEXT_TOO_LONG
      };
    }

    const baseLanguage = preferences[STORAGE_KEYS.BASE_LANGUAGE];
    const secondaryLanguage = resolveSecondaryRedirectTarget(preferences);
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
      effectiveTargetLanguage = secondaryLanguage;
      autoRedirected = true;
    }

    let translationResult = await requestTranslationByProvider({
      provider: activeProvider,
      apiKey,
      libreTranslateUrl: preferences[STORAGE_KEYS.LIBRE_TRANSLATE_URL],
      libreTranslateApiKey: preferences[STORAGE_KEYS.LIBRE_TRANSLATE_API_KEY],
      offlineEngineEnabled,
      text: rawText,
      sourceLanguage: requestedSource,
      targetLanguage: effectiveTargetLanguage,
      baseLanguage,
      secondaryLanguage
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
      const redirectedTarget = secondaryLanguage;
      const redirectedResult = await requestTranslationByProvider({
        provider: activeProvider,
        apiKey,
        libreTranslateUrl: preferences[STORAGE_KEYS.LIBRE_TRANSLATE_URL],
        libreTranslateApiKey: preferences[STORAGE_KEYS.LIBRE_TRANSLATE_API_KEY],
        offlineEngineEnabled,
        text: rawText,
        sourceLanguage: detectedSourceLanguage,
        targetLanguage: redirectedTarget,
        baseLanguage,
        secondaryLanguage
      });

      if (!redirectedResult.ok) {
        return redirectedResult;
      }

      translationResult = redirectedResult;
      effectiveTargetLanguage = redirectedTarget;
      autoRedirected = true;
    }

    const finalDetectedSource = translationResult.data.detectedSourceLanguage ||
      (requestedSource !== DEFAULTS.AUTO_LANGUAGE ? requestedSource : secondaryLanguage);

    await recordSecondaryLanguageIfForeign(finalDetectedSource, baseLanguage);
    await recordSecondaryLanguageIfForeign(effectiveTargetLanguage, baseLanguage);

    const updatedHistory = await recordTranslationHistoryEntry({
      sourceText: trimmedText,
      translatedText: translationResult.data.translatedText,
      sourceLanguage: finalDetectedSource,
      targetLanguage: effectiveTargetLanguage,
      provider: activeProvider
    });

    return {
      ok: true,
      status: SESSION_STATUS.SUCCESS,
      data: {
        translatedText: translationResult.data.translatedText,
        detectedSourceLanguage: finalDetectedSource,
        effectiveTargetLanguage,
        provider: activeProvider,
        autoRedirected,
        history: updatedHistory
      }
    };
  }

  async function handleQuickSwitchProvider(payload) {
    const preferences = await getUserPreferences();
    const currentProvider = preferences[STORAGE_KEYS.PROVIDER];
    const requestedProvider = payload?.provider
      ? normalizeProviderId(payload.provider, DEFAULTS.PROVIDER)
      : getNextFreeProviderId(currentProvider);

    if (requestedProvider !== PROVIDERS.OFFLINE && isOfflineWorkerRunning()) {
      terminateOfflineWorker();
    }

    await saveUserPreferences({
      [STORAGE_KEYS.PROVIDER]: requestedProvider
    });

    return {
      ok: true,
      provider: requestedProvider
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
        if (selectedText && pushTextToOpenSidebars(selectedText)) {
          return;
        }
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

      if (message.type === MESSAGE_TYPES.GET_TRANSLATION_HISTORY) {
        return getTranslationHistory().then((history) => ({ ok: true, history }));
      }

      if (message.type === MESSAGE_TYPES.CLEAR_TRANSLATION_HISTORY) {
        return clearTranslationHistory().then((history) => ({ ok: true, history }));
      }

      if (message.type === MESSAGE_TYPES.QUICK_SWITCH_PROVIDER) {
        return handleQuickSwitchProvider(message.payload);
      }

      if (message.type === MESSAGE_TYPES.GET_OFFLINE_RUNTIME_STATUS) {
        return handleGetOfflineRuntimeStatus();
      }

      if (message.type === MESSAGE_TYPES.SET_OFFLINE_ENGINE_ENABLED) {
        return handleSetOfflineEngineEnabled(message.payload);
      }

      if (message.type === MESSAGE_TYPES.UNINSTALL_OFFLINE_MODELS) {
        return handleUninstallOfflineModels();
      }

      if (message.type === MESSAGE_TYPES.PAGE_TEXT_SELECTED) {
        const text = typeof message.payload?.text === "string" ? message.payload.text.trim() : "";
        const deliveredToSidebar = pushTextToOpenSidebars(text);
        return Promise.resolve({
          ok: true,
          sidebarOpen: openSidebarPorts.size > 0,
          deliveredToSidebar
        });
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
