(function initTranslatorWidget(globalScope) {
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

  const ROOT_HOST_ID = "translator-ext-shadow-host";

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

  class TranslatorWidget {
    constructor() {
      this.hostElement = null;
      this.shadowRoot = null;
      this.elements = {};
      this.typingDebounceTimer = null;
      this.copyFeedbackTimer = null;
      this.activeRequestId = 0;

      this.baseLanguage = DEFAULTS.BASE_LANGUAGE;
      this.theme = DEFAULTS.THEME;
      this.modalOpacity = DEFAULTS.MODAL_OPACITY;
      this.session = this.createEmptySession();

      this.setupStorageSyncListener();
    }

    createEmptySession() {
      return {
        sourceText: "",
        translatedText: "",
        sourceLanguage: DEFAULTS.AUTO_LANGUAGE,
        detectedSourceLanguage: null,
        targetLanguage: this.baseLanguage,
        hasManualTargetOverride: false,
        status: SESSION_STATUS.IDLE,
        errorMessage: null
      };
    }

    setupStorageSyncListener() {
      if (typeof browser === "undefined" || !browser.storage || !browser.storage.onChanged) {
        return;
      }

      browser.storage.onChanged.addListener((changes, areaName) => {
        if (areaName !== "local") {
          return;
        }
        if (changes[STORAGE_KEYS.THEME]) {
          this.applyTheme(changes[STORAGE_KEYS.THEME].newValue);
        }
        if (changes[STORAGE_KEYS.MODAL_OPACITY]) {
          this.applyModalOpacity(changes[STORAGE_KEYS.MODAL_OPACITY].newValue);
        }
        if (changes[STORAGE_KEYS.BASE_LANGUAGE]) {
          this.baseLanguage = normalizeLanguageCode(changes[STORAGE_KEYS.BASE_LANGUAGE].newValue);
        }
      });
    }

    ensureMounted() {
      const mountTarget = document.body || document.documentElement;
      if (!mountTarget) {
        return false;
      }

      if (this.hostElement && mountTarget.contains(this.hostElement)) {
        return true;
      }

      const existingHost = document.getElementById(ROOT_HOST_ID);
      if (existingHost) {
        existingHost.remove();
      }

      this.hostElement = document.createElement("div");
      this.hostElement.id = ROOT_HOST_ID;
      this.shadowRoot = this.hostElement.attachShadow({ mode: "open" });

      const styleElement = document.createElement("style");
      styleElement.textContent = namespace.WIDGET_STYLES || "";

      const wrapper = document.createElement("div");
      wrapper.className = "widget-theme-root";
      wrapper.setAttribute("data-theme", this.theme);
      wrapper.style.setProperty("--modal-alpha", String(this.modalOpacity));
      wrapper.innerHTML = this.buildWidgetTemplate();

      this.shadowRoot.appendChild(styleElement);
      this.shadowRoot.appendChild(wrapper);
      mountTarget.appendChild(this.hostElement);

      this.cacheElements(wrapper);
      this.populateTargetLanguageOptions();
      this.bindInternalEvents();
      return true;
    }

    buildWidgetTemplate() {
      const minPercent = Math.round(LIMITS.MIN_MODAL_OPACITY * 100);
      const maxPercent = Math.round(LIMITS.MAX_MODAL_OPACITY * 100);
      const defaultPercent = Math.round(this.modalOpacity * 100);

      return `
        <button type="button" class="floating-trigger hidden" id="floatingTrigger" title="Traduzir seleção" aria-label="Traduzir seleção">
          <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect width="64" height="64" rx="14" fill="#2563EB"/>
            <path d="M14 20H38M26 14V20M33 20C31.5 29 25.5 36.5 16 41M21 26C24.5 31 29.5 35.5 36 38" stroke="#FFFFFF" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M34 50L42 28L50 50M36.5 44H47.5" stroke="#93C5FD" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>

        <section class="translator-modal hidden" id="translatorModal" role="dialog" aria-label="Tradutor Rápido">
          <header class="modal-top-bar">
            <div class="brand-group">
              <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect width="64" height="64" rx="14" fill="#2563EB"/>
                <path d="M14 20H38M26 14V20M33 20C31.5 29 25.5 36.5 16 41M21 26C24.5 31 29.5 35.5 36 38" stroke="#FFFFFF" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round"/>
                <path d="M34 50L42 28L50 50M36.5 44H47.5" stroke="#93C5FD" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
              <span class="brand-title">Tradutor Rápido</span>
            </div>
            <div class="top-actions">
              <button type="button" class="icon-btn" id="glassToggleBtn" title="Ajustar efeito de vidro">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/>
                </svg>
              </button>
              <button type="button" class="icon-btn" id="themeToggleBtn" title="Alternar tema claro ou escuro">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
                </svg>
              </button>
              <button type="button" class="icon-btn" id="openOptionsHeaderBtn" title="Opções">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <circle cx="12" cy="12" r="3"/>
                  <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
                </svg>
              </button>
              <button type="button" class="icon-btn" id="closeModalBtn" title="Fechar">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round">
                  <path d="M18 6L6 18M6 6l12 12"/>
                </svg>
              </button>
            </div>
          </header>

          <div class="glass-control-bar hidden" id="glassControlBar">
            <span>Opacidade do vidro</span>
            <input
              type="range"
              class="opacity-slider"
              id="opacitySlider"
              min="${minPercent}"
              max="${maxPercent}"
              value="${defaultPercent}"
            >
            <span id="opacityValueLabel">${defaultPercent}%</span>
          </div>

          <div class="lang-controls-bar">
            <span class="source-lang-badge" id="sourceLangBadge" title="Idioma identificado">Detectar idioma</span>
            <button type="button" class="switch-btn" id="switchLanguagesBtn" title="Inverter idiomas e editar tradução">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M7 16V4M7 4L3 8M7 4L11 8"/>
                <path d="M17 8V20M17 20L21 16M17 20L13 16"/>
              </svg>
            </button>
            <select class="target-lang-select" id="targetLangSelect" title="Mudar idioma desta tradução"></select>
          </div>

          <div class="modal-body">
            <div class="input-section">
              <span class="section-label">Texto</span>
              <textarea
                class="source-input"
                id="sourceInput"
                placeholder="Digite ou selecione um texto em qualquer idioma..."
                rows="3"
              ></textarea>
              <div class="input-meta">
                <span id="tempSessionIndicator"></span>
                <span class="char-counter" id="charCounter">0 / ${LIMITS.MAX_CHARS_PER_QUERY}</span>
              </div>
            </div>

            <div class="status-banner hidden" id="statusBanner">
              <span id="statusBannerText"></span>
              <button type="button" class="action-btn hidden" id="statusActionBtn"></button>
            </div>

            <div class="result-section" id="resultSection">
              <div class="result-header">
                <span class="section-label">TRADUÇÃO</span>
                <button type="button" class="copy-header-btn hidden" id="copyBtn" title="Copiar tradução">
                  ${COPY_ICON_SVG}
                </button>
              </div>
              <div class="translated-output placeholder" id="translatedOutput">A tradução aparecerá aqui...</div>
              <span class="detected-hint" id="detectedHint"></span>
            </div>
          </div>
        </section>
      `;
    }

    cacheElements(themeRoot) {
      const root = this.shadowRoot;
      this.elements = {
        themeRoot,
        floatingTrigger: root.getElementById("floatingTrigger"),
        translatorModal: root.getElementById("translatorModal"),
        glassToggleBtn: root.getElementById("glassToggleBtn"),
        glassControlBar: root.getElementById("glassControlBar"),
        opacitySlider: root.getElementById("opacitySlider"),
        opacityValueLabel: root.getElementById("opacityValueLabel"),
        themeToggleBtn: root.getElementById("themeToggleBtn"),
        openOptionsHeaderBtn: root.getElementById("openOptionsHeaderBtn"),
        closeModalBtn: root.getElementById("closeModalBtn"),
        sourceLangBadge: root.getElementById("sourceLangBadge"),
        switchLanguagesBtn: root.getElementById("switchLanguagesBtn"),
        targetLangSelect: root.getElementById("targetLangSelect"),
        sourceInput: root.getElementById("sourceInput"),
        tempSessionIndicator: root.getElementById("tempSessionIndicator"),
        charCounter: root.getElementById("charCounter"),
        statusBanner: root.getElementById("statusBanner"),
        statusBannerText: root.getElementById("statusBannerText"),
        statusActionBtn: root.getElementById("statusActionBtn"),
        resultSection: root.getElementById("resultSection"),
        translatedOutput: root.getElementById("translatedOutput"),
        detectedHint: root.getElementById("detectedHint"),
        copyBtn: root.getElementById("copyBtn")
      };
    }

    applyTheme(themeValue) {
      this.theme = themeValue === THEMES.LIGHT ? THEMES.LIGHT : THEMES.DARK;
      if (this.elements.themeRoot) {
        this.elements.themeRoot.setAttribute("data-theme", this.theme);
      }
    }

    applyModalOpacity(opacityValue) {
      const numeric = Number(opacityValue);
      const clamped = Number.isNaN(numeric)
        ? DEFAULTS.MODAL_OPACITY
        : Math.min(LIMITS.MAX_MODAL_OPACITY, Math.max(LIMITS.MIN_MODAL_OPACITY, numeric));

      this.modalOpacity = clamped;
      if (this.elements.themeRoot) {
        this.elements.themeRoot.style.setProperty("--modal-alpha", String(clamped));
      }
      if (this.elements.opacitySlider && this.elements.opacityValueLabel) {
        const percent = Math.round(clamped * 100);
        this.elements.opacitySlider.value = String(percent);
        this.elements.opacityValueLabel.textContent = `${percent}%`;
      }
    }

    populateTargetLanguageOptions() {
      const selectEl = this.elements.targetLangSelect;
      if (!selectEl) {
        return;
      }

      selectEl.innerHTML = "";
      for (const language of SUPPORTED_LANGUAGES) {
        const optionEl = document.createElement("option");
        optionEl.value = language.code;
        optionEl.textContent = language.label;
        selectEl.appendChild(optionEl);
      }
    }

    bindInternalEvents() {
      const {
        floatingTrigger,
        translatorModal,
        glassToggleBtn,
        glassControlBar,
        opacitySlider,
        themeToggleBtn,
        openOptionsHeaderBtn,
        closeModalBtn,
        sourceInput,
        switchLanguagesBtn,
        targetLangSelect,
        copyBtn,
        statusActionBtn
      } = this.elements;

      floatingTrigger.addEventListener("mousedown", (event) => {
        event.preventDefault();
        event.stopPropagation();
      });

      floatingTrigger.addEventListener("mouseup", (event) => {
        event.preventDefault();
        event.stopPropagation();
      });

      floatingTrigger.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        if (typeof this.onTriggerClickCallback === "function") {
          this.onTriggerClickCallback();
        }
      });

      translatorModal.addEventListener("mousedown", (event) => {
        event.stopPropagation();
      });

      translatorModal.addEventListener("mouseup", (event) => {
        event.stopPropagation();
      });

      glassToggleBtn.addEventListener("click", () => {
        glassControlBar.classList.toggle("hidden");
      });

      opacitySlider.addEventListener("input", () => {
        const ratio = Number(opacitySlider.value) / 100;
        this.applyModalOpacity(ratio);
        if (typeof browser !== "undefined" && browser.storage && browser.storage.local) {
          browser.storage.local.set({ [STORAGE_KEYS.MODAL_OPACITY]: this.modalOpacity });
        }
      });

      themeToggleBtn.addEventListener("click", () => {
        const nextTheme = this.theme === THEMES.DARK ? THEMES.LIGHT : THEMES.DARK;
        this.applyTheme(nextTheme);
        if (typeof browser !== "undefined" && browser.storage && browser.storage.local) {
          browser.storage.local.set({ [STORAGE_KEYS.THEME]: nextTheme });
        }
      });

      openOptionsHeaderBtn.addEventListener("click", () => {
        browser.runtime.sendMessage({
          type: MESSAGE_TYPES.OPEN_OPTIONS_PAGE
        });
      });

      closeModalBtn.addEventListener("click", () => {
        this.hideAll();
      });

      sourceInput.addEventListener("input", () => {
        this.handleSourceInputChange(sourceInput.value);
      });

      switchLanguagesBtn.addEventListener("click", () => {
        this.handleSwitchLanguages();
      });

      targetLangSelect.addEventListener("change", () => {
        this.handleTemporaryTargetLanguageChange(targetLangSelect.value);
      });

      copyBtn.addEventListener("click", () => {
        this.handleCopyTranslation();
      });

      statusActionBtn.addEventListener("click", () => {
        this.handleStatusActionClick();
      });
    }

    setOnTriggerClick(callback) {
      this.onTriggerClickCallback = callback;
    }

    isEventInsideWidget(event) {
      if (!this.hostElement || !event) {
        return false;
      }
      if (typeof event.composedPath === "function") {
        return event.composedPath().includes(this.hostElement);
      }
      return this.hostElement.contains(event.target);
    }

    isModalOpen() {
      return Boolean(
        this.elements.translatorModal &&
        !this.elements.translatorModal.classList.contains("hidden")
      );
    }

    isTriggerVisible() {
      return Boolean(
        this.elements.floatingTrigger &&
        !this.elements.floatingTrigger.classList.contains("hidden")
      );
    }

    clampCoordinatesToViewport(x, y, elementWidth, elementHeight) {
      const margin = LIMITS.VIEWPORT_MARGIN_PX;
      const maxX = Math.max(margin, window.innerWidth - elementWidth - margin);
      const maxY = Math.max(margin, window.innerHeight - elementHeight - margin);

      return {
        left: Math.min(Math.max(margin, Math.round(x)), maxX),
        top: Math.min(Math.max(margin, Math.round(y)), maxY)
      };
    }

    showFloatingTrigger(anchorRect) {
      if (!this.ensureMounted() || !anchorRect) {
        return;
      }

      const desiredX = anchorRect.right + LIMITS.ICON_OFFSET_PX;
      const desiredY = anchorRect.bottom + LIMITS.ICON_OFFSET_PX;
      const position = this.clampCoordinatesToViewport(
        desiredX,
        desiredY,
        LIMITS.ICON_SIZE_PX,
        LIMITS.ICON_SIZE_PX
      );

      const triggerEl = this.elements.floatingTrigger;
      triggerEl.style.left = `${position.left}px`;
      triggerEl.style.top = `${position.top}px`;
      triggerEl.classList.remove("hidden");
    }

    hideFloatingTrigger() {
      if (!this.elements.floatingTrigger) {
        return;
      }
      this.elements.floatingTrigger.classList.add("hidden");
    }

    hideModal() {
      if (!this.elements.translatorModal) {
        return;
      }
      clearTimeout(this.typingDebounceTimer);
      this.activeRequestId += 1;
      this.elements.translatorModal.classList.add("hidden");
    }

    hideAll() {
      this.hideFloatingTrigger();
      this.hideModal();
    }

    async openCenteredModal({ initialText = "", focusInput = false } = {}) {
      if (!this.ensureMounted()) {
        return;
      }
      this.hideFloatingTrigger();

      const bootstrap = await this.fetchBootstrapInfo();
      this.baseLanguage = normalizeLanguageCode(bootstrap.baseLanguage);
      this.applyTheme(bootstrap.theme);
      this.applyModalOpacity(bootstrap.modalOpacity);

      this.session = {
        sourceText: initialText,
        translatedText: "",
        sourceLanguage: DEFAULTS.AUTO_LANGUAGE,
        detectedSourceLanguage: null,
        targetLanguage: this.baseLanguage,
        hasManualTargetOverride: false,
        status: SESSION_STATUS.IDLE,
        errorMessage: null
      };

      this.elements.translatorModal.classList.remove("hidden");
      this.elements.sourceInput.value = initialText;
      this.renderSession();

      if (focusInput || !initialText.trim()) {
        setTimeout(() => {
          this.elements.sourceInput.focus();
          if (initialText) {
            this.elements.sourceInput.select();
          }
        }, 20);
      }

      if (!bootstrap.hasApiKey) {
        this.session.status = SESSION_STATUS.MISSING_API_KEY;
        this.session.errorMessage = UI_MESSAGES.MISSING_API_KEY;
        this.renderSession();
        return;
      }

      if (initialText.trim()) {
        await this.executeTranslation({ allowAutoRedirect: true });
      }
    }

    async fetchBootstrapInfo() {
      try {
        const response = await browser.runtime.sendMessage({
          type: MESSAGE_TYPES.GET_SESSION_BOOTSTRAP
        });
        if (response && typeof response === "object") {
          return response;
        }
      } catch (_bootstrapError) {
        // Fallback padrão
      }
      return {
        hasApiKey: false,
        baseLanguage: DEFAULTS.BASE_LANGUAGE,
        lastSecondaryLanguage: DEFAULTS.SECONDARY_LANGUAGE_DEFAULT,
        theme: DEFAULTS.THEME,
        modalOpacity: DEFAULTS.MODAL_OPACITY
      };
    }

    handleSourceInputChange(newText) {
      this.session.sourceText = newText;
      clearTimeout(this.typingDebounceTimer);

      if (newText.length > LIMITS.MAX_CHARS_PER_QUERY) {
        this.session.status = SESSION_STATUS.TEXT_TOO_LONG;
        this.session.errorMessage = UI_MESSAGES.TEXT_TOO_LONG;
        this.renderSession();
        return;
      }

      if (!newText.trim()) {
        this.session.status = SESSION_STATUS.IDLE;
        this.session.translatedText = "";
        this.session.errorMessage = null;
        this.renderSession();
        return;
      }

      this.renderCharCounter();

      this.typingDebounceTimer = setTimeout(() => {
        const shouldAutoRedirect =
          this.session.sourceLanguage === DEFAULTS.AUTO_LANGUAGE &&
          !this.session.hasManualTargetOverride;
        this.executeTranslation({ allowAutoRedirect: shouldAutoRedirect });
      }, LIMITS.TYPING_DEBOUNCE_MS);
    }

    handleSwitchLanguages() {
      const effectiveSource = this.session.sourceLanguage === DEFAULTS.AUTO_LANGUAGE
        ? (this.session.detectedSourceLanguage || DEFAULTS.SECONDARY_LANGUAGE_DEFAULT)
        : this.session.sourceLanguage;

      const previousTarget = this.session.targetLanguage;

      this.session.sourceLanguage = normalizeLanguageCode(previousTarget);
      this.session.targetLanguage = normalizeLanguageCode(effectiveSource);
      this.session.hasManualTargetOverride = true;

      if (this.session.translatedText && this.session.translatedText.trim()) {
        this.session.sourceText = this.session.translatedText;
        this.elements.sourceInput.value = this.session.sourceText;
      }

      this.elements.sourceInput.focus();
      this.renderSession();

      if (this.session.sourceText.trim()) {
        clearTimeout(this.typingDebounceTimer);
        this.executeTranslation({ allowAutoRedirect: false });
      }
    }

    handleTemporaryTargetLanguageChange(newTargetLanguage) {
      this.session.targetLanguage = normalizeLanguageCode(newTargetLanguage);
      this.session.hasManualTargetOverride = true;
      this.renderSession();

      if (this.session.sourceText.trim()) {
        clearTimeout(this.typingDebounceTimer);
        this.executeTranslation({ allowAutoRedirect: false });
      }
    }

    async executeTranslation({ allowAutoRedirect = false } = {}) {
      const textToTranslate = this.session.sourceText;

      if (!textToTranslate || !textToTranslate.trim()) {
        this.session.status = SESSION_STATUS.IDLE;
        this.session.translatedText = "";
        this.renderSession();
        return;
      }

      if (textToTranslate.length > LIMITS.MAX_CHARS_PER_QUERY) {
        this.session.status = SESSION_STATUS.TEXT_TOO_LONG;
        this.session.errorMessage = UI_MESSAGES.TEXT_TOO_LONG;
        this.renderSession();
        return;
      }

      const requestId = ++this.activeRequestId;
      this.session.status = SESSION_STATUS.LOADING;
      this.session.errorMessage = null;
      this.renderSession();

      let response;
      try {
        response = await browser.runtime.sendMessage({
          type: MESSAGE_TYPES.TRANSLATE_TEXT,
          payload: {
            text: textToTranslate,
            sourceLanguage: this.session.sourceLanguage,
            targetLanguage: this.session.targetLanguage,
            allowAutoRedirect
          }
        });
      } catch (_sendError) {
        if (requestId !== this.activeRequestId) {
          return;
        }
        this.session.status = SESSION_STATUS.NETWORK_ERROR;
        this.session.errorMessage = UI_MESSAGES.NETWORK_ERROR;
        this.renderSession();
        return;
      }

      if (requestId !== this.activeRequestId) {
        return;
      }

      if (!response || !response.ok) {
        this.session.status = response?.status || SESSION_STATUS.NETWORK_ERROR;
        this.session.errorMessage = response?.errorMessage || UI_MESSAGES.NETWORK_ERROR;
        this.renderSession();
        return;
      }

      this.session.status = SESSION_STATUS.SUCCESS;
      this.session.translatedText = response.data.translatedText;
      this.session.detectedSourceLanguage = response.data.detectedSourceLanguage;
      if (response.data.effectiveTargetLanguage) {
        this.session.targetLanguage = normalizeLanguageCode(response.data.effectiveTargetLanguage);
      }
      this.session.errorMessage = null;
      this.renderSession();
    }

    async handleCopyTranslation() {
      if (!this.session.translatedText) {
        return;
      }

      try {
        await navigator.clipboard.writeText(this.session.translatedText);
        const copyBtn = this.elements.copyBtn;
        copyBtn.innerHTML = COPIED_ICON_SVG;
        copyBtn.classList.add("copied");
        clearTimeout(this.copyFeedbackTimer);
        this.copyFeedbackTimer = setTimeout(() => {
          copyBtn.innerHTML = COPY_ICON_SVG;
          copyBtn.classList.remove("copied");
        }, LIMITS.COPY_FEEDBACK_DURATION_MS);
      } catch (_clipboardError) {
        // Ignora caso o navegador bloqueie acesso ao clipboard
      }
    }

    handleStatusActionClick() {
      const currentStatus = this.session.status;
      if (
        currentStatus === SESSION_STATUS.MISSING_API_KEY ||
        currentStatus === SESSION_STATUS.INVALID_API_KEY
      ) {
        browser.runtime.sendMessage({
          type: MESSAGE_TYPES.OPEN_OPTIONS_PAGE
        });
        this.hideAll();
        return;
      }

      if (currentStatus === SESSION_STATUS.NETWORK_ERROR) {
        this.executeTranslation({ allowAutoRedirect: false });
      }
    }

    renderCharCounter() {
      const length = this.session.sourceText.length;
      const counterEl = this.elements.charCounter;
      counterEl.textContent = `${length} / ${LIMITS.MAX_CHARS_PER_QUERY}`;
      counterEl.classList.toggle("limit-exceeded", length > LIMITS.MAX_CHARS_PER_QUERY);
    }

    renderSession() {
      const {
        sourceLangBadge,
        targetLangSelect,
        tempSessionIndicator,
        statusBanner,
        statusBannerText,
        statusActionBtn,
        translatedOutput,
        detectedHint,
        copyBtn
      } = this.elements;

      this.renderCharCounter();

      if (this.session.sourceLanguage === DEFAULTS.AUTO_LANGUAGE) {
        if (this.session.detectedSourceLanguage) {
          sourceLangBadge.textContent = `${getLanguageLabel(this.session.detectedSourceLanguage)} detectado`;
        } else {
          sourceLangBadge.textContent = "Detectar idioma";
        }
      } else {
        sourceLangBadge.textContent = getLanguageLabel(this.session.sourceLanguage);
      }

      targetLangSelect.value = normalizeLanguageCode(this.session.targetLanguage);

      const isTemporaryTarget = normalizeLanguageCode(this.session.targetLanguage) !== normalizeLanguageCode(this.baseLanguage);
      tempSessionIndicator.textContent = isTemporaryTarget
        ? `Idioma temporário · Idioma Mãe: ${getLanguageLabel(this.baseLanguage)}`
        : `Idioma Mãe: ${getLanguageLabel(this.baseLanguage)}`;

      const status = this.session.status;

      if (
        status === SESSION_STATUS.MISSING_API_KEY ||
        status === SESSION_STATUS.INVALID_API_KEY ||
        status === SESSION_STATUS.TEXT_TOO_LONG ||
        status === SESSION_STATUS.NETWORK_ERROR
      ) {
        statusBanner.classList.remove("hidden");
        statusBannerText.textContent = this.session.errorMessage || "";

        if (status === SESSION_STATUS.MISSING_API_KEY || status === SESSION_STATUS.INVALID_API_KEY) {
          statusActionBtn.textContent = UI_MESSAGES.OPEN_OPTIONS_BUTTON;
          statusActionBtn.classList.remove("hidden");
        } else if (status === SESSION_STATUS.NETWORK_ERROR) {
          statusActionBtn.textContent = UI_MESSAGES.RETRY_BUTTON;
          statusActionBtn.classList.remove("hidden");
        } else {
          statusActionBtn.classList.add("hidden");
        }
      } else {
        statusBanner.classList.add("hidden");
        statusActionBtn.classList.add("hidden");
      }

      if (status === SESSION_STATUS.LOADING) {
        translatedOutput.textContent = "Traduzindo...";
        translatedOutput.classList.add("placeholder");
        copyBtn.classList.add("hidden");
        detectedHint.textContent = "";
        return;
      }

      if (status === SESSION_STATUS.SUCCESS && this.session.translatedText) {
        translatedOutput.textContent = this.session.translatedText;
        translatedOutput.classList.remove("placeholder");
        copyBtn.classList.remove("hidden");
        detectedHint.textContent = `${getLanguageLabel(this.session.detectedSourceLanguage || this.session.sourceLanguage)} → ${getLanguageLabel(this.session.targetLanguage)}`;
        return;
      }

      translatedOutput.textContent = "A tradução aparecerá aqui...";
      translatedOutput.classList.add("placeholder");
      copyBtn.classList.add("hidden");
      detectedHint.textContent = "";
    }
  }

  namespace.TranslatorWidget = TranslatorWidget;
  globalScope.TranslatorExt = namespace;
})(typeof globalThis !== "undefined" ? globalThis : window);
