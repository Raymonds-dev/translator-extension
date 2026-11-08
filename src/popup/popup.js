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

  const elements = {
    themeToggleBtn: document.getElementById("themeToggleBtn"),
    openSettingsHeaderBtn: document.getElementById("openSettingsHeaderBtn"),
    sourceLangBadge: document.getElementById("sourceLangBadge"),
    switchLanguagesBtn: document.getElementById("switchLanguagesBtn"),
    targetLangSelect: document.getElementById("targetLangSelect"),
    sourceInput: document.getElementById("sourceInput"),
    tempSessionIndicator: document.getElementById("tempSessionIndicator"),
    charCounter: document.getElementById("charCounter"),
    statusBanner: document.getElementById("statusBanner"),
    statusBannerText: document.getElementById("statusBannerText"),
    statusActionBtn: document.getElementById("statusActionBtn"),
    translatedOutput: document.getElementById("translatedOutput"),
    detectedHint: document.getElementById("detectedHint"),
    copyBtn: document.getElementById("copyBtn")
  };

  let baseLanguage = DEFAULTS.BASE_LANGUAGE;
  let currentTheme = DEFAULTS.THEME;
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

  function populateTargetLanguageSelect() {
    elements.targetLangSelect.innerHTML = "";
    for (const language of SUPPORTED_LANGUAGES) {
      const optionEl = document.createElement("option");
      optionEl.value = language.code;
      optionEl.textContent = language.label;
      elements.targetLangSelect.appendChild(optionEl);
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
      status === SESSION_STATUS.TEXT_TOO_LONG ||
      status === SESSION_STATUS.NETWORK_ERROR
    ) {
      elements.statusBanner.classList.remove("hidden");
      elements.statusBannerText.textContent = session.errorMessage || "";

      if (status === SESSION_STATUS.MISSING_API_KEY || status === SESSION_STATUS.INVALID_API_KEY) {
        elements.statusActionBtn.textContent = UI_MESSAGES.OPEN_OPTIONS_BUTTON;
        elements.statusActionBtn.classList.remove("hidden");
      } else if (status === SESSION_STATUS.NETWORK_ERROR) {
        elements.statusActionBtn.textContent = UI_MESSAGES.RETRY_BUTTON;
        elements.statusActionBtn.classList.remove("hidden");
      } else {
        elements.statusActionBtn.classList.add("hidden");
      }
    } else {
      elements.statusBanner.classList.add("hidden");
      elements.statusActionBtn.classList.add("hidden");
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
      elements.detectedHint.textContent = `${getLanguageLabel(session.detectedSourceLanguage || session.sourceLanguage)} → ${getLanguageLabel(session.targetLanguage)}`;
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
    session.errorMessage = null;
    renderSession();
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

    typingDebounceTimer = setTimeout(() => {
      const shouldAutoRedirect =
        session.sourceLanguage === DEFAULTS.AUTO_LANGUAGE &&
        !session.hasManualTargetOverride;
      executeTranslation({ allowAutoRedirect: shouldAutoRedirect });
    }, LIMITS.TYPING_DEBOUNCE_MS);
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

  async function handleCopyClick() {
    if (!session.translatedText) {
      return;
    }

    try {
      await navigator.clipboard.writeText(session.translatedText);
      elements.copyBtn.innerHTML = COPIED_ICON_SVG;
      elements.copyBtn.classList.add("copied");
      clearTimeout(copyFeedbackTimer);
      copyFeedbackTimer = setTimeout(() => {
        elements.copyBtn.innerHTML = COPY_ICON_SVG;
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

  function handleStatusActionClick() {
    if (
      session.status === SESSION_STATUS.MISSING_API_KEY ||
      session.status === SESSION_STATUS.INVALID_API_KEY
    ) {
      openExtensionOptions();
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
    renderSession();
  }

  async function bootstrapPopup() {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get("view") === "sidebar") {
      document.body.setAttribute("data-view", "sidebar");
    }

    populateTargetLanguageSelect();
    clearPopupSession();

    let bootstrap = {
      hasApiKey: false,
      baseLanguage: DEFAULTS.BASE_LANGUAGE,
      theme: DEFAULTS.THEME
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
    baseLanguage = normalizeLanguageCode(bootstrap.baseLanguage);
    session.targetLanguage = baseLanguage;

    const selectedText = await fetchActiveTabSelection();
    if (selectedText) {
      session.sourceText = selectedText;
      elements.sourceInput.value = selectedText;
    }

    elements.sourceInput.focus();

    if (!bootstrap.hasApiKey) {
      session.status = SESSION_STATUS.MISSING_API_KEY;
      session.errorMessage = UI_MESSAGES.MISSING_API_KEY;
      renderSession();
      return;
    }

    renderSession();

    if (session.sourceText.trim()) {
      await executeTranslation({ allowAutoRedirect: true });
    }
  }

  elements.themeToggleBtn.addEventListener("click", handleThemeToggle);
  elements.sourceInput.addEventListener("input", handleSourceInputChange);
  elements.switchLanguagesBtn.addEventListener("click", handleSwitchLanguages);
  elements.targetLangSelect.addEventListener("change", handleTargetLanguageChange);
  elements.copyBtn.addEventListener("click", handleCopyClick);
  elements.openSettingsHeaderBtn.addEventListener("click", openExtensionOptions);
  elements.statusActionBtn.addEventListener("click", handleStatusActionClick);

  window.addEventListener("pagehide", clearPopupSession);
  window.addEventListener("beforeunload", clearPopupSession);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      clearPopupSession();
    } else {
      bootstrapPopup();
    }
  });

  bootstrapPopup();
})(typeof globalThis !== "undefined" ? globalThis : window);
