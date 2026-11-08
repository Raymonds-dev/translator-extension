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
  const { PROVIDER_CATALOG, getProviderMetadata, normalizeProviderId } = namespace.Providers;

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
    for (const node of Array.from(doc.body.childNodes)) {
      targetElement.appendChild(document.importNode(node, true));
    }
  }

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
      this.activeProvider = DEFAULTS.PROVIDER;
      this.autoTranslateOnType = DEFAULTS.AUTO_TRANSLATE_ON_TYPE;
      this.typingDebounceMs = DEFAULTS.TYPING_DEBOUNCE_MS;
      this.modalPosition = {
        isCustom: false,
        x: null,
        y: null
      };
      this.historyItems = [];
      this.isHistoryViewOpen = false;
      this.dragState = null;

      this.boundOnMouseMove = (event) => this.handleDragMouseMove(event);
      this.boundOnMouseUp = () => this.finishModalDrag();
      this.boundOnBlur = () => this.finishModalDrag();

      this.session = this.createEmptySession();

      this.setupStorageSyncListener();
      this.setupRuntimeMessageListener();
      this.setupWindowResizeListener();
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
        if (changes[STORAGE_KEYS.PROVIDER]) {
          this.updateActiveProviderControl(changes[STORAGE_KEYS.PROVIDER].newValue);
        }
        if (changes[STORAGE_KEYS.AUTO_TRANSLATE_ON_TYPE]) {
          this.autoTranslateOnType = Boolean(changes[STORAGE_KEYS.AUTO_TRANSLATE_ON_TYPE].newValue);
        }
        if (changes[STORAGE_KEYS.TYPING_DEBOUNCE_MS]) {
          const val = Number(changes[STORAGE_KEYS.TYPING_DEBOUNCE_MS].newValue);
          if (Number.isFinite(val) && val >= LIMITS.MIN_TYPING_DEBOUNCE_MS) {
            this.typingDebounceMs = val;
          }
        }
        if (changes[STORAGE_KEYS.TRANSLATION_HISTORY]) {
          this.historyItems = changes[STORAGE_KEYS.TRANSLATION_HISTORY].newValue || [];
          if (this.isHistoryViewOpen && this.isModalOpen()) {
            this.renderHistoryList();
          }
        }
        if (changes[STORAGE_KEYS.MODAL_POSITION] && !this.dragState) {
          this.modalPosition = changes[STORAGE_KEYS.MODAL_POSITION].newValue || {
            isCustom: false,
            x: null,
            y: null
          };
          if (this.isModalOpen()) {
            this.applyModalPositionToElement();
          }
        }
      });
    }

    setupRuntimeMessageListener() {
      if (typeof browser === "undefined" || !browser.runtime || !browser.runtime.onMessage) {
        return;
      }

      browser.runtime.onMessage.addListener((message) => {
        if (!message || message.type !== MESSAGE_TYPES.OFFLINE_DOWNLOAD_PROGRESS) {
          return;
        }
        if (!this.elements.offlineProgressContainer) {
          return;
        }

        const payload = message.payload || {};
        const pct = Number(payload.progress) || 0;
        this.elements.offlineProgressContainer.classList.remove("hidden");
        this.elements.offlineProgressText.textContent =
          payload.message || `Baixando pacote de tradução: ${pct}%...`;
        this.elements.offlineProgressFill.style.width = `${Math.min(100, Math.max(0, pct))}%`;

        if (pct >= 100) {
          setTimeout(() => {
            if (this.elements.offlineProgressContainer) {
              this.elements.offlineProgressContainer.classList.add("hidden");
            }
          }, 700);
        }
      });
    }

    setupWindowResizeListener() {
      window.addEventListener("resize", () => {
        if (this.isModalOpen() && this.modalPosition && this.modalPosition.isCustom) {
          this.applyModalPositionToElement();
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
      setElementHtmlSafe(wrapper, this.buildWidgetTemplate());

      this.shadowRoot.appendChild(styleElement);
      this.shadowRoot.appendChild(wrapper);
      mountTarget.appendChild(this.hostElement);

      this.cacheElements(wrapper);
      this.populateProviderOptions();
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

        <section class="translator-modal hidden" id="translatorModal" role="dialog" aria-label="TraduzAí">
          <header class="modal-top-bar" id="modalDragHandle" title="Arraste para mover o modal na tela">
            <div class="brand-group">
              <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect width="64" height="64" rx="14" fill="#2563EB"/>
                <path d="M14 20H38M26 14V20M33 20C31.5 29 25.5 36.5 16 41M21 26C24.5 31 29.5 35.5 36 38" stroke="#FFFFFF" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round"/>
                <path d="M34 50L42 28L50 50M36.5 44H47.5" stroke="#93C5FD" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
              <span class="brand-title">TraduzAí</span>
            </div>
            <div class="top-actions">
              <select class="quick-provider-select" id="quickProviderSelect" title="Trocar fonte de tradução"></select>
              <button type="button" class="icon-btn hidden" id="resetPositionBtn" title="Centralizar modal na tela" aria-label="Centralizar modal">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <circle cx="12" cy="12" r="3"></circle>
                  <path d="M3 12h3m12 0h3M12 3v3m0 12v3"></path>
                  <rect x="5" y="5" width="14" height="14" rx="2"></rect>
                </svg>
              </button>
              <button type="button" class="icon-btn" id="historyToggleBtn" title="Histórico de traduções" aria-label="Histórico de traduções">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path>
                  <path d="M3 3v5h5"></path>
                  <path d="M12 7v5l4 2"></path>
                </svg>
              </button>
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

          <!-- VISÃO 1: TRADUTOR -->
          <div id="translatorView">
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
                  <div class="input-meta-right">
                    <span class="char-counter" id="charCounter">0 / ${LIMITS.MAX_CHARS_PER_QUERY}</span>
                    <button type="button" class="translate-submit-btn" id="translateNowBtn" title="Traduzir texto (Ctrl + Enter)">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M5 12h14"></path>
                        <path d="m12 5 7 7-7 7"></path>
                      </svg>
                      <span>Traduzir</span>
                    </button>
                  </div>
                </div>
              </div>

              <div class="offline-progress-container hidden" id="offlineProgressContainer">
                <div class="offline-progress-header">
                  <span id="offlineProgressText">Baixando pacote de tradução: 0%...</span>
                </div>
                <div class="offline-progress-track">
                  <div class="offline-progress-fill" id="offlineProgressFill" style="width: 0%"></div>
                </div>
              </div>

              <div class="status-banner hidden" id="statusBanner">
                <span id="statusBannerText"></span>
                <div class="status-actions-row">
                  <button type="button" class="action-btn hidden" id="statusActionBtn"></button>
                  <button type="button" class="secondary-action-btn hidden" id="statusSecondaryBtn"></button>
                </div>
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
          </div>

          <!-- VISÃO 2: HISTÓRICO -->
          <div id="historyView" class="hidden">
            <div class="history-toolbar">
              <span class="history-count-label" id="historyCountLabel">Últimas traduções (0/20)</span>
              <button type="button" class="clear-history-btn" id="clearHistoryBtn">
                Limpar histórico
              </button>
              <div class="clear-confirm-group hidden" id="clearHistoryConfirmGroup">
                <span class="clear-confirm-label">Apagar tudo?</span>
                <button type="button" class="confirm-danger-btn" id="confirmClearHistoryBtn">Sim, apagar</button>
                <button type="button" class="confirm-cancel-btn" id="cancelClearHistoryBtn">Cancelar</button>
              </div>
            </div>
            <div class="history-list" id="historyList"></div>
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
        modalDragHandle: root.getElementById("modalDragHandle"),
        quickProviderSelect: root.getElementById("quickProviderSelect"),
        resetPositionBtn: root.getElementById("resetPositionBtn"),
        historyToggleBtn: root.getElementById("historyToggleBtn"),
        glassToggleBtn: root.getElementById("glassToggleBtn"),
        glassControlBar: root.getElementById("glassControlBar"),
        opacitySlider: root.getElementById("opacitySlider"),
        opacityValueLabel: root.getElementById("opacityValueLabel"),
        themeToggleBtn: root.getElementById("themeToggleBtn"),
        openOptionsHeaderBtn: root.getElementById("openOptionsHeaderBtn"),
        closeModalBtn: root.getElementById("closeModalBtn"),
        translatorView: root.getElementById("translatorView"),
        historyView: root.getElementById("historyView"),
        historyCountLabel: root.getElementById("historyCountLabel"),
        clearHistoryBtn: root.getElementById("clearHistoryBtn"),
        clearHistoryConfirmGroup: root.getElementById("clearHistoryConfirmGroup"),
        confirmClearHistoryBtn: root.getElementById("confirmClearHistoryBtn"),
        cancelClearHistoryBtn: root.getElementById("cancelClearHistoryBtn"),
        historyList: root.getElementById("historyList"),
        sourceLangBadge: root.getElementById("sourceLangBadge"),
        switchLanguagesBtn: root.getElementById("switchLanguagesBtn"),
        targetLangSelect: root.getElementById("targetLangSelect"),
        sourceInput: root.getElementById("sourceInput"),
        tempSessionIndicator: root.getElementById("tempSessionIndicator"),
        charCounter: root.getElementById("charCounter"),
        translateNowBtn: root.getElementById("translateNowBtn"),
        offlineProgressContainer: root.getElementById("offlineProgressContainer"),
        offlineProgressText: root.getElementById("offlineProgressText"),
        offlineProgressFill: root.getElementById("offlineProgressFill"),
        statusBanner: root.getElementById("statusBanner"),
        statusBannerText: root.getElementById("statusBannerText"),
        statusActionBtn: root.getElementById("statusActionBtn"),
        statusSecondaryBtn: root.getElementById("statusSecondaryBtn"),
        resultSection: root.getElementById("resultSection"),
        translatedOutput: root.getElementById("translatedOutput"),
        detectedHint: root.getElementById("detectedHint"),
        copyBtn: root.getElementById("copyBtn")
      };
    }

    populateProviderOptions() {
      const selectEl = this.elements.quickProviderSelect;
      if (!selectEl) {
        return;
      }
      selectEl.replaceChildren();
      for (const provider of PROVIDER_CATALOG) {
        const optionEl = document.createElement("option");
        optionEl.value = provider.id;
        optionEl.textContent = provider.shortName || provider.name.split(" (")[0];
        selectEl.appendChild(optionEl);
      }
      selectEl.value = this.activeProvider;
    }

    updateActiveProviderControl(providerId) {
      this.activeProvider = normalizeProviderId(providerId, DEFAULTS.PROVIDER);
      if (this.elements.quickProviderSelect) {
        this.elements.quickProviderSelect.value = this.activeProvider;
      }
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

    clampCoordinatesToViewport(x, y, elementWidth, elementHeight) {
      const margin = LIMITS.VIEWPORT_MARGIN_PX;
      const maxX = Math.max(margin, window.innerWidth - elementWidth - margin);
      const maxY = Math.max(margin, window.innerHeight - elementHeight - margin);

      return {
        left: Math.min(Math.max(margin, Math.round(x)), maxX),
        top: Math.min(Math.max(margin, Math.round(y)), maxY)
      };
    }

    applyModalPositionToElement() {
      const modalEl = this.elements.translatorModal;
      if (!modalEl) {
        return;
      }

      if (this.modalPosition && this.modalPosition.isCustom && Number.isFinite(this.modalPosition.x) && Number.isFinite(this.modalPosition.y)) {
        const rect = modalEl.getBoundingClientRect();
        const width = rect.width || LIMITS.MODAL_WIDTH_PX;
        const height = rect.height || 340;
        const clamped = this.clampCoordinatesToViewport(
          this.modalPosition.x,
          this.modalPosition.y,
          width,
          height
        );

        modalEl.classList.add("custom-position");
        modalEl.style.left = `${clamped.left}px`;
        modalEl.style.top = `${clamped.top}px`;
        this.elements.resetPositionBtn.classList.remove("hidden");
      } else {
        modalEl.classList.remove("custom-position");
        modalEl.style.left = "50%";
        modalEl.style.top = "50%";
        this.elements.resetPositionBtn.classList.add("hidden");
      }
    }

    persistModalPosition(newPosition) {
      this.modalPosition = newPosition;
      this.applyModalPositionToElement();
      if (typeof browser !== "undefined" && browser.storage && browser.storage.local) {
        browser.storage.local.set({
          [STORAGE_KEYS.MODAL_POSITION]: newPosition
        });
      }
    }

    resetModalToCenter() {
      this.persistModalPosition({
        isCustom: false,
        x: null,
        y: null
      });
    }

    handleDragMouseMove(event) {
      if (!this.dragState) {
        return;
      }

      // Se o botão esquerdo do mouse não estiver pressionado, encerra o arraste imediatamente
      if (typeof event.buttons === "number" && (event.buttons & 1) === 0) {
        this.finishModalDrag();
        return;
      }

      const desiredX = event.clientX - this.dragState.offsetX;
      const desiredY = event.clientY - this.dragState.offsetY;
      const clamped = this.clampCoordinatesToViewport(
        desiredX,
        desiredY,
        this.dragState.width,
        this.dragState.height
      );

      this.dragState.currentX = clamped.left;
      this.dragState.currentY = clamped.top;
      this.dragState.hasMoved = true;

      this.elements.translatorModal.style.left = `${clamped.left}px`;
      this.elements.translatorModal.style.top = `${clamped.top}px`;
    }

    finishModalDrag() {
      if (!this.dragState) {
        return;
      }
      const finishedDrag = this.dragState;
      this.dragState = null;

      window.removeEventListener("mousemove", this.boundOnMouseMove, true);
      window.removeEventListener("mouseup", this.boundOnMouseUp, true);
      window.removeEventListener("blur", this.boundOnBlur);

      if (this.elements.translatorModal) {
        this.elements.translatorModal.classList.remove("dragging");
      }

      if (finishedDrag.hasMoved) {
        this.persistModalPosition({
          isCustom: true,
          x: finishedDrag.currentX,
          y: finishedDrag.currentY
        });
      }
    }

    resetClearHistoryConfirmation() {
      if (!this.elements.clearHistoryConfirmGroup || !this.elements.clearHistoryBtn) {
        return;
      }
      this.elements.clearHistoryConfirmGroup.classList.add("hidden");
      this.elements.clearHistoryBtn.classList.toggle("hidden", this.historyItems.length === 0);
    }

    setHistoryViewVisible(visible) {
      this.isHistoryViewOpen = Boolean(visible);
      this.resetClearHistoryConfirmation();
      this.elements.translatorView.classList.toggle("hidden", this.isHistoryViewOpen);
      this.elements.historyView.classList.toggle("hidden", !this.isHistoryViewOpen);
      this.elements.historyToggleBtn.classList.toggle("active", this.isHistoryViewOpen);
      this.elements.historyToggleBtn.title = this.isHistoryViewOpen
        ? "Voltar para a tradução"
        : "Histórico de traduções";

      if (this.isHistoryViewOpen) {
        this.renderHistoryList();
      } else {
        this.elements.sourceInput.focus();
      }
    }

    renderHistoryList() {
      const count = this.historyItems.length;
      this.elements.historyCountLabel.textContent = `Últimas traduções (${count}/${LIMITS.MAX_HISTORY_ITEMS})`;
      this.resetClearHistoryConfirmation();
      this.elements.historyList.replaceChildren();

      if (count === 0) {
        const emptyEl = document.createElement("div");
        emptyEl.className = "history-empty";
        emptyEl.textContent = "Nenhuma tradução no histórico ainda.";
        this.elements.historyList.appendChild(emptyEl);
        return;
      }

      for (const item of this.historyItems) {
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
          this.handleEditHistoryItem(item);
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
        this.elements.historyList.appendChild(card);
      }
    }

    handleEditHistoryItem(item) {
      this.setHistoryViewVisible(false);
      this.session.sourceLanguage = normalizeLanguageCode(item.targetLanguage);
      this.session.targetLanguage = normalizeLanguageCode(item.sourceLanguage);
      this.session.hasManualTargetOverride = true;
      this.session.sourceText = item.translatedText;
      this.elements.sourceInput.value = item.translatedText;
      this.elements.sourceInput.focus();
      this.renderSession();

      clearTimeout(this.typingDebounceTimer);
      this.executeTranslation({ allowAutoRedirect: false });
    }

    async handleConfirmClearHistory() {
      try {
        await browser.runtime.sendMessage({
          type: MESSAGE_TYPES.CLEAR_TRANSLATION_HISTORY
        });
        this.historyItems = [];
        this.renderHistoryList();
      } catch (_err) {
        // Ignora erro
      }
    }

    populateTargetLanguageOptions() {
      const selectEl = this.elements.targetLangSelect;
      if (!selectEl) {
        return;
      }

      selectEl.replaceChildren();
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
        modalDragHandle,
        quickProviderSelect,
        resetPositionBtn,
        historyToggleBtn,
        clearHistoryBtn,
        clearHistoryConfirmGroup,
        confirmClearHistoryBtn,
        cancelClearHistoryBtn,
        glassToggleBtn,
        glassControlBar,
        opacitySlider,
        themeToggleBtn,
        openOptionsHeaderBtn,
        closeModalBtn,
        sourceInput,
        translateNowBtn,
        switchLanguagesBtn,
        targetLangSelect,
        copyBtn,
        statusActionBtn,
        statusSecondaryBtn
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

      // Lógica de Arraste (Drag & Clamp) do Modal
      modalDragHandle.addEventListener("mousedown", (event) => {
        if (event.button !== 0) {
          return;
        }
        // Ignora cliques em botões ou no seletor rápido de fonte dentro do cabeçalho
        if (
          event.target &&
          typeof event.target.closest === "function" &&
          event.target.closest("button, select, option, input, a")
        ) {
          return;
        }

        event.preventDefault();
        const rect = translatorModal.getBoundingClientRect();
        this.dragState = {
          offsetX: event.clientX - rect.left,
          offsetY: event.clientY - rect.top,
          width: rect.width,
          height: rect.height,
          currentX: rect.left,
          currentY: rect.top,
          hasMoved: false
        };

        translatorModal.classList.add("custom-position", "dragging");
        translatorModal.style.left = `${Math.round(rect.left)}px`;
        translatorModal.style.top = `${Math.round(rect.top)}px`;

        window.addEventListener("mousemove", this.boundOnMouseMove, true);
        window.addEventListener("mouseup", this.boundOnMouseUp, true);
        window.addEventListener("blur", this.boundOnBlur);
      });

      quickProviderSelect.addEventListener("change", async () => {
        const chosenProvider = normalizeProviderId(quickProviderSelect.value, DEFAULTS.PROVIDER);
        this.updateActiveProviderControl(chosenProvider);
        try {
          await browser.runtime.sendMessage({
            type: MESSAGE_TYPES.QUICK_SWITCH_PROVIDER,
            payload: { provider: chosenProvider }
          });
          if (this.session.sourceText && this.session.sourceText.trim()) {
            clearTimeout(this.typingDebounceTimer);
            await this.executeTranslation({ allowAutoRedirect: false });
          }
        } catch (_err) {
          // Ignora erro
        }
      });

      resetPositionBtn.addEventListener("click", () => {
        this.resetModalToCenter();
      });

      historyToggleBtn.addEventListener("click", () => {
        this.setHistoryViewVisible(!this.isHistoryViewOpen);
      });

      clearHistoryBtn.addEventListener("click", () => {
        clearHistoryBtn.classList.add("hidden");
        clearHistoryConfirmGroup.classList.remove("hidden");
      });

      cancelClearHistoryBtn.addEventListener("click", () => {
        this.resetClearHistoryConfirmation();
      });

      confirmClearHistoryBtn.addEventListener("click", () => {
        this.handleConfirmClearHistory();
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

      sourceInput.addEventListener("keydown", (event) => {
        if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
          event.preventDefault();
          this.handleManualTranslateSubmit();
        }
      });

      if (translateNowBtn) {
        translateNowBtn.addEventListener("click", () => {
          this.handleManualTranslateSubmit();
        });
      }

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

      statusSecondaryBtn.addEventListener("click", () => {
        browser.runtime.sendMessage({
          type: MESSAGE_TYPES.OPEN_OPTIONS_PAGE
        });
        this.hideAll();
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
      this.finishModalDrag();
      clearTimeout(this.typingDebounceTimer);
      this.activeRequestId += 1;
      this.elements.translatorModal.classList.add("hidden");
      if (this.elements.offlineProgressContainer) {
        this.elements.offlineProgressContainer.classList.add("hidden");
      }
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
      this.autoTranslateOnType = Boolean(bootstrap.autoTranslateOnType);
      this.typingDebounceMs = Number(bootstrap.typingDebounceMs) || DEFAULTS.TYPING_DEBOUNCE_MS;
      this.applyTheme(bootstrap.theme);
      this.applyModalOpacity(bootstrap.modalOpacity);
      this.updateActiveProviderControl(bootstrap.provider);
      this.modalPosition = bootstrap.modalPosition || { isCustom: false, x: null, y: null };
      this.historyItems = Array.isArray(bootstrap.history) ? bootstrap.history : [];
      this.setHistoryViewVisible(false);

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
      this.applyModalPositionToElement();
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
        provider: DEFAULTS.PROVIDER,
        hasApiKey: false,
        baseLanguage: DEFAULTS.BASE_LANGUAGE,
        lastSecondaryLanguage: DEFAULTS.SECONDARY_LANGUAGE_DEFAULT,
        theme: DEFAULTS.THEME,
        modalOpacity: DEFAULTS.MODAL_OPACITY,
        modalPosition: DEFAULTS.MODAL_POSITION,
        history: []
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

      if (this.autoTranslateOnType) {
        const delayMs = Math.max(
          LIMITS.MIN_TYPING_DEBOUNCE_MS,
          Number(this.typingDebounceMs) || DEFAULTS.TYPING_DEBOUNCE_MS
        );
        this.typingDebounceTimer = setTimeout(() => {
          const shouldAutoRedirect =
            this.session.sourceLanguage === DEFAULTS.AUTO_LANGUAGE &&
            !this.session.hasManualTargetOverride;
          this.executeTranslation({ allowAutoRedirect: shouldAutoRedirect });
        }, delayMs);
      }
    }

    handleManualTranslateSubmit() {
      clearTimeout(this.typingDebounceTimer);
      this.session.sourceText = this.elements.sourceInput.value;
      const shouldAutoRedirect =
        this.session.sourceLanguage === DEFAULTS.AUTO_LANGUAGE &&
        !this.session.hasManualTargetOverride;
      this.executeTranslation({ allowAutoRedirect: shouldAutoRedirect });
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

      this.elements.offlineProgressContainer.classList.add("hidden");

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
      if (response.data.provider) {
        this.updateActiveProviderControl(response.data.provider);
      }
      if (Array.isArray(response.data.history)) {
        this.historyItems = response.data.history;
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
        setElementHtmlSafe(copyBtn, COPIED_ICON_SVG);
        copyBtn.classList.add("copied");
        clearTimeout(this.copyFeedbackTimer);
        this.copyFeedbackTimer = setTimeout(() => {
          setElementHtmlSafe(copyBtn, COPY_ICON_SVG);
          copyBtn.classList.remove("copied");
        }, LIMITS.COPY_FEEDBACK_DURATION_MS);
      } catch (_clipboardError) {
        // Ignora caso o navegador bloqueie acesso ao clipboard
      }
    }

    async handleStatusActionClick() {
      const currentStatus = this.session.status;
      if (
        currentStatus === SESSION_STATUS.PROVIDER_LIMIT_ERROR ||
        currentStatus === SESSION_STATUS.MISSING_API_KEY ||
        currentStatus === SESSION_STATUS.INVALID_API_KEY
      ) {
        try {
          const switched = await browser.runtime.sendMessage({
            type: MESSAGE_TYPES.QUICK_SWITCH_PROVIDER
          });
          if (switched?.provider) {
            this.updateActiveProviderControl(switched.provider);
          }
          await this.executeTranslation({ allowAutoRedirect: false });
        } catch (_err) {
          browser.runtime.sendMessage({
            type: MESSAGE_TYPES.OPEN_OPTIONS_PAGE
          });
        }
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
        statusSecondaryBtn,
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
        status === SESSION_STATUS.PROVIDER_LIMIT_ERROR ||
        status === SESSION_STATUS.TEXT_TOO_LONG ||
        status === SESSION_STATUS.NETWORK_ERROR
      ) {
        statusBanner.classList.remove("hidden");
        statusBannerText.textContent = this.session.errorMessage || "";

        if (
          status === SESSION_STATUS.MISSING_API_KEY ||
          status === SESSION_STATUS.INVALID_API_KEY ||
          status === SESSION_STATUS.PROVIDER_LIMIT_ERROR
        ) {
          statusActionBtn.textContent = UI_MESSAGES.QUICK_SWITCH_BUTTON;
          statusActionBtn.classList.remove("hidden");
          statusSecondaryBtn.textContent = UI_MESSAGES.OPEN_OPTIONS_BUTTON;
          statusSecondaryBtn.classList.remove("hidden");
        } else if (status === SESSION_STATUS.NETWORK_ERROR) {
          statusActionBtn.textContent = UI_MESSAGES.RETRY_BUTTON;
          statusActionBtn.classList.remove("hidden");
          statusSecondaryBtn.classList.add("hidden");
        } else {
          statusActionBtn.classList.add("hidden");
          statusSecondaryBtn.classList.add("hidden");
        }
      } else {
        statusBanner.classList.add("hidden");
        statusActionBtn.classList.add("hidden");
        statusSecondaryBtn.classList.add("hidden");
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
        const meta = getProviderMetadata(this.activeProvider);
        detectedHint.textContent = `${getLanguageLabel(this.session.detectedSourceLanguage || this.session.sourceLanguage)} → ${getLanguageLabel(this.session.targetLanguage)} · via ${meta.name}`;
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
