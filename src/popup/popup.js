(function initPopupController(globalScope) {
  "use strict";

  const namespace = globalScope.TranslatorExt || {};
  const {
    LIMITS,
    STORAGE_KEYS,
    THEMES,
    DEFAULTS,
    SESSION_STATUS,
    MESSAGE_TYPES,
    UI_MESSAGES
  } = namespace.CONSTANTS;
  const {
    SUPPORTED_LANGUAGES,
    normalizeLanguageCode,
    getLanguageLabel
  } = namespace.Languages;
  const { PROVIDER_CATALOG, getProviderMetadata, normalizeProviderId } = namespace.Providers;
  const { saveUserPreferences } = namespace.Storage;

  const COPY_ICON_SVG = `
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
    </svg>
    <span>Copiar</span>
  `;

  const COPIED_ICON_SVG = `
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
      <polyline points="20 6 9 17 4 12"></polyline>
    </svg>
    <span>Copiado</span>
  `;

  const PENCIL_ICON_SVG = `
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M12 20h9"></path>
      <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
    </svg>
    <span>Editar</span>
  `;

  function setElementHtmlSafe(targetElement, htmlString) {
    targetElement.replaceChildren();
    const doc = new DOMParser().parseFromString(htmlString.trim(), "text/html");
    while (doc.body.firstChild) {
      targetElement.appendChild(document.importNode(doc.body.firstChild, true));
    }
  }

  const urlParams = new URLSearchParams(window.location.search);
  const isSidebarView = urlParams.get("view") === "sidebar";

  const elements = {
    quickProviderSelect: document.getElementById("quickProviderSelect"),
    historyToggleBtn: document.getElementById("historyToggleBtn"),
    themeToggleBtn: document.getElementById("themeToggleBtn"),
    openSettingsHeaderBtn: document.getElementById("openSettingsHeaderBtn"),
    translatorView: document.getElementById("translatorView"),
    historyView: document.getElementById("historyView"),
    historyCountLabel: document.getElementById("historyCountLabel"),
    clearHistoryBtn: document.getElementById("clearHistoryBtn"),
    clearHistoryConfirmGroup: document.getElementById("clearHistoryConfirmGroup"),
    confirmClearHistoryBtn: document.getElementById("confirmClearHistoryBtn"),
    cancelClearHistoryBtn: document.getElementById("cancelClearHistoryBtn"),
    historyList: document.getElementById("historyList"),
    sourceLangBadge: document.getElementById("sourceLangBadge"),
    switchLanguagesBtn: document.getElementById("switchLanguagesBtn"),
    targetLangSelect: document.getElementById("targetLangSelect"),
    sourceInput: document.getElementById("sourceInput"),
    tempSessionIndicator: document.getElementById("tempSessionIndicator"),
    charCounter: document.getElementById("charCounter"),
    translateNowBtn: document.getElementById("translateNowBtn"),
    offlineProgressContainer: document.getElementById("offlineProgressContainer"),
    offlineProgressText: document.getElementById("offlineProgressText"),
    offlineProgressFill: document.getElementById("offlineProgressFill"),
    statusBanner: document.getElementById("statusBanner"),
    statusBannerText: document.getElementById("statusBannerText"),
    statusActionBtn: document.getElementById("statusActionBtn"),
    statusSecondaryBtn: document.getElementById("statusSecondaryBtn"),
    translatedOutput: document.getElementById("translatedOutput"),
    detectedHint: document.getElementById("detectedHint"),
    copyBtn: document.getElementById("copyBtn")
  };

  let baseLanguage = DEFAULTS.BASE_LANGUAGE;
  let currentTheme = DEFAULTS.THEME;
  let activeProvider = DEFAULTS.PROVIDER;
  let autoTranslateOnType = DEFAULTS.AUTO_TRANSLATE_ON_TYPE;
  let typingDebounceMs = DEFAULTS.TYPING_DEBOUNCE_MS;
  let historyItems = [];
  let isHistoryViewOpen = false;
  let typingDebounceTimer = null;
  let copyFeedbackTimer = null;
  let activeRequestId = 0;

  const session = {
    sourceText: "",
    translatedText: "",
    sourceLanguage: DEFAULTS.AUTO_LANGUAGE,
    detectedSourceLanguage: null,
    targetLanguage: DEFAULTS.BASE_LANGUAGE,
    hasManualTargetOverride: false,
    status: SESSION_STATUS.IDLE,
    errorMessage: null
  };

  function applyTheme(themeValue) {
    currentTheme = themeValue === THEMES.LIGHT ? THEMES.LIGHT : THEMES.DARK;
    document.body.setAttribute("data-theme", currentTheme);
  }

  function populateProviderSelect() {
    elements.quickProviderSelect.replaceChildren();
    for (const provider of PROVIDER_CATALOG) {
      const optionEl = document.createElement("option");
      optionEl.value = provider.id;
      optionEl.textContent = provider.shortName || provider.name.split(" (")[0];
      elements.quickProviderSelect.appendChild(optionEl);
    }
    elements.quickProviderSelect.value = activeProvider;
  }

  function updateActiveProviderControl(providerId) {
    activeProvider = normalizeProviderId(providerId, DEFAULTS.PROVIDER);
    const meta = getProviderMetadata(activeProvider);
    elements.quickProviderSelect.value = activeProvider;
    elements.quickProviderSelect.title = `Fonte ativa: ${meta.name}`;
  }

  function populateTargetLanguageSelect() {
    elements.targetLangSelect.replaceChildren();
    for (const language of SUPPORTED_LANGUAGES) {
      const optionEl = document.createElement("option");
      optionEl.value = language.code;
      optionEl.textContent = language.label;
      elements.targetLangSelect.appendChild(optionEl);
    }
  }

  function resetClearHistoryConfirmation() {
    elements.clearHistoryConfirmGroup.classList.add("hidden");
    elements.clearHistoryBtn.classList.toggle("hidden", historyItems.length === 0);
  }

  function setHistoryViewVisible(visible) {
    isHistoryViewOpen = Boolean(visible);
    resetClearHistoryConfirmation();
    elements.translatorView.classList.toggle("hidden", isHistoryViewOpen);
    elements.historyView.classList.toggle("hidden", !isHistoryViewOpen);
    elements.historyToggleBtn.classList.toggle("active", isHistoryViewOpen);
    elements.historyToggleBtn.title = isHistoryViewOpen
      ? "Voltar para a tradução"
      : "Histórico de traduções";

    if (isHistoryViewOpen) {
      renderHistoryList();
    } else {
      elements.sourceInput.focus();
    }
  }

  function renderHistoryList() {
    const count = historyItems.length;
    elements.historyCountLabel.textContent = `Últimas traduções (${count}/${LIMITS.MAX_HISTORY_ITEMS})`;
    resetClearHistoryConfirmation();
    elements.historyList.replaceChildren();

    if (count === 0) {
      const emptyEl = document.createElement("div");
      emptyEl.className = "history-empty";
      emptyEl.textContent = "Nenhuma tradução no histórico ainda. As próximas consultas aparecerão aqui.";
      elements.historyList.appendChild(emptyEl);
      return;
    }

    for (const item of historyItems) {
      const card = document.createElement("article");
      card.className = "history-card";

      const header = document.createElement("div");
      header.className = "history-card-header";

      const langPair = document.createElement("span");
      langPair.className = "history-lang-pair";
      const providerMeta = getProviderMetadata(item.provider);
      langPair.textContent = `${getLanguageLabel(item.sourceLanguage)} → ${getLanguageLabel(item.targetLanguage)} · ${providerMeta.name.split(" ")[0]}`;

      const actions = document.createElement("div");
      actions.className = "history-card-actions";

      const editBtn = document.createElement("button");
      editBtn.type = "button";
      editBtn.className = "history-item-btn";
      editBtn.title = "Mover tradução para o texto livre para editar";
      setElementHtmlSafe(editBtn, PENCIL_ICON_SVG);
      editBtn.addEventListener("click", () => {
        handleEditHistoryItem(item);
      });

      const copyItemBtn = document.createElement("button");
      copyItemBtn.type = "button";
      copyItemBtn.className = "history-item-btn";
      copyItemBtn.title = "Copiar tradução novamente";
      setElementHtmlSafe(copyItemBtn, COPY_ICON_SVG);
      copyItemBtn.addEventListener("click", async () => {
        try {
          await navigator.clipboard.writeText(item.translatedText);
          setElementHtmlSafe(copyItemBtn, COPIED_ICON_SVG);
          copyItemBtn.classList.add("copied");
          setTimeout(() => {
            setElementHtmlSafe(copyItemBtn, COPY_ICON_SVG);
            copyItemBtn.classList.remove("copied");
          }, LIMITS.COPY_FEEDBACK_DURATION_MS);
        } catch (_err) {
          // Ignora erro de clipboard
        }
      });

      actions.appendChild(editBtn);
      actions.appendChild(copyItemBtn);
      header.appendChild(langPair);
      header.appendChild(actions);

      const sourceDiv = document.createElement("div");
      sourceDiv.className = "history-source-text";
      sourceDiv.textContent = item.sourceText;

      const translatedDiv = document.createElement("div");
      translatedDiv.className = "history-translated-text";
      translatedDiv.textContent = item.translatedText;

      card.appendChild(header);
      card.appendChild(sourceDiv);
      card.appendChild(translatedDiv);
      elements.historyList.appendChild(card);
    }
  }

  function handleEditHistoryItem(item) {
    setHistoryViewVisible(false);
    session.sourceLanguage = normalizeLanguageCode(item.targetLanguage);
    session.targetLanguage = normalizeLanguageCode(item.sourceLanguage);
    session.hasManualTargetOverride = true;
    session.sourceText = item.translatedText;
    elements.sourceInput.value = item.translatedText;
    elements.sourceInput.focus();
    renderSession();

    clearTimeout(typingDebounceTimer);
    executeTranslation({ allowAutoRedirect: false });
  }

  async function handleConfirmClearHistory() {
    try {
      await browser.runtime.sendMessage({
        type: MESSAGE_TYPES.CLEAR_TRANSLATION_HISTORY
      });
      historyItems = [];
      renderHistoryList();
    } catch (_err) {
      // Ignora erro
    }
  }

  async function fetchActiveTabSelection() {
    if (typeof browser === "undefined" || !browser.tabs) {
      return "";
    }

    try {
      const activeTabs = await browser.tabs.query({ active: true, currentWindow: true });
      const activeTab = activeTabs?.[0];
      if (!activeTab || typeof activeTab.id !== "number") {
        return "";
      }

      const response = await browser.tabs.sendMessage(activeTab.id, {
        type: MESSAGE_TYPES.GET_ACTIVE_SELECTION
      });
      return typeof response?.text === "string" ? response.text.trim() : "";
    } catch (_tabMessageError) {
      return "";
    }
  }

  function renderCharCounter() {
    const length = session.sourceText.length;
    elements.charCounter.textContent = `${length} / ${LIMITS.MAX_CHARS_PER_QUERY}`;
    elements.charCounter.classList.toggle("limit-exceeded", length > LIMITS.MAX_CHARS_PER_QUERY);
  }

  function renderSession() {
    renderCharCounter();

    if (session.sourceLanguage === DEFAULTS.AUTO_LANGUAGE) {
      elements.sourceLangBadge.textContent = session.detectedSourceLanguage
        ? `${getLanguageLabel(session.detectedSourceLanguage)} detectado`
        : "Detectar idioma";
    } else {
      elements.sourceLangBadge.textContent = getLanguageLabel(session.sourceLanguage);
    }

    elements.targetLangSelect.value = normalizeLanguageCode(session.targetLanguage);

    const isTemporaryTarget = normalizeLanguageCode(session.targetLanguage) !== normalizeLanguageCode(baseLanguage);
    elements.tempSessionIndicator.textContent = isTemporaryTarget
      ? `Idioma temporário · Idioma Mãe: ${getLanguageLabel(baseLanguage)}`
      : `Idioma Mãe: ${getLanguageLabel(baseLanguage)}`;

    const status = session.status;

    if (
      status === SESSION_STATUS.MISSING_API_KEY ||
      status === SESSION_STATUS.INVALID_API_KEY ||
      status === SESSION_STATUS.PROVIDER_LIMIT_ERROR ||
      status === SESSION_STATUS.TEXT_TOO_LONG ||
      status === SESSION_STATUS.NETWORK_ERROR
    ) {
      elements.statusBanner.classList.remove("hidden");
      elements.statusBannerText.textContent = session.errorMessage || "";

      if (status === SESSION_STATUS.MISSING_API_KEY || status === SESSION_STATUS.INVALID_API_KEY) {
        elements.statusActionBtn.textContent = UI_MESSAGES.QUICK_SWITCH_BUTTON;
        elements.statusActionBtn.classList.remove("hidden");
        elements.statusSecondaryBtn.textContent = UI_MESSAGES.OPEN_OPTIONS_BUTTON;
        elements.statusSecondaryBtn.classList.remove("hidden");
      } else if (status === SESSION_STATUS.PROVIDER_LIMIT_ERROR) {
        elements.statusActionBtn.textContent = UI_MESSAGES.QUICK_SWITCH_BUTTON;
        elements.statusActionBtn.classList.remove("hidden");
        elements.statusSecondaryBtn.textContent = UI_MESSAGES.OPEN_OPTIONS_BUTTON;
        elements.statusSecondaryBtn.classList.remove("hidden");
      } else if (status === SESSION_STATUS.NETWORK_ERROR) {
        elements.statusActionBtn.textContent = UI_MESSAGES.RETRY_BUTTON;
        elements.statusActionBtn.classList.remove("hidden");
        elements.statusSecondaryBtn.classList.add("hidden");
      } else {
        elements.statusActionBtn.classList.add("hidden");
        elements.statusSecondaryBtn.classList.add("hidden");
      }
    } else {
      elements.statusBanner.classList.add("hidden");
      elements.statusActionBtn.classList.add("hidden");
      elements.statusSecondaryBtn.classList.add("hidden");
    }

    if (status === SESSION_STATUS.LOADING) {
      elements.translatedOutput.textContent = "Traduzindo...";
      elements.translatedOutput.classList.add("placeholder");
      elements.copyBtn.classList.add("hidden");
      elements.detectedHint.textContent = "";
      return;
    }

    if (status === SESSION_STATUS.SUCCESS && session.translatedText) {
      elements.translatedOutput.textContent = session.translatedText;
      elements.translatedOutput.classList.remove("placeholder");
      elements.copyBtn.classList.remove("hidden");
      const meta = getProviderMetadata(activeProvider);
      elements.detectedHint.textContent = `${getLanguageLabel(session.detectedSourceLanguage || session.sourceLanguage)} → ${getLanguageLabel(session.targetLanguage)} · via ${meta.name}`;
      return;
    }

    elements.translatedOutput.textContent = "A tradução aparecerá aqui...";
    elements.translatedOutput.classList.add("placeholder");
    elements.copyBtn.classList.add("hidden");
    elements.detectedHint.textContent = "";
  }

  async function executeTranslation({ allowAutoRedirect = true } = {}) {
    const textToTranslate = session.sourceText;

    if (!textToTranslate || !textToTranslate.trim()) {
      session.status = SESSION_STATUS.IDLE;
      session.translatedText = "";
      renderSession();
      return;
    }

    if (textToTranslate.length > LIMITS.MAX_CHARS_PER_QUERY) {
      session.status = SESSION_STATUS.TEXT_TOO_LONG;
      session.errorMessage = UI_MESSAGES.TEXT_TOO_LONG;
      renderSession();
      return;
    }

    const requestId = ++activeRequestId;
    session.status = SESSION_STATUS.LOADING;
    session.errorMessage = null;
    renderSession();

    let response;
    try {
      response = await browser.runtime.sendMessage({
        type: MESSAGE_TYPES.TRANSLATE_TEXT,
        payload: {
          text: textToTranslate,
          sourceLanguage: session.sourceLanguage,
          targetLanguage: session.targetLanguage,
          allowAutoRedirect
        }
      });
    } catch (_error) {
      if (requestId !== activeRequestId) {
        return;
      }
      session.status = SESSION_STATUS.NETWORK_ERROR;
      session.errorMessage = UI_MESSAGES.NETWORK_ERROR;
      renderSession();
      return;
    }

    if (requestId !== activeRequestId) {
      return;
    }

    elements.offlineProgressContainer.classList.add("hidden");

    if (!response || !response.ok) {
      session.status = response?.status || SESSION_STATUS.NETWORK_ERROR;
      session.errorMessage = response?.errorMessage || UI_MESSAGES.NETWORK_ERROR;
      renderSession();
      return;
    }

    session.status = SESSION_STATUS.SUCCESS;
    session.translatedText = response.data.translatedText;
    session.detectedSourceLanguage = response.data.detectedSourceLanguage;
    if (response.data.effectiveTargetLanguage) {
      session.targetLanguage = normalizeLanguageCode(response.data.effectiveTargetLanguage);
    }
    if (response.data.provider) {
      updateActiveProviderControl(response.data.provider);
    }
    if (Array.isArray(response.data.history)) {
      historyItems = response.data.history;
    }
    session.errorMessage = null;
    renderSession();
  }

  function handleIncomingSidebarSelection(selectedText) {
    const trimmed = typeof selectedText === "string" ? selectedText.trim() : "";
    if (!trimmed) {
      return;
    }

    if (isHistoryViewOpen) {
      setHistoryViewVisible(false);
    }

    clearTimeout(typingDebounceTimer);
    session.sourceText = trimmed;
    session.sourceLanguage = DEFAULTS.AUTO_LANGUAGE;
    session.detectedSourceLanguage = null;
    if (!session.hasManualTargetOverride) {
      session.targetLanguage = baseLanguage;
    }
    elements.sourceInput.value = trimmed;
    renderSession();
    executeTranslation({ allowAutoRedirect: !session.hasManualTargetOverride });
  }

  function setupSidebarLiveConnection() {
    if (!isSidebarView || typeof browser === "undefined" || !browser.runtime || !browser.runtime.connect) {
      return;
    }

    try {
      const port = browser.runtime.connect({ name: "sidebar-live-channel" });
      port.onMessage.addListener((message) => {
        if (message && message.type === MESSAGE_TYPES.PAGE_TEXT_SELECTED) {
          handleIncomingSidebarSelection(message.payload?.text);
        }
      });
    } catch (_err) {
      // Ignora erro caso connect não esteja disponível
    }
  }

  function handleSourceInputChange() {
    const newText = elements.sourceInput.value;
    session.sourceText = newText;
    clearTimeout(typingDebounceTimer);

    if (newText.length > LIMITS.MAX_CHARS_PER_QUERY) {
      session.status = SESSION_STATUS.TEXT_TOO_LONG;
      session.errorMessage = UI_MESSAGES.TEXT_TOO_LONG;
      renderSession();
      return;
    }

    if (!newText.trim()) {
      session.status = SESSION_STATUS.IDLE;
      session.translatedText = "";
      session.errorMessage = null;
      renderSession();
      return;
    }

    renderCharCounter();

    if (autoTranslateOnType) {
      const delayMs = Math.max(
        LIMITS.MIN_TYPING_DEBOUNCE_MS,
        Number(typingDebounceMs) || DEFAULTS.TYPING_DEBOUNCE_MS
      );
      typingDebounceTimer = setTimeout(() => {
        const shouldAutoRedirect =
          session.sourceLanguage === DEFAULTS.AUTO_LANGUAGE &&
          !session.hasManualTargetOverride;
        executeTranslation({ allowAutoRedirect: shouldAutoRedirect });
      }, delayMs);
    }
  }

  function handleManualTranslateSubmit() {
    clearTimeout(typingDebounceTimer);
    session.sourceText = elements.sourceInput.value;
    const shouldAutoRedirect =
      session.sourceLanguage === DEFAULTS.AUTO_LANGUAGE &&
      !session.hasManualTargetOverride;
    executeTranslation({ allowAutoRedirect: shouldAutoRedirect });
  }

  function handleSwitchLanguages() {
    const effectiveSource = session.sourceLanguage === DEFAULTS.AUTO_LANGUAGE
      ? (session.detectedSourceLanguage || DEFAULTS.SECONDARY_LANGUAGE_DEFAULT)
      : session.sourceLanguage;

    const previousTarget = session.targetLanguage;
    session.sourceLanguage = normalizeLanguageCode(previousTarget);
    session.targetLanguage = normalizeLanguageCode(effectiveSource);
    session.hasManualTargetOverride = true;

    if (session.translatedText && session.translatedText.trim()) {
      session.sourceText = session.translatedText;
      elements.sourceInput.value = session.sourceText;
    }

    elements.sourceInput.focus();
    renderSession();

    if (session.sourceText.trim()) {
      clearTimeout(typingDebounceTimer);
      executeTranslation({ allowAutoRedirect: false });
    }
  }

  function handleTargetLanguageChange() {
    session.targetLanguage = normalizeLanguageCode(elements.targetLangSelect.value);
    session.hasManualTargetOverride = true;
    renderSession();

    if (session.sourceText.trim()) {
      clearTimeout(typingDebounceTimer);
      executeTranslation({ allowAutoRedirect: false });
    }
  }

  async function handleQuickProviderChange() {
    const chosenProvider = normalizeProviderId(elements.quickProviderSelect.value, DEFAULTS.PROVIDER);
    updateActiveProviderControl(chosenProvider);
    try {
      await browser.runtime.sendMessage({
        type: MESSAGE_TYPES.QUICK_SWITCH_PROVIDER,
        payload: { provider: chosenProvider }
      });
      if (session.sourceText.trim()) {
        clearTimeout(typingDebounceTimer);
        await executeTranslation({ allowAutoRedirect: false });
      }
    } catch (_err) {
      // Ignora erro
    }
  }

  async function handleCopyClick() {
    if (!session.translatedText) {
      return;
    }

    try {
      await navigator.clipboard.writeText(session.translatedText);
      setElementHtmlSafe(elements.copyBtn, COPIED_ICON_SVG);
      elements.copyBtn.classList.add("copied");
      clearTimeout(copyFeedbackTimer);
      copyFeedbackTimer = setTimeout(() => {
        setElementHtmlSafe(elements.copyBtn, COPY_ICON_SVG);
        elements.copyBtn.classList.remove("copied");
      }, LIMITS.COPY_FEEDBACK_DURATION_MS);
    } catch (_error) {
      // Ignora erro de clipboard
    }
  }

  async function handleThemeToggle() {
    const nextTheme = currentTheme === THEMES.DARK ? THEMES.LIGHT : THEMES.DARK;
    applyTheme(nextTheme);
    await saveUserPreferences({
      [STORAGE_KEYS.THEME]: nextTheme
    });
  }

  function openExtensionOptions() {
    browser.runtime.sendMessage({
      type: MESSAGE_TYPES.OPEN_OPTIONS_PAGE
    });
  }

  async function handleStatusActionClick() {
    if (
      session.status === SESSION_STATUS.PROVIDER_LIMIT_ERROR ||
      session.status === SESSION_STATUS.MISSING_API_KEY ||
      session.status === SESSION_STATUS.INVALID_API_KEY
    ) {
      try {
        const switched = await browser.runtime.sendMessage({
          type: MESSAGE_TYPES.QUICK_SWITCH_PROVIDER
        });
        if (switched?.provider) {
          updateActiveProviderControl(switched.provider);
        }
        await executeTranslation({ allowAutoRedirect: false });
      } catch (_err) {
        openExtensionOptions();
      }
      return;
    }

    if (session.status === SESSION_STATUS.NETWORK_ERROR) {
      executeTranslation({ allowAutoRedirect: false });
    }
  }

  function clearPopupSession() {
    clearTimeout(typingDebounceTimer);
    activeRequestId++;
    session.sourceText = "";
    session.translatedText = "";
    session.sourceLanguage = DEFAULTS.AUTO_LANGUAGE;
    session.detectedSourceLanguage = null;
    session.targetLanguage = baseLanguage;
    session.hasManualTargetOverride = false;
    session.status = SESSION_STATUS.IDLE;
    session.errorMessage = null;
    elements.sourceInput.value = "";
    elements.offlineProgressContainer.classList.add("hidden");
    renderSession();
  }

  async function bootstrapPopup() {
    if (isSidebarView) {
      document.body.setAttribute("data-view", "sidebar");
    }

    populateProviderSelect();
    populateTargetLanguageSelect();
    clearPopupSession();

    let bootstrap = {
      provider: DEFAULTS.PROVIDER,
      hasApiKey: false,
      baseLanguage: DEFAULTS.BASE_LANGUAGE,
      theme: DEFAULTS.THEME,
      history: []
    };

    try {
      const response = await browser.runtime.sendMessage({
        type: MESSAGE_TYPES.GET_SESSION_BOOTSTRAP
      });
      if (response && typeof response === "object") {
        bootstrap = response;
      }
    } catch (_error) {
      // Usa valores padrão
    }

    applyTheme(bootstrap.theme);
    updateActiveProviderControl(bootstrap.provider);
    baseLanguage = normalizeLanguageCode(bootstrap.baseLanguage);
    autoTranslateOnType = Boolean(bootstrap.autoTranslateOnType);
    typingDebounceMs = Number(bootstrap.typingDebounceMs) || DEFAULTS.TYPING_DEBOUNCE_MS;
    session.targetLanguage = baseLanguage;
    historyItems = Array.isArray(bootstrap.history) ? bootstrap.history : [];

    const selectedText = await fetchActiveTabSelection();
    if (selectedText) {
      session.sourceText = selectedText;
      elements.sourceInput.value = selectedText;
    }

    elements.sourceInput.focus();
    renderSession();

    if (session.sourceText.trim()) {
      await executeTranslation({ allowAutoRedirect: true });
    }
  }

  if (typeof browser !== "undefined" && browser.runtime && browser.runtime.onMessage) {
    browser.runtime.onMessage.addListener((message) => {
      if (!message) {
        return;
      }

      if (isSidebarView && message.type === MESSAGE_TYPES.PAGE_TEXT_SELECTED) {
        handleIncomingSidebarSelection(message.payload?.text);
        return;
      }

      if (message.type !== MESSAGE_TYPES.OFFLINE_DOWNLOAD_PROGRESS) {
        return;
      }

      const payload = message.payload || {};
      const pct = Number(payload.progress) || 0;
      elements.offlineProgressContainer.classList.remove("hidden");
      elements.offlineProgressText.textContent =
        payload.message || `Baixando pacote de tradução: ${pct}%...`;
      elements.offlineProgressFill.style.width = `${Math.min(100, Math.max(0, pct))}%`;

      if (pct >= 100) {
        setTimeout(() => {
          elements.offlineProgressContainer.classList.add("hidden");
        }, 700);
      }
    });
  }

  if (typeof browser !== "undefined" && browser.storage && browser.storage.onChanged) {
    browser.storage.onChanged.addListener((changes, areaName) => {
      if (areaName !== "local") {
        return;
      }
      if (changes[STORAGE_KEYS.TRANSLATION_HISTORY]) {
        historyItems = changes[STORAGE_KEYS.TRANSLATION_HISTORY].newValue || [];
        if (isHistoryViewOpen) {
          renderHistoryList();
        }
      }
      if (changes[STORAGE_KEYS.PROVIDER]) {
        updateActiveProviderControl(changes[STORAGE_KEYS.PROVIDER].newValue);
      }
      if (changes[STORAGE_KEYS.THEME]) {
        applyTheme(changes[STORAGE_KEYS.THEME].newValue);
      }
      if (changes[STORAGE_KEYS.AUTO_TRANSLATE_ON_TYPE]) {
        autoTranslateOnType = Boolean(changes[STORAGE_KEYS.AUTO_TRANSLATE_ON_TYPE].newValue);
      }
      if (changes[STORAGE_KEYS.TYPING_DEBOUNCE_MS]) {
        const val = Number(changes[STORAGE_KEYS.TYPING_DEBOUNCE_MS].newValue);
        if (Number.isFinite(val) && val >= LIMITS.MIN_TYPING_DEBOUNCE_MS) {
          typingDebounceMs = val;
        }
      }
    });
  }

  elements.quickProviderSelect.addEventListener("change", handleQuickProviderChange);
  elements.historyToggleBtn.addEventListener("click", () => {
    setHistoryViewVisible(!isHistoryViewOpen);
  });
  elements.clearHistoryBtn.addEventListener("click", () => {
    elements.clearHistoryBtn.classList.add("hidden");
    elements.clearHistoryConfirmGroup.classList.remove("hidden");
  });
  elements.cancelClearHistoryBtn.addEventListener("click", resetClearHistoryConfirmation);
  elements.confirmClearHistoryBtn.addEventListener("click", handleConfirmClearHistory);
  elements.themeToggleBtn.addEventListener("click", handleThemeToggle);
  elements.sourceInput.addEventListener("input", handleSourceInputChange);
  elements.sourceInput.addEventListener("keydown", (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
      event.preventDefault();
      handleManualTranslateSubmit();
    }
  });
  if (elements.translateNowBtn) {
    elements.translateNowBtn.addEventListener("click", handleManualTranslateSubmit);
  }
  elements.switchLanguagesBtn.addEventListener("click", handleSwitchLanguages);
  elements.targetLangSelect.addEventListener("change", handleTargetLanguageChange);
  elements.copyBtn.addEventListener("click", handleCopyClick);
  elements.openSettingsHeaderBtn.addEventListener("click", openExtensionOptions);
  elements.statusActionBtn.addEventListener("click", handleStatusActionClick);
  elements.statusSecondaryBtn.addEventListener("click", openExtensionOptions);

  if (!isSidebarView) {
    window.addEventListener("pagehide", clearPopupSession);
    window.addEventListener("beforeunload", clearPopupSession);
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) {
        clearPopupSession();
      } else {
        bootstrapPopup();
      }
    });
  }

  setupSidebarLiveConnection();
  bootstrapPopup();
})(typeof globalThis !== "undefined" ? globalThis : window);
