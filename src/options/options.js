(function initOptionsPage(globalScope) {
  "use strict";

  const namespace = globalScope.TranslatorExt || {};
  const { PROVIDERS, STORAGE_KEYS, THEMES, COMMAND_NAMES, DEFAULTS, LIMITS, MESSAGE_TYPES, EXTERNAL_URLS } = namespace.CONSTANTS;
  const {
    SUPPORTED_LANGUAGES,
    normalizeLanguageCode,
    areSameLanguages,
    resolveFallbackSecondaryLanguage
  } = namespace.Languages;
  const { PROVIDER_CATALOG, getProviderMetadata, normalizeProviderId } = namespace.Providers;
  const { getUserPreferences, saveUserPreferences, clampModalOpacity, clampTypingDebounceMs } = namespace.Storage;

  const CHECK_ICON_SVG = `
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
      <polyline points="20 6 9 17 4 12"></polyline>
    </svg>
  `;

  const CLIPBOARD_ICON_SVG = `
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
    </svg>
  `;

  function setElementHtmlSafe(targetElement, htmlString) {
    targetElement.replaceChildren();
    const doc = new DOMParser().parseFromString(htmlString.trim(), "text/html");
    for (const node of Array.from(doc.body.childNodes)) {
      targetElement.appendChild(document.importNode(node, true));
    }
  }

  const WIZARD_ICONS = Object.freeze({
    download: `
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
        <polyline points="7 10 12 15 17 10"></polyline>
        <line x1="12" y1="15" x2="12" y2="3"></line>
      </svg>
    `,
    terminal: `
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="4 17 10 11 4 5"></polyline>
        <line x1="12" y1="19" x2="20" y2="19"></line>
      </svg>
    `,
    server: `
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <rect x="2" y="2" width="20" height="8" rx="2" ry="2"></rect>
        <rect x="2" y="14" width="20" height="8" rx="2" ry="2"></rect>
        <line x1="6" y1="6" x2="6.01" y2="6"></line>
        <line x1="6" y1="18" x2="6.01" y2="18"></line>
      </svg>
    `,
    plug: `
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
        <polyline points="22 4 12 14.01 9 11.01"></polyline>
      </svg>
    `,
    key: `
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"></path>
      </svg>
    `,
    cpu: `
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <rect x="4" y="4" width="16" height="16" rx="2" ry="2"></rect>
        <rect x="9" y="9" width="6" height="6"></rect>
        <line x1="9" y1="1" x2="9" y2="4"></line>
        <line x1="15" y1="1" x2="15" y2="4"></line>
        <line x1="9" y1="20" x2="9" y2="23"></line>
        <line x1="15" y1="20" x2="15" y2="23"></line>
        <line x1="20" y1="9" x2="23" y2="9"></line>
        <line x1="20" y1="14" x2="23" y2="14"></line>
        <line x1="1" y1="9" x2="4" y2="9"></line>
        <line x1="1" y1="14" x2="4" y2="14"></line>
      </svg>
    `,
  });

  const WIZARD_GUIDES = Object.freeze({
    libretranslate: {
      badge: "Mini-Servidor Local · LibreTranslate",
      title: "Como rodar o LibreTranslate na sua máquina",
      subtitle: "Configure um mini-servidor local gratuito, privado e sem limites de requisições.",
      steps: [
        {
          id: "libre-choice",
          shortTitle: "Ambiente",
          icon: WIZARD_ICONS.cpu,
          heading: "Como você prefere rodar o servidor?",
          description: "Escolha apenas uma das opções abaixo. O restante do tutorial mostrará somente os comandos para o caminho que você escolher:",
        },
        {
          id: "libre-reqs",
          shortTitle: "Requisitos",
          icon: WIZARD_ICONS.download,
        },
        {
          id: "libre-run",
          shortTitle: "Servidor",
          icon: WIZARD_ICONS.terminal,
        },
      ],
    },
    google: {
      badge: "API Oficial · Google Cloud",
      title: "Como criar sua Chave Pessoal no Google Cloud",
      subtitle: "Caso prefira usar a API empresarial v2 oficial com sua própria conta.",
      steps: [
        {
          id: "gcp-project",
          shortTitle: "Projeto",
          icon: WIZARD_ICONS.server,
          heading: "Acessar o Console e Criar um Projeto",
          description: "Entre no Google Cloud Console com sua conta Google e crie um projeto novo (ou selecione um existente) no menu do topo.",
          box: {
            title: "1. Console do Google Cloud",
            tag: "Conta Google",
            text: "A API oficial exige que um projeto esteja vinculado a uma conta de faturamento ativa (o Google oferece uma cota gratuita mensal generosa para novos usuários).",
            commands: [],
          },
          links: [
            {
              title: "Criar Projeto no Google Cloud",
              subtitle: "console.cloud.google.com/projectcreate",
              url: "https://console.cloud.google.com/projectcreate",
            },
            {
              title: "Documentação Oficial Cloud Translation",
              subtitle: "cloud.google.com/translate/docs/setup",
              url: "https://cloud.google.com/translate/docs/setup",
            },
          ],
        },
        {
          id: "gcp-api",
          shortTitle: "Ativar API",
          icon: WIZARD_ICONS.plug,
          heading: "Ativar a Cloud Translation API",
          description: 'Com o seu projeto selecionado, abra a Biblioteca de APIs, busque por "Cloud Translation API" e clique em Ativar.',
          box: {
            title: "2. Biblioteca de APIs",
            tag: "Cloud Translation API",
            text: 'Use o link oficial abaixo para ir direto à página da Cloud Translation API no seu console e clique no botão azul "Ativar".',
            commands: [],
          },
          links: [
            {
              title: "Página Direta da Cloud Translation API",
              subtitle: "console.cloud.google.com/apis/library/translate.googleapis.com",
              url: "https://console.cloud.google.com/apis/library/translate.googleapis.com",
            },
          ],
        },
        {
          id: "gcp-key",
          shortTitle: "Credencial",
          icon: WIZARD_ICONS.key,
          heading: "Gerar sua Chave de API (API Key)",
          description: 'Abra a tela de Credenciais, clique em "+ Criar Credenciais" → "Chave de API", copie o código gerado e cole no campo de chave desta página.',
          box: {
            title: "3. Copiar e Colar no TraduzAí",
            tag: "Salvo localmente",
            text: "Assim que colar sua chave no campo da aba Fontes de Tradução, o TraduzAí salvará automaticamente no seu navegador.",
            commands: [],
          },
          links: [
            {
              title: "Painel de Credenciais do Google Cloud",
              subtitle: "console.cloud.google.com/apis/credentials",
              url: "https://console.cloud.google.com/apis/credentials",
            },
          ],
        },
      ],
    },
  });

  const elements = {
    form: document.getElementById("optionsForm"),
    openWelcomeBtn: document.getElementById("openWelcomeBtn"),
    themeToggleBtn: document.getElementById("themeToggleBtn"),
    tabButtons: document.querySelectorAll(".tab-nav-btn"),
    tabPanels: document.querySelectorAll(".tab-panel"),
    baseLanguageSelect: document.getElementById("baseLanguageSelect"),
    secondaryLanguageSelect: document.getElementById("secondaryLanguageSelect"),
    typingModePill: document.getElementById("typingModePill"),
    autoTranslateOnTypeInput: document.getElementById("autoTranslateOnTypeInput"),
    typingDelayConfigBox: document.getElementById("typingDelayConfigBox"),
    typingDebounceInput: document.getElementById("typingDebounceInput"),
    typingDebounceValue: document.getElementById("typingDebounceValue"),
    activeProviderPill: document.getElementById("activeProviderPill"),
    providerSelectorToggleBtn: document.getElementById("providerSelectorToggleBtn"),
    activeProviderLogoImg: document.getElementById("activeProviderLogoImg"),
    activeProviderLogoFallback: document.getElementById("activeProviderLogoFallback"),
    activeProviderName: document.getElementById("activeProviderName"),
    activeProviderTagline: document.getElementById("activeProviderTagline"),
    providerToggleActionText: document.getElementById("providerToggleActionText"),
    providerDeckContainer: document.getElementById("providerDeckContainer"),
    providerDetailsPanel: document.getElementById("providerDetailsPanel"),
    detailsDescription: document.getElementById("detailsDescription"),
    detailsLimitationsList: document.getElementById("detailsLimitationsList"),
    providerCreditsRow: document.getElementById("providerCreditsRow"),
    offlineManagementSection: document.getElementById("offlineManagementSection"),
    offlineEngineStatusLabel: document.getElementById("offlineEngineStatusLabel"),
    toggleOfflineEngineBtn: document.getElementById("toggleOfflineEngineBtn"),
    offlineModelsSummary: document.getElementById("offlineModelsSummary"),
    uninstallOfflineModelsBtn: document.getElementById("uninstallOfflineModelsBtn"),
    uninstallOfflineConfirmGroup: document.getElementById("uninstallOfflineConfirmGroup"),
    confirmUninstallOfflineBtn: document.getElementById("confirmUninstallOfflineBtn"),
    cancelUninstallOfflineBtn: document.getElementById("cancelUninstallOfflineBtn"),
    offlineInstalledModelsList: document.getElementById("offlineInstalledModelsList"),
    googleKeySection: document.getElementById("googleKeySection"),
    libreTranslateSection: document.getElementById("libreTranslateSection"),
    useLocalLibreBtn: document.getElementById("useLocalLibreBtn"),
    usePublicLibreBtn: document.getElementById("usePublicLibreBtn"),
    testLibreServerBtn: document.getElementById("testLibreServerBtn"),
    libreConnectionStatus: document.getElementById("libreConnectionStatus"),
    wizardBannerButtons: document.querySelectorAll(".open-wizard-banner-btn"),
    stepWizardBackdrop: document.getElementById("stepWizardBackdrop"),
    wizardBadgePill: document.getElementById("wizardBadgePill"),
    wizardModalTitle: document.getElementById("wizardModalTitle"),
    wizardModalSubtitle: document.getElementById("wizardModalSubtitle"),
    closeWizardModalBtn: document.getElementById("closeWizardModalBtn"),
    wizardStepperTrack: document.getElementById("wizardStepperTrack"),
    wizardStepContent: document.getElementById("wizardStepContent"),
    wizardPrevStepBtn: document.getElementById("wizardPrevStepBtn"),
    wizardNextStepBtn: document.getElementById("wizardNextStepBtn"),
    wizardNextBtnText: document.getElementById("wizardNextBtnText"),
    wizardStepCounterLabel: document.getElementById("wizardStepCounterLabel"),
    apiKeyInput: document.getElementById("apiKeyInput"),
    togglePasswordBtn: document.getElementById("togglePasswordBtn"),
    googleCloudLink: document.getElementById("googleCloudLink"),
    libreTranslateUrlInput: document.getElementById("libreTranslateUrlInput"),
    libreTranslateKeyInput: document.getElementById("libreTranslateKeyInput"),
    themeSelect: document.getElementById("themeSelect"),
    themeCardDark: document.getElementById("themeCardDark"),
    themeCardLight: document.getElementById("themeCardLight"),
    modalOpacityInput: document.getElementById("modalOpacityInput"),
    modalOpacityValue: document.getElementById("modalOpacityValue"),
    liveGlassPreviewCard: document.getElementById("liveGlassPreviewCard"),
    liveGlassAlphaLabel: document.getElementById("liveGlassAlphaLabel"),
    showSelectionIconInput: document.getElementById("showSelectionIconInput"),
    shortcutInput: document.getElementById("shortcutInput"),
    shortcutKbdPreview: document.getElementById("shortcutKbdPreview"),
    resetShortcutBtn: document.getElementById("resetShortcutBtn"),
    sidebarShortcutInput: document.getElementById("sidebarShortcutInput"),
    sidebarShortcutKbdPreview: document.getElementById("sidebarShortcutKbdPreview"),
    resetSidebarShortcutBtn: document.getElementById("resetSidebarShortcutBtn"),
    openBrowserShortcutsBtn: document.getElementById("openBrowserShortcutsBtn"),
    saveStatusFeedback: document.getElementById("saveStatusFeedback"),
  };

  let feedbackTimer = null;
  let textSaveDebounceTimer = null;
  let currentTheme = DEFAULTS.THEME;
  let selectedProviderId = DEFAULTS.PROVIDER;
  let isOfflineEngineEnabled = true;
  let activeWizardId = null;
  let activeWizardStepIndex = 0;
  let selectedLibreMode = "uv"; // "uv" | "docker"
  let selectedLibreRunMode = "visible"; // "background" | "visible"
  let selectedWizardOs = /Win/i.test(navigator.platform || navigator.userAgent || "") ? "windows" : "unix"; // "windows" | "unix"

  function switchActiveTab(targetPanelId) {
    for (const btn of elements.tabButtons) {
      const isMatch = btn.dataset.tabTarget === targetPanelId;
      btn.classList.toggle("is-active", isMatch);
      btn.setAttribute("aria-selected", String(isMatch));
    }
    for (const panel of elements.tabPanels) {
      panel.classList.toggle("hidden", panel.id !== targetPanelId);
    }
  }

  function applyThemeToDocument(themeValue) {
    currentTheme = themeValue === THEMES.LIGHT ? THEMES.LIGHT : THEMES.DARK;
    document.body.setAttribute("data-theme", currentTheme);
    elements.themeSelect.value = currentTheme;
    elements.themeToggleBtn.textContent = currentTheme === THEMES.DARK ? "Tema Claro" : "Tema Escuro";

    if (elements.themeCardDark && elements.themeCardLight) {
      elements.themeCardDark.classList.toggle("is-selected", currentTheme === THEMES.DARK);
      elements.themeCardLight.classList.toggle("is-selected", currentTheme === THEMES.LIGHT);
    }
  }

  function updateTypingModeUI(autoOnType, debounceMs) {
    const isAuto = Boolean(autoOnType);
    const clampedMs = clampTypingDebounceMs(debounceMs);
    const secondsFormatted = (clampedMs / 1000).toFixed(1);

    elements.autoTranslateOnTypeInput.checked = isAuto;
    elements.typingDebounceInput.value = String(clampedMs);
    elements.typingDebounceValue.textContent = `${secondsFormatted}s (${clampedMs} ms)`;
    elements.typingDelayConfigBox.classList.toggle("hidden", !isAuto);
    elements.typingModePill.textContent = isAuto ? `Automático (${secondsFormatted}s)` : "Botão Traduzir";
  }

  function updateLiveGlassPreview(opacityPercent) {
    const clampedPercent = Math.min(100, Math.max(65, Math.round(Number(opacityPercent) || 88)));
    const ratio = clampModalOpacity(clampedPercent / 100);
    elements.modalOpacityValue.textContent = `${clampedPercent}%`;
    if (elements.liveGlassPreviewCard) {
      elements.liveGlassPreviewCard.style.setProperty("--preview-alpha", String(ratio));
    }
    if (elements.liveGlassAlphaLabel) {
      elements.liveGlassAlphaLabel.textContent = `${clampedPercent}% opaco`;
    }
  }

  function renderKbdKeycaps(containerEl, shortcutString) {
    if (!containerEl) {
      return;
    }
    containerEl.replaceChildren();
    const parts = String(shortcutString || "")
      .split("+")
      .map((s) => s.trim())
      .filter(Boolean);

    parts.forEach((part, idx) => {
      const kbd = document.createElement("kbd");
      kbd.textContent = part;
      containerEl.appendChild(kbd);
      if (idx < parts.length - 1) {
        const plus = document.createElement("span");
        plus.className = "kbd-plus";
        plus.textContent = "+";
        containerEl.appendChild(plus);
      }
    });
  }

  function attachLogoFallback(imgElement, fallbackElement) {
    imgElement.addEventListener("error", () => {
      imgElement.classList.add("hidden");
      fallbackElement.classList.remove("hidden");
    });
    imgElement.addEventListener("load", () => {
      imgElement.classList.remove("hidden");
      fallbackElement.classList.add("hidden");
    });
  }

  function renderProviderDeck() {
    elements.providerDeckContainer.replaceChildren();

    for (const provider of PROVIDER_CATALOG) {
      const isSelected = provider.id === selectedProviderId;
      const cardBtn = document.createElement("button");
      cardBtn.type = "button";
      cardBtn.className = "provider-option-card";
      cardBtn.dataset.providerId = provider.id;
      cardBtn.setAttribute("role", "radio");
      cardBtn.setAttribute("aria-checked", String(isSelected));

      if (isSelected) {
        cardBtn.classList.add("is-selected");
      }

      const topRow = document.createElement("div");
      topRow.className = "provider-card-top";

      const leftGroup = document.createElement("div");
      leftGroup.className = "provider-card-left";

      const logoWrap = document.createElement("div");
      logoWrap.className = "provider-card-logo";

      const img = document.createElement("img");
      img.src = `../../${provider.logoPath}`;
      img.alt = provider.name;

      const fallback = document.createElement("span");
      fallback.className = "provider-logo-fallback hidden";
      fallback.textContent = provider.badgeFallback;

      attachLogoFallback(img, fallback);
      logoWrap.appendChild(img);
      logoWrap.appendChild(fallback);

      const titleGroup = document.createElement("div");
      titleGroup.className = "provider-card-title-group";

      const nameEl = document.createElement("span");
      nameEl.className = "provider-card-name";
      nameEl.textContent = provider.name;

      const badgeEl = document.createElement("span");
      badgeEl.className = "provider-card-badge";
      badgeEl.textContent = provider.requiresApiKey ? "Com chave pessoal" : "Gratuito · Sem chave";

      titleGroup.appendChild(nameEl);
      titleGroup.appendChild(badgeEl);
      leftGroup.appendChild(logoWrap);
      leftGroup.appendChild(titleGroup);

      const checkBadge = document.createElement("span");
      checkBadge.className = `provider-card-check ${isSelected ? "" : "hidden"}`;
      setElementHtmlSafe(checkBadge, CHECK_ICON_SVG);

      topRow.appendChild(leftGroup);
      topRow.appendChild(checkBadge);
      cardBtn.appendChild(topRow);

      cardBtn.addEventListener("click", async () => {
        await selectProvider(provider.id, { persistImmediately: true });
        setProviderDeckOpen(false);
      });

      elements.providerDeckContainer.appendChild(cardBtn);
    }
  }

  function setProviderDeckOpen(open) {
    const isOpen = Boolean(open);
    elements.providerDeckContainer.classList.toggle("is-open", isOpen);
    elements.providerSelectorToggleBtn.setAttribute("aria-expanded", String(isOpen));
    elements.providerToggleActionText.textContent = isOpen ? "Ocultar lista" : "Trocar fonte";
  }

  function toggleProviderDeck() {
    const currentlyOpen = elements.providerDeckContainer.classList.contains("is-open");
    setProviderDeckOpen(!currentlyOpen);
  }

  function renderProviderCredits(meta) {
    if (!elements.providerCreditsRow) {
      return;
    }
    elements.providerCreditsRow.replaceChildren();

    const credits = meta.credits;
    if (!credits) {
      return;
    }

    const authorSpan = document.createElement("span");
    authorSpan.textContent = "Projeto / Tecnologia por ";
    const strongEl = document.createElement("strong");
    strongEl.textContent = credits.author;
    authorSpan.appendChild(strongEl);

    const linksGroup = document.createElement("div");
    linksGroup.className = "credits-links-group";

    if (credits.officialUrl) {
      const officialLink = document.createElement("a");
      officialLink.href = credits.officialUrl;
      officialLink.target = "_blank";
      officialLink.rel = "noopener noreferrer";
      officialLink.className = "credit-link";
      officialLink.textContent = `${credits.officialLabel || "Página Oficial"} ↗`;
      linksGroup.appendChild(officialLink);
    }

    if (credits.repoUrl) {
      const repoLink = document.createElement("a");
      repoLink.href = credits.repoUrl;
      repoLink.target = "_blank";
      repoLink.rel = "noopener noreferrer";
      repoLink.className = "credit-link";
      repoLink.textContent = `${credits.repoLabel || "Código-Fonte / Docs"} ↗`;
      linksGroup.appendChild(repoLink);
    }

    elements.providerCreditsRow.appendChild(authorSpan);
    elements.providerCreditsRow.appendChild(linksGroup);
  }

  function openWizardModal(wizardId, initialStep = 0) {
    const guide = WIZARD_GUIDES[wizardId];
    if (!guide) {
      return;
    }
    activeWizardId = wizardId;
    activeWizardStepIndex = Math.max(0, Math.min(initialStep, guide.steps.length - 1));

    elements.wizardBadgePill.textContent = guide.badge;
    elements.wizardModalTitle.textContent = guide.title;
    elements.wizardModalSubtitle.textContent = guide.subtitle;

    renderActiveWizardStep();
    elements.stepWizardBackdrop.classList.remove("hidden");
  }

  function closeWizardModal() {
    stopWizardPortMonitor();
    elements.stepWizardBackdrop.classList.add("hidden");
    activeWizardId = null;
  }

  let wizardPortTimer = null;

  function stopWizardPortMonitor() {
    if (wizardPortTimer) {
      clearInterval(wizardPortTimer);
      wizardPortTimer = null;
    }
  }

  async function probeLocalLibreServer() {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 1800);
    try {
      const response = await fetch(`${DEFAULTS.LIBRE_TRANSLATE_LOCAL_URL}/languages`, {
        method: "GET",
        signal: controller.signal
      });
      if (!response.ok) {
        return { online: false };
      }
      const langs = await response.json();
      return { online: true, count: Array.isArray(langs) ? langs.length : 0 };
    } catch (_err) {
      return { online: false };
    } finally {
      clearTimeout(timeoutId);
    }
  }

  function createWizardPortMonitor() {
    const box = document.createElement("div");
    box.className = "wizard-port-monitor is-idle";

    const dot = document.createElement("span");
    dot.className = "wizard-port-dot";

    const textWrap = document.createElement("div");
    textWrap.className = "wizard-port-text";

    const title = document.createElement("strong");
    const detail = document.createElement("span");
    const hint = document.createElement("span");
    hint.className = "wizard-port-hint";
    hint.textContent =
      "Tempo estimado: na primeira vez, de 3 a 10 minutos (baixa os modelos dos idiomas, depende da sua internet). Nas próximas, de 10 a 30 segundos.";

    const actions = document.createElement("div");
    actions.className = "wizard-port-actions";

    const toggleBtn = document.createElement("button");
    toggleBtn.type = "button";
    toggleBtn.className = "primary-wizard-btn";
    actions.appendChild(toggleBtn);

    textWrap.appendChild(title);
    textWrap.appendChild(detail);
    textWrap.appendChild(hint);
    textWrap.appendChild(actions);

    box.appendChild(dot);
    box.appendChild(textWrap);

    const POLL_MS = 4000;
    let state = "idle"; // idle | listening | online | stopped
    let attempts = 0;

    const render = (count = 0) => {
      toggleBtn.className = "primary-wizard-btn";
      if (state === "idle") {
        box.className = "wizard-port-monitor is-idle";
        title.textContent = "Verificação do servidor";
        detail.textContent =
          "Depois de executar o comando acima, clique no botão para o TraduzAí verificar se o servidor subiu na porta 5000.";
        toggleBtn.textContent = "Já executei, começar a verificar";
      } else if (state === "listening") {
        box.className = "wizard-port-monitor is-waiting";
        title.textContent = "Verificando a porta 5000...";
        detail.textContent =
          attempts > 6
            ? "Ainda sem resposta. Se estiver na primeira vez, é normal demorar. Confira no terminal se não houve erro."
            : "Consultando o servidor a cada 4 segundos. Aguarde a instalação terminar.";
        toggleBtn.className = "secondary-btn";
        toggleBtn.textContent = "Parar de verificar";
      } else if (state === "online") {
        box.className = "wizard-port-monitor is-online";
        title.textContent = "Servidor ativo e conectado";
        detail.textContent = `Respondendo em localhost:5000 com ${count} idiomas. O endereço já foi configurado no TraduzAí, é só traduzir.`;
        toggleBtn.className = "secondary-btn";
        toggleBtn.textContent = "Verificar novamente";
      } else {
        box.className = "wizard-port-monitor is-offline";
        title.textContent = "Verificação interrompida";
        detail.textContent =
          "Nenhuma resposta na porta 5000. Confira se o comando está rodando e tente verificar novamente.";
        toggleBtn.textContent = "Verificar novamente";
      }
    };

    const tick = async () => {
      const result = await probeLocalLibreServer();
      if (!box.isConnected || state !== "listening") {
        return;
      }
      attempts += 1;
      if (result.online) {
        stopWizardPortMonitor();
        state = "online";
        elements.libreTranslateUrlInput.value = DEFAULTS.LIBRE_TRANSLATE_LOCAL_URL;
        await saveUserPreferences({
          [STORAGE_KEYS.LIBRE_TRANSLATE_URL]: DEFAULTS.LIBRE_TRANSLATE_LOCAL_URL
        });
        render(result.count);
      } else {
        render();
      }
    };

    toggleBtn.addEventListener("click", () => {
      if (state === "listening") {
        stopWizardPortMonitor();
        state = "stopped";
        render();
        return;
      }
      stopWizardPortMonitor();
      state = "listening";
      attempts = 0;
      render();
      tick();
      wizardPortTimer = setInterval(tick, POLL_MS);
    });

    render();
    return box;
  }

  function createWizardSingleBox(boxConfig) {
    const card = document.createElement("div");
    card.className = "wizard-single-box";

    const header = document.createElement("div");
    header.className = "wizard-box-header";

    const titleStrong = document.createElement("strong");
    titleStrong.textContent = boxConfig.title;

    header.appendChild(titleStrong);

    if (boxConfig.tag) {
      const tagSpan = document.createElement("span");
      tagSpan.className = "wizard-path-tag";
      tagSpan.textContent = boxConfig.tag;
      header.appendChild(tagSpan);
    }

    card.appendChild(header);

    if (boxConfig.runModeToggle) {
      const modeTabs = document.createElement("div");
      modeTabs.className = "wizard-run-mode-tabs";

      const bgBtn = document.createElement("button");
      bgBtn.type = "button";
      bgBtn.className = `wizard-run-mode-btn ${selectedLibreRunMode === "background" ? "is-active" : ""}`;
      bgBtn.textContent = "Rodar em 2º Plano";
      bgBtn.addEventListener("click", () => {
        selectedLibreRunMode = "background";
        renderActiveWizardStep();
      });

      const visBtn = document.createElement("button");
      visBtn.type = "button";
      visBtn.className = `wizard-run-mode-btn ${selectedLibreRunMode === "visible" ? "is-active" : ""}`;
      visBtn.textContent = "Terminal Visível";
      visBtn.addEventListener("click", () => {
        selectedLibreRunMode = "visible";
        renderActiveWizardStep();
      });

      modeTabs.appendChild(bgBtn);
      modeTabs.appendChild(visBtn);
      card.appendChild(modeTabs);
    }

    if (boxConfig.text) {
      const descP = document.createElement("p");
      descP.className = "wizard-box-desc";
      descP.textContent = boxConfig.text;
      card.appendChild(descP);
    }

    if (Array.isArray(boxConfig.commands)) {
      for (const cmdObj of boxConfig.commands) {
        const cmdBlock = document.createElement("div");
        cmdBlock.className = "wizard-cmd-block";

        const top = document.createElement("div");
        top.className = "wizard-cmd-top";

        const lbl = document.createElement("span");
        lbl.className = "wizard-cmd-label";
        lbl.textContent = cmdObj.label;

        top.appendChild(lbl);

        if (typeof cmdObj.onSwitchOs === "function" && cmdObj.switchOsLabel) {
          const osBtn = document.createElement("button");
          osBtn.type = "button";
          osBtn.className = "wizard-os-switch-btn";
          osBtn.textContent = cmdObj.switchOsLabel;
          osBtn.addEventListener("click", cmdObj.onSwitchOs);
          top.appendChild(osBtn);
        }

        const codeBar = document.createElement("div");
        codeBar.className = "wizard-cmd-code-bar";

        const codeEl = document.createElement("code");
        codeEl.className = "wizard-cmd-code";
        codeEl.textContent = cmdObj.cmd;

        const copyBtn = document.createElement("button");
        copyBtn.type = "button";
        copyBtn.className = "wizard-copy-icon-btn";
        copyBtn.title = "Copiar comando";
        copyBtn.setAttribute("aria-label", "Copiar comando");
        setElementHtmlSafe(copyBtn, CLIPBOARD_ICON_SVG);
        copyBtn.addEventListener("click", async () => {
          try {
            await navigator.clipboard.writeText(cmdObj.cmd);
            copyBtn.classList.add("is-copied");
            setElementHtmlSafe(copyBtn, CHECK_ICON_SVG);
            copyBtn.title = "Copiado!";
            setTimeout(() => {
              copyBtn.classList.remove("is-copied");
              setElementHtmlSafe(copyBtn, CLIPBOARD_ICON_SVG);
              copyBtn.title = "Copiar comando";
            }, 1600);
          } catch (_err) {
            // Ignora erro
          }
        });

        codeBar.appendChild(codeEl);
        codeBar.appendChild(copyBtn);

        cmdBlock.appendChild(top);
        cmdBlock.appendChild(codeBar);
        card.appendChild(cmdBlock);
      }
    }

    return card;
  }

  function resolveDynamicWizardStepData(rawStep) {
    if (rawStep.id === "libre-reqs") {
      if (selectedLibreMode === "uv") {
        const isWin = selectedWizardOs === "windows";
        return {
          ...rawStep,
          heading: "Instalar o Python e o gerenciador uv",
          description: "O uv (da Astral) substitui o pipx com muito mais velocidade. Garanta que você tenha o Python instalado na máquina e abra o Terminal para instalar o uv:",
          box: {
            title: isWin ? "Terminal do Windows (PowerShell)" : "Terminal do Linux ou macOS",
            tag: "Python + uv",
            text: isWin ? 'Como abrir o terminal: aperte Win + X no teclado e clique em "Terminal" ou "PowerShell". Depois, cole o comando abaixo:' : 'Como abrir o terminal: aperte Ctrl + Alt + T (no Linux) ou Cmd + Espaço e digite "Terminal" (no macOS). Depois, cole o comando abaixo:',
            commands: [
              {
                label: isWin ? "Comando para instalar o uv (Windows PowerShell):" : "Comando para instalar o uv (Linux / macOS):",
                cmd: isWin ? 'powershell -ExecutionPolicy ByPass -c "irm https://astral.sh/uv/install.ps1 | iex"' : "curl -LsSf https://astral.sh/uv/install.sh | sh",
                switchOsLabel: isWin ? "Usando Linux ou macOS? Trocar comando" : "Usando Windows? Trocar comando",
                onSwitchOs: () => {
                  selectedWizardOs = isWin ? "unix" : "windows";
                  renderActiveWizardStep();
                },
              },
            ],
          },
          links: [
            {
              title: "Baixar Python Oficial",
              subtitle: "python.org/downloads",
              url: "https://www.python.org/downloads/",
            },
            {
              title: "Guia Oficial do uv (Astral)",
              subtitle: "docs.astral.sh/uv",
              url: "https://docs.astral.sh/uv/getting-started/installation/",
            },
          ],
        };
      }

      return {
        ...rawStep,
        heading: "Instalar e abrir o Docker Desktop",
        description: "Com o Docker, você não precisa instalar Python na máquina. Basta ter o Docker instalado e rodando em segundo plano:",
        box: {
          title: "Verificar o Docker no Terminal",
          tag: "Docker",
          text: "Abra o seu Terminal (PowerShell no Windows ou Terminal no Linux/macOS) e confira se o Docker está ativo com o comando abaixo:",
          commands: [
            {
              label: "Testar se o Docker está pronto:",
              cmd: "docker --version",
            },
          ],
        },
        links: [
          {
            title: "Baixar Docker Desktop Oficial",
            subtitle: "docker.com/products/docker-desktop",
            url: "https://www.docker.com/products/docker-desktop/",
          },
          {
            title: "Documentação Oficial do Docker",
            subtitle: "docs.docker.com/get-docker",
            url: "https://docs.docker.com/get-docker/",
          },
        ],
      };
    }

    if (rawStep.id === "libre-run") {
      const isUv = selectedLibreMode === "uv";
      const isBg = selectedLibreRunMode === "background";
      const isWin = selectedWizardOs === "windows";

      if (isUv) {
        return {
          ...rawStep,
          heading: "Subir o Servidor com uvx",
          description: "Por padrão, deixamos 3 línguas configuradas (pt,en,es: Português, Inglês e Espanhol). Recomendamos executar a primeira vez com o Terminal Visível, para acompanhar a instalação dos idiomas e confirmar que deu certo. Nas próximas vezes, use o 2º Plano.",
          box: {
            title: "Comandos do Servidor",
            tag: "Padrão: pt, en, es",
            runModeToggle: true,
            text: isBg ? "No modo 2º Plano, o servidor roda oculto e você já pode fechar o terminal! Sempre que reiniciar a máquina e quiser usar, basta rodar o comando de iniciar novamente. Para encerrar o servidor sem reiniciar o PC, use o comando de desligar abaixo:" : 'No modo Terminal Visível (ótimo para a 1ª execução), você acompanha o download inicial dos 3 idiomas até aparecer "Running on :5000". Para desligar o servidor, basta fechar a janela do terminal.',
            commands: isBg
              ? [
                {
                  label: isWin ? "1. Iniciar em 2º Plano no Windows:" : "1. Iniciar em 2º Plano no Linux / macOS:",
                  cmd: isWin ? 'Start-Process uvx -ArgumentList "libretranslate --load-only pt,en,es" -WindowStyle Hidden' : "nohup uvx libretranslate --load-only pt,en,es >/dev/null 2>&1 &",
                  switchOsLabel: isWin ? "Usando Linux ou macOS? Trocar comando" : "Usando Windows? Trocar comando",
                  onSwitchOs: () => {
                    selectedWizardOs = isWin ? "unix" : "windows";
                    renderActiveWizardStep();
                  },
                },
                {
                  label: isWin ? "2. Quando quiser desligar da memória (ou reinicie a máquina):" : "2. Quando quiser desligar da memória (ou reinicie a máquina):",
                  cmd: isWin ? 'Stop-Process -Name "libretranslate" -Force' : "pkill -f libretranslate",
                },
              ]
              : [
                {
                  label: "Iniciar com janela aberta (acompanhar progresso na porta 5000):",
                  cmd: "uvx libretranslate --load-only pt,en,es",
                },
              ],
          },
          links: [
            {
              title: "Lista Oficial de Idiomas Suportados",
              subtitle: "docs.libretranslate.com/guides/supported_languages",
              url: "https://docs.libretranslate.com/guides/supported_languages/",
            },
            {
              title: "Guia Oficial no GitHub",
              subtitle: "github.com/LibreTranslate/LibreTranslate",
              url: "https://github.com/LibreTranslate/LibreTranslate#install-and-run",
            },
          ],
        };
      }

      return {
        ...rawStep,
        heading: "Subir o Servidor com Docker",
        description: "Por padrão, deixamos 3 línguas configuradas (pt,en,es: Português, Inglês e Espanhol). Recomendamos executar a primeira vez com o Terminal Visível, para acompanhar a instalação dos idiomas e confirmar que deu certo. Nas próximas vezes, use o 2º Plano.",
        box: {
          title: "Comandos do Servidor",
          tag: "Padrão: pt, en, es",
          runModeToggle: true,
          text: isBg ? "No modo 2º Plano (-d), você pode fechar o terminal imediatamente e o container continuará ativo. Para desligar o servidor quando não estiver usando, execute o comando de parada abaixo:" : "No modo Terminal Visível (-ti --rm), você acompanha o download inicial na tela e o servidor é encerrado automaticamente assim que você fechar a janela do terminal.",
          commands: isBg
            ? [
              {
                label: "1. Iniciar container em 2º Plano:",
                cmd: "docker run -d --restart unless-stopped --name libretranslate -p 5000:5000 libretranslate/libretranslate --load-only pt,en,es",
              },
              {
                label: "2. Quando quiser desligar o container da memória:",
                cmd: "docker stop libretranslate && docker rm libretranslate",
              },
            ]
            : [
              {
                label: "Iniciar com janela aberta:",
                cmd: "docker run -ti --rm -p 5000:5000 libretranslate/libretranslate --load-only pt,en,es",
              },
            ],
        },
        links: [
          {
            title: "Lista Oficial de Idiomas Suportados (--load-only)",
            subtitle: "docs.libretranslate.com/guides/supported_languages",
            url: "https://docs.libretranslate.com/guides/supported_languages/",
          },
          {
            title: "Guia Oficial no GitHub",
            subtitle: "github.com/LibreTranslate/LibreTranslate",
            url: "https://github.com/LibreTranslate/LibreTranslate#install-and-run",
          },
        ],
      };
    }

    return rawStep;
  }

  function renderActiveWizardStep() {
    const guide = WIZARD_GUIDES[activeWizardId];
    if (!guide) {
      return;
    }

    const steps = guide.steps;
    const rawStep = steps[activeWizardStepIndex];
    const step = resolveDynamicWizardStepData(rawStep);
    const total = steps.length;

    // 1. Renderiza o Stepper minimalista centralizado (círculos + linhas finas, sem setas)
    elements.wizardStepperTrack.replaceChildren();
    steps.forEach((st, idx) => {
      const nodeBtn = document.createElement("button");
      nodeBtn.type = "button";
      nodeBtn.className = "wizard-step-node";
      if (idx === activeWizardStepIndex) {
        nodeBtn.classList.add("is-current");
      } else if (idx < activeWizardStepIndex) {
        nodeBtn.classList.add("is-done");
      }

      const numSpan = document.createElement("span");
      numSpan.className = "wizard-step-num";
      if (idx < activeWizardStepIndex) {
        setElementHtmlSafe(numSpan, CHECK_ICON_SVG);
      } else {
        numSpan.textContent = String(idx + 1);
      }

      const labelSpan = document.createElement("span");
      labelSpan.textContent = st.shortTitle;

      nodeBtn.appendChild(numSpan);
      nodeBtn.appendChild(labelSpan);
      nodeBtn.addEventListener("click", () => {
        activeWizardStepIndex = idx;
        renderActiveWizardStep();
      });

      elements.wizardStepperTrack.appendChild(nodeBtn);

      if (idx < total - 1) {
        const lineSpan = document.createElement("span");
        lineSpan.className = "wizard-step-line";
        if (idx < activeWizardStepIndex) {
          lineSpan.classList.add("is-done");
        }
        elements.wizardStepperTrack.appendChild(lineSpan);
      }
    });

    // 2. Renderiza o cabeçalho limpo da etapa (sem repetir "Etapa X — ")
    elements.wizardStepContent.replaceChildren();

    const heroDiv = document.createElement("div");
    heroDiv.className = "wizard-step-hero";

    const iconBox = document.createElement("div");
    iconBox.className = "wizard-step-icon-box";
    setElementHtmlSafe(iconBox, step.icon || WIZARD_ICONS.server);

    const heroText = document.createElement("div");
    heroText.className = "wizard-step-hero-text";

    const h3 = document.createElement("h3");
    h3.textContent = step.heading;

    const pDesc = document.createElement("p");
    pDesc.textContent = step.description;

    heroText.appendChild(h3);
    heroText.appendChild(pDesc);
    heroDiv.appendChild(iconBox);
    heroDiv.appendChild(heroText);
    elements.wizardStepContent.appendChild(heroDiv);

    // 3. Caso seja a etapa de escolha de ambiente do LibreTranslate (Python + uv vs Docker)
    if (step.id === "libre-choice") {
      const choiceGrid = document.createElement("div");
      choiceGrid.className = "wizard-choice-grid";

      const choices = [
        {
          mode: "uv",
          title: "Python + uv",
          badge: "Recomendado · Mais leve",
          desc: "Ideal para a maioria dos usuários. Usa o Python instalado na máquina e o utilitário ultrarrápido uv (sem precisar de máquinas virtuais pesadas).",
        },
        {
          mode: "docker",
          title: "Docker Desktop",
          badge: "Container Isolado",
          desc: "Ideal se você já usa Docker no dia a dia. Roda tudo dentro de um container isolado sem precisar instalar o Python no sistema.",
        },
      ];

      for (const item of choices) {
        const isSelected = selectedLibreMode === item.mode;
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = `wizard-choice-card ${isSelected ? "is-selected" : ""}`;

        const choiceTop = document.createElement("div");
        choiceTop.className = "wizard-choice-top";

        const choiceTitle = document.createElement("div");
        choiceTitle.className = "wizard-choice-title";

        const titleStrong = document.createElement("strong");
        titleStrong.textContent = item.title;

        const badgeSpan = document.createElement("span");
        badgeSpan.className = "wizard-choice-badge";
        badgeSpan.textContent = item.badge;

        choiceTitle.appendChild(titleStrong);
        choiceTitle.appendChild(badgeSpan);

        const radioSpan = document.createElement("span");
        radioSpan.className = "wizard-choice-radio";
        if (isSelected) {
          setElementHtmlSafe(radioSpan, CHECK_ICON_SVG);
        }

        choiceTop.appendChild(choiceTitle);
        choiceTop.appendChild(radioSpan);

        const choiceDesc = document.createElement("p");
        choiceDesc.className = "wizard-choice-desc";
        choiceDesc.textContent = item.desc;

        btn.appendChild(choiceTop);
        btn.appendChild(choiceDesc);

        btn.addEventListener("click", () => {
          selectedLibreMode = item.mode;
          renderActiveWizardStep();
        });

        choiceGrid.appendChild(btn);
      }

      elements.wizardStepContent.appendChild(choiceGrid);
    }

    // 4. Caixa única focada de instrução / comando (apenas do caminho escolhido!)
    if (step.box) {
      elements.wizardStepContent.appendChild(createWizardSingleBox(step.box));
    }

    // 4.1 Monitor ao vivo da porta 5000 (feedback de que o servidor subiu ou caiu)
    stopWizardPortMonitor();
    if (step.id === "libre-run") {
      elements.wizardStepContent.appendChild(createWizardPortMonitor());
    }

    // 5. Ação interativa na Etapa final do LibreTranslate
    if (step.hasLibreLocalTestAction) {
      const actionBox = document.createElement("div");
      actionBox.className = "wizard-action-box";

      const actionInfo = document.createElement("div");
      actionInfo.className = "wizard-link-info";

      const strongEl = document.createElement("strong");
      strongEl.textContent = "Testar conexão local agora (http://localhost:5000)";

      const spanEl = document.createElement("span");
      spanEl.textContent = "Preenche o endereço local automaticamente e verifica se o seu servidor respondeu";

      actionInfo.appendChild(strongEl);
      actionInfo.appendChild(spanEl);

      const testNowBtn = document.createElement("button");
      testNowBtn.type = "button";
      testNowBtn.className = "primary-wizard-btn";
      testNowBtn.textContent = "Ativar localhost:5000 e Testar";

      const inlineStatus = document.createElement("div");
      inlineStatus.className = "libre-connection-status hidden";
      inlineStatus.style.width = "100%";

      testNowBtn.addEventListener("click", async () => {
        elements.libreTranslateUrlInput.value = DEFAULTS.LIBRE_TRANSLATE_LOCAL_URL;
        await saveUserPreferences({
          [STORAGE_KEYS.LIBRE_TRANSLATE_URL]: DEFAULTS.LIBRE_TRANSLATE_LOCAL_URL,
        });
        await testLibreTranslateConnection(DEFAULTS.LIBRE_TRANSLATE_LOCAL_URL, inlineStatus);
      });

      actionBox.appendChild(actionInfo);
      actionBox.appendChild(testNowBtn);
      actionBox.appendChild(inlineStatus);
      elements.wizardStepContent.appendChild(actionBox);
    }

    // 6. Links Oficiais e Guias
    if (Array.isArray(step.links) && step.links.length > 0) {
      const linksGrid = document.createElement("div");
      linksGrid.className = "wizard-links-grid";

      for (const linkItem of step.links) {
        const a = document.createElement("a");
        a.href = linkItem.url;
        a.target = "_blank";
        a.rel = "noopener noreferrer";
        a.className = "wizard-link-card";

        const info = document.createElement("div");
        info.className = "wizard-link-info";

        const st = document.createElement("strong");
        st.textContent = linkItem.title;

        const sub = document.createElement("span");
        sub.textContent = linkItem.subtitle;

        info.appendChild(st);
        info.appendChild(sub);

        const arrow = document.createElement("span");
        arrow.className = "wizard-link-arrow";
        arrow.textContent = "↗";

        a.appendChild(info);
        a.appendChild(arrow);
        linksGrid.appendChild(a);
      }

      elements.wizardStepContent.appendChild(linksGrid);
    }

    // 7. Atualiza os controles do rodapé
    elements.wizardStepCounterLabel.textContent = `Etapa ${activeWizardStepIndex + 1} de ${total}`;
    elements.wizardPrevStepBtn.disabled = activeWizardStepIndex === 0;
    elements.wizardPrevStepBtn.style.opacity = activeWizardStepIndex === 0 ? "0.4" : "1";

    const isLast = activeWizardStepIndex === total - 1;
    elements.wizardNextBtnText.textContent = isLast ? "Concluir guia" : "Próxima etapa";
  }

  function renderOfflineManagementStatus(statusResponse) {
    const enabled = statusResponse ? statusResponse.enabled !== false : isOfflineEngineEnabled;
    const workerRunning = Boolean(statusResponse?.workerRunning);
    const downloadedModels = Array.isArray(statusResponse?.downloadedModels) ? statusResponse.downloadedModels : [];

    isOfflineEngineEnabled = enabled;

    if (!enabled) {
      elements.offlineEngineStatusLabel.textContent = "Desativado — O motor local está desligado e não consome memória RAM.";
      elements.toggleOfflineEngineBtn.textContent = "Ativar modelo local";
    } else if (workerRunning) {
      elements.offlineEngineStatusLabel.textContent = "Ativo na memória agora — Pronto para traduzir instantaneamente (desliga sozinho ao trocar de fonte).";
      elements.toggleOfflineEngineBtn.textContent = "Desativar da memória";
    } else {
      elements.offlineEngineStatusLabel.textContent = "Ativado (Em espera: 0 MB de RAM em uso até a próxima tradução offline).";
      elements.toggleOfflineEngineBtn.textContent = "Desativar modelo local";
    }

    elements.uninstallOfflineConfirmGroup.classList.add("hidden");

    if (downloadedModels.length === 0) {
      elements.offlineModelsSummary.textContent = "Nenhum pacote de idioma instalado no navegador.";
      elements.uninstallOfflineModelsBtn.classList.add("hidden");
      elements.offlineInstalledModelsList.classList.add("hidden");
      elements.offlineInstalledModelsList.replaceChildren();
    } else {
      elements.offlineModelsSummary.textContent = `${downloadedModels.length} pacote(s) de idioma armazenado(s) no navegador:`;
      elements.uninstallOfflineModelsBtn.classList.remove("hidden");
      elements.offlineInstalledModelsList.classList.remove("hidden");
      elements.offlineInstalledModelsList.replaceChildren();

      for (const model of downloadedModels) {
        const li = document.createElement("li");
        li.textContent = `${model.label} (${model.modelId})`;
        elements.offlineInstalledModelsList.appendChild(li);
      }
    }
  }

  async function refreshOfflineManagementState() {
    try {
      const response = await browser.runtime.sendMessage({
        type: MESSAGE_TYPES.GET_OFFLINE_RUNTIME_STATUS,
      });
      if (response && response.ok) {
        renderOfflineManagementStatus(response);
      }
    } catch (_err) {
      // Ignora erro
    }
  }

  async function selectProvider(providerId, { persistImmediately = false } = {}) {
    selectedProviderId = normalizeProviderId(providerId, DEFAULTS.PROVIDER);
    const meta = getProviderMetadata(selectedProviderId);

    elements.activeProviderLogoFallback.textContent = meta.badgeFallback;
    elements.activeProviderLogoImg.src = `../../${meta.logoPath}`;
    elements.activeProviderName.textContent = meta.name;
    elements.activeProviderTagline.textContent = meta.tagline;
    elements.activeProviderPill.textContent = meta.requiresApiKey ? "Requer chave pessoal" : "Gratuito · Sem chave";

    elements.detailsDescription.textContent = meta.description;
    elements.detailsLimitationsList.replaceChildren();
    for (const limitation of meta.limitations) {
      const li = document.createElement("li");
      li.textContent = limitation;
      elements.detailsLimitationsList.appendChild(li);
    }

    renderProviderCredits(meta);

    elements.googleKeySection.classList.toggle("hidden", selectedProviderId !== PROVIDERS.GOOGLE);
    elements.libreTranslateSection.classList.toggle("hidden", selectedProviderId !== PROVIDERS.LIBRETRANSLATE);
    elements.offlineManagementSection.classList.toggle("hidden", selectedProviderId !== PROVIDERS.OFFLINE);

    if (selectedProviderId === PROVIDERS.OFFLINE) {
      await refreshOfflineManagementState();
    }

    const cardButtons = elements.providerDeckContainer.querySelectorAll(".provider-option-card");
    for (const btn of cardButtons) {
      const isMatch = btn.dataset.providerId === selectedProviderId;
      btn.classList.toggle("is-selected", isMatch);
      btn.setAttribute("aria-checked", String(isMatch));
      const checkEl = btn.querySelector(".provider-card-check");
      if (checkEl) {
        checkEl.classList.toggle("hidden", !isMatch);
      }
    }

    if (persistImmediately) {
      await saveUserPreferences({
        [STORAGE_KEYS.PROVIDER]: selectedProviderId,
      });
      showSaveFeedback(`Fonte alterada para ${meta.name}`);
    }
  }

  async function testLibreTranslateConnection(targetUrl, extraStatusEl = null) {
    const cleanedUrl = (targetUrl || elements.libreTranslateUrlInput.value || DEFAULTS.LIBRE_TRANSLATE_URL).trim().replace(/\/+$/, "");

    const statusTargets = [elements.libreConnectionStatus, extraStatusEl].filter(Boolean);
    for (const el of statusTargets) {
      el.className = "libre-connection-status";
      el.textContent = `Testando conexão com ${cleanedUrl}...`;
      el.classList.remove("hidden");
    }

    try {
      const response = await fetch(`${cleanedUrl}/languages`, { method: "GET" });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const langs = await response.json();
      const count = Array.isArray(langs) ? langs.length : 0;
      for (const el of statusTargets) {
        el.className = "libre-connection-status ok";
        el.textContent = `Conectado com sucesso a ${cleanedUrl} (${count} idiomas disponíveis).`;
      }
    } catch (_err) {
      const isLocal = cleanedUrl.includes("localhost") || cleanedUrl.includes("127.0.0.1");
      for (const el of statusTargets) {
        el.className = "libre-connection-status err";
        el.textContent = isLocal ? `Não foi possível conectar a ${cleanedUrl}. Certifique-se de que o servidor LibreTranslate está em execução na porta 5000.` : `Não foi possível responder em ${cleanedUrl}. Verifique o endereço ou use outro espelho.`;
      }
    }
  }

  function populateLanguageSelects() {
    elements.baseLanguageSelect.replaceChildren();
    if (elements.secondaryLanguageSelect) {
      elements.secondaryLanguageSelect.replaceChildren();
    }
    for (const language of SUPPORTED_LANGUAGES) {
      const option1 = document.createElement("option");
      option1.value = language.code;
      option1.textContent = language.label;
      elements.baseLanguageSelect.appendChild(option1);

      if (elements.secondaryLanguageSelect) {
        const option2 = document.createElement("option");
        option2.value = language.code;
        option2.textContent = language.label;
        elements.secondaryLanguageSelect.appendChild(option2);
      }
    }
  }

  function showSaveFeedback(message, isError = false) {
    clearTimeout(feedbackTimer);
    elements.saveStatusFeedback.textContent = message;
    elements.saveStatusFeedback.className = `toast-feedback ${isError ? "error" : "success"}`;
    elements.saveStatusFeedback.classList.remove("hidden");

    feedbackTimer = setTimeout(() => {
      elements.saveStatusFeedback.classList.add("hidden");
    }, LIMITS.STATUS_FEEDBACK_DURATION_MS);
  }

  function togglePasswordVisibility() {
    const isPassword = elements.apiKeyInput.type === "password";
    elements.apiKeyInput.type = isPassword ? "text" : "password";
    elements.togglePasswordBtn.textContent = isPassword ? "Ocultar" : "Mostrar";
  }

  function formatKeyEventToShortcut(event) {
    const ignoredKeys = ["Control", "Alt", "Shift", "Meta", "OS"];
    if (ignoredKeys.includes(event.key)) {
      return null;
    }

    const modifiers = [];
    if (event.ctrlKey) {
      modifiers.push("Ctrl");
    }
    if (event.altKey) {
      modifiers.push("Alt");
    }
    if (event.shiftKey) {
      modifiers.push("Shift");
    }

    if (modifiers.length === 0) {
      return null;
    }

    const normalizedKey = event.key.length === 1 ? event.key.toUpperCase() : event.key;

    return `${modifiers.join("+")}+${normalizedKey}`;
  }

  async function readLiveBrowserShortcuts() {
    if (typeof browser === "undefined" || !browser.commands || typeof browser.commands.getAll !== "function") {
      return {};
    }

    try {
      const commands = await browser.commands.getAll();
      const map = {};
      for (const cmd of commands) {
        if (cmd.name && cmd.shortcut) {
          map[cmd.name] = cmd.shortcut;
        }
      }
      return map;
    } catch (_error) {
      return {};
    }
  }

  async function updateBrowserCommandShortcut(commandName, shortcutValue) {
    if (typeof browser === "undefined" || !browser.commands || typeof browser.commands.update !== "function") {
      return { ok: true };
    }

    try {
      await browser.commands.update({
        name: commandName,
        shortcut: shortcutValue,
      });
      return { ok: true };
    } catch (_error) {
      return {
        ok: false,
        message: "Use Alt ou Ctrl combinado com uma letra ou número (ex: Alt+T).",
      };
    }
  }

  async function applyAndSaveShortcut(commandName, storageKey, inputEl, previewEl, newShortcut) {
    const result = await updateBrowserCommandShortcut(commandName, newShortcut);
    if (!result.ok) {
      showSaveFeedback(result.message, true);
      return;
    }
    inputEl.value = newShortcut;
    renderKbdKeycaps(previewEl, newShortcut);
    await saveUserPreferences({
      [storageKey]: newShortcut,
    });
    showSaveFeedback(`Atalho ${newShortcut} salvo`);
  }

  function bindShortcutRecorder(inputElement, previewElement, commandName, storageKey) {
    inputElement.addEventListener("keydown", async (event) => {
      if (event.key === "Tab" || event.key === "Escape") {
        return;
      }
      event.preventDefault();
      const recorded = formatKeyEventToShortcut(event);
      if (recorded) {
        await applyAndSaveShortcut(commandName, storageKey, inputElement, previewElement, recorded);
      }
    });
  }

  function scheduleTextFieldsAutoSave() {
    clearTimeout(textSaveDebounceTimer);
    textSaveDebounceTimer = setTimeout(async () => {
      const trimmedApiKey = elements.apiKeyInput.value.trim();
      const trimmedLibreUrl = elements.libreTranslateUrlInput.value.trim() || DEFAULTS.LIBRE_TRANSLATE_URL;
      const trimmedLibreKey = elements.libreTranslateKeyInput.value.trim();

      await saveUserPreferences({
        [STORAGE_KEYS.API_KEY]: trimmedApiKey,
        [STORAGE_KEYS.LIBRE_TRANSLATE_URL]: trimmedLibreUrl,
        [STORAGE_KEYS.LIBRE_TRANSLATE_API_KEY]: trimmedLibreKey,
      });
      showSaveFeedback("Credenciais salvas automaticamente");
    }, 550);
  }

  async function loadInitialPreferences() {
    elements.googleCloudLink.href = EXTERNAL_URLS.GOOGLE_CLOUD_CREDENTIALS_URL;
    populateLanguageSelects();
    attachLogoFallback(elements.activeProviderLogoImg, elements.activeProviderLogoFallback);

    const [preferences, liveShortcuts] = await Promise.all([getUserPreferences(), readLiveBrowserShortcuts()]);

    isOfflineEngineEnabled = preferences[STORAGE_KEYS.OFFLINE_ENGINE_ENABLED] !== false;
    selectedProviderId = normalizeProviderId(preferences[STORAGE_KEYS.PROVIDER], DEFAULTS.PROVIDER);
    renderProviderDeck();
    await selectProvider(selectedProviderId, { persistImmediately: false });

    updateTypingModeUI(preferences[STORAGE_KEYS.AUTO_TRANSLATE_ON_TYPE], preferences[STORAGE_KEYS.TYPING_DEBOUNCE_MS]);

    const effectiveModalShortcut = liveShortcuts[COMMAND_NAMES.TRANSLATE_SELECTION] || preferences[STORAGE_KEYS.SHORTCUT] || DEFAULTS.SHORTCUT;

    const effectiveSidebarShortcut = liveShortcuts[COMMAND_NAMES.EXECUTE_SIDEBAR_ACTION] || preferences[STORAGE_KEYS.SIDEBAR_SHORTCUT] || DEFAULTS.SIDEBAR_SHORTCUT;

    elements.apiKeyInput.value = preferences[STORAGE_KEYS.API_KEY] || "";
    elements.libreTranslateUrlInput.value = preferences[STORAGE_KEYS.LIBRE_TRANSLATE_URL] || DEFAULTS.LIBRE_TRANSLATE_URL;
    elements.libreTranslateKeyInput.value = preferences[STORAGE_KEYS.LIBRE_TRANSLATE_API_KEY] || "";
    elements.baseLanguageSelect.value = normalizeLanguageCode(preferences[STORAGE_KEYS.BASE_LANGUAGE]);
    if (elements.secondaryLanguageSelect) {
      elements.secondaryLanguageSelect.value = normalizeLanguageCode(
        preferences[STORAGE_KEYS.SECONDARY_LANGUAGE] ||
        preferences[STORAGE_KEYS.LAST_SECONDARY_LANGUAGE] ||
        resolveFallbackSecondaryLanguage(preferences[STORAGE_KEYS.BASE_LANGUAGE])
      );
    }

    elements.shortcutInput.value = effectiveModalShortcut;
    renderKbdKeycaps(elements.shortcutKbdPreview, effectiveModalShortcut);

    elements.sidebarShortcutInput.value = effectiveSidebarShortcut;
    renderKbdKeycaps(elements.sidebarShortcutKbdPreview, effectiveSidebarShortcut);

    elements.showSelectionIconInput.checked = preferences[STORAGE_KEYS.SHOW_SELECTION_ICON] !== false;

    applyThemeToDocument(preferences[STORAGE_KEYS.THEME]);

    const opacityPercent = Math.round(clampModalOpacity(preferences[STORAGE_KEYS.MODAL_OPACITY]) * 100);
    elements.modalOpacityInput.value = String(opacityPercent);
    updateLiveGlassPreview(opacityPercent);
  }

  async function openBrowserShortcutManager() {
    const extApi = typeof browser !== "undefined" ? browser : typeof chrome !== "undefined" ? chrome : null;

    if (extApi?.commands && typeof extApi.commands.openShortcutSettings === "function") {
      try {
        await extApi.commands.openShortcutSettings();
        return;
      } catch (_openSettingsError) {
        // Continua para o fallback por URL
      }
    }

    const runtimeBaseUrl = extApi?.runtime && typeof extApi.runtime.getURL === "function" ? extApi.runtime.getURL("") : "";
    const isChromiumEngine = runtimeBaseUrl.startsWith("chrome-extension://") || (!runtimeBaseUrl.startsWith("moz-extension://") && /Chrome|Chromium|Edg|OPR|Brave/i.test(navigator.userAgent));

    const targetShortcutUrl = isChromiumEngine ? EXTERNAL_URLS.CHROMIUM_SHORTCUTS_URL : EXTERNAL_URLS.GECKO_SHORTCUTS_URL;

    if (extApi?.tabs && typeof extApi.tabs.create === "function") {
      try {
        await extApi.tabs.create({ url: targetShortcutUrl });
        return;
      } catch (_tabCreateError) {
        // Fallback para área de transferência
      }
    }

    try {
      await navigator.clipboard.writeText(targetShortcutUrl);
      showSaveFeedback(`Endereço ${targetShortcutUrl} copiado`);
    } catch (_clipboardError) {
      showSaveFeedback(`Acesse ${targetShortcutUrl} no navegador`);
    }
  }

  async function refreshShortcutsFromBrowser() {
    const liveShortcuts = await readLiveBrowserShortcuts();
    if (liveShortcuts[COMMAND_NAMES.TRANSLATE_SELECTION]) {
      const modalShortcut = liveShortcuts[COMMAND_NAMES.TRANSLATE_SELECTION];
      elements.shortcutInput.value = modalShortcut;
      renderKbdKeycaps(elements.shortcutKbdPreview, modalShortcut);
    }
    if (liveShortcuts[COMMAND_NAMES.EXECUTE_SIDEBAR_ACTION]) {
      const sidebarShortcut = liveShortcuts[COMMAND_NAMES.EXECUTE_SIDEBAR_ACTION];
      elements.sidebarShortcutInput.value = sidebarShortcut;
      renderKbdKeycaps(elements.sidebarShortcutKbdPreview, sidebarShortcut);
    }
  }

  // Navegação por Abas
  for (const btn of elements.tabButtons) {
    btn.addEventListener("click", () => {
      switchActiveTab(btn.dataset.tabTarget);
    });
  }

  elements.providerSelectorToggleBtn.addEventListener("click", toggleProviderDeck);
  elements.togglePasswordBtn.addEventListener("click", togglePasswordVisibility);

  // Eventos do Modal de Ajuda em Etapas (Wizard)
  for (const bannerBtn of elements.wizardBannerButtons) {
    bannerBtn.addEventListener("click", () => {
      const wizardId = bannerBtn.getAttribute("data-wizard-id");
      if (wizardId) {
        openWizardModal(wizardId, 0);
      }
    });
  }

  elements.closeWizardModalBtn.addEventListener("click", closeWizardModal);

  elements.stepWizardBackdrop.addEventListener("click", (event) => {
    if (event.target === elements.stepWizardBackdrop) {
      closeWizardModal();
    }
  });

  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !elements.stepWizardBackdrop.classList.contains("hidden")) {
      closeWizardModal();
    }
  });

  elements.wizardPrevStepBtn.addEventListener("click", () => {
    if (activeWizardStepIndex > 0) {
      activeWizardStepIndex -= 1;
      renderActiveWizardStep();
    }
  });

  elements.wizardNextStepBtn.addEventListener("click", () => {
    const guide = WIZARD_GUIDES[activeWizardId];
    if (!guide) {
      closeWizardModal();
      return;
    }
    if (activeWizardStepIndex < guide.steps.length - 1) {
      activeWizardStepIndex += 1;
      renderActiveWizardStep();
    } else {
      closeWizardModal();
    }
  });

  // Auto-Save: Idioma Mãe e Segundo Idioma de Fallback
  elements.baseLanguageSelect.addEventListener("change", async () => {
    const selectedBaseLanguage = normalizeLanguageCode(elements.baseLanguageSelect.value);
    let selectedSecondary = elements.secondaryLanguageSelect
      ? normalizeLanguageCode(elements.secondaryLanguageSelect.value)
      : DEFAULTS.SECONDARY_LANGUAGE_DEFAULT;

    if (areSameLanguages(selectedBaseLanguage, selectedSecondary)) {
      selectedSecondary = resolveFallbackSecondaryLanguage(selectedBaseLanguage);
      if (elements.secondaryLanguageSelect) {
        elements.secondaryLanguageSelect.value = selectedSecondary;
      }
    }

    await saveUserPreferences({
      [STORAGE_KEYS.BASE_LANGUAGE]: selectedBaseLanguage,
      [STORAGE_KEYS.SECONDARY_LANGUAGE]: selectedSecondary,
      [STORAGE_KEYS.LAST_SECONDARY_LANGUAGE]: selectedSecondary
    });
    showSaveFeedback("Idiomas de tradução salvos");
  });

  if (elements.secondaryLanguageSelect) {
    elements.secondaryLanguageSelect.addEventListener("change", async () => {
      let selectedSecondary = normalizeLanguageCode(elements.secondaryLanguageSelect.value);
      const currentBase = normalizeLanguageCode(elements.baseLanguageSelect.value);

      if (areSameLanguages(selectedSecondary, currentBase)) {
        selectedSecondary = resolveFallbackSecondaryLanguage(currentBase);
        elements.secondaryLanguageSelect.value = selectedSecondary;
      }

      await saveUserPreferences({
        [STORAGE_KEYS.SECONDARY_LANGUAGE]: selectedSecondary,
        [STORAGE_KEYS.LAST_SECONDARY_LANGUAGE]: selectedSecondary
      });
      showSaveFeedback("Segundo idioma de fallback salvo");
    });
  }

  // Auto-Save: Modo de tradução ao digitar e tempo de espera
  elements.autoTranslateOnTypeInput.addEventListener("change", async () => {
    const enabled = Boolean(elements.autoTranslateOnTypeInput.checked);
    updateTypingModeUI(enabled, elements.typingDebounceInput.value);
    await saveUserPreferences({
      [STORAGE_KEYS.AUTO_TRANSLATE_ON_TYPE]: enabled,
    });
    showSaveFeedback(enabled ? "Tradução automática ao digitar ativada" : "Modo botão Traduzir ativado");
  });

  elements.typingDebounceInput.addEventListener("input", () => {
    updateTypingModeUI(elements.autoTranslateOnTypeInput.checked, elements.typingDebounceInput.value);
  });

  elements.typingDebounceInput.addEventListener("change", async () => {
    const clampedMs = clampTypingDebounceMs(elements.typingDebounceInput.value);
    updateTypingModeUI(elements.autoTranslateOnTypeInput.checked, clampedMs);
    await saveUserPreferences({
      [STORAGE_KEYS.TYPING_DEBOUNCE_MS]: clampedMs,
    });
    showSaveFeedback(`Tempo de espera salvo (${(clampedMs / 1000).toFixed(1)}s)`);
  });

  // Auto-Save: Campos de texto (Google Key / LibreTranslate)
  elements.apiKeyInput.addEventListener("input", scheduleTextFieldsAutoSave);
  elements.libreTranslateUrlInput.addEventListener("input", scheduleTextFieldsAutoSave);
  elements.libreTranslateKeyInput.addEventListener("input", scheduleTextFieldsAutoSave);

  // LibreTranslate: Presets de Mini-Servidor Local e Teste de Conexão
  if (elements.useLocalLibreBtn) {
    elements.useLocalLibreBtn.addEventListener("click", async () => {
      elements.libreTranslateUrlInput.value = DEFAULTS.LIBRE_TRANSLATE_LOCAL_URL;
      await saveUserPreferences({
        [STORAGE_KEYS.LIBRE_TRANSLATE_URL]: DEFAULTS.LIBRE_TRANSLATE_LOCAL_URL,
      });
      showSaveFeedback("Configurado para Mini-Servidor Local (localhost:5000)");
      await testLibreTranslateConnection(DEFAULTS.LIBRE_TRANSLATE_LOCAL_URL);
    });
  }

  if (elements.usePublicLibreBtn) {
    elements.usePublicLibreBtn.addEventListener("click", async () => {
      elements.libreTranslateUrlInput.value = DEFAULTS.LIBRE_TRANSLATE_URL;
      await saveUserPreferences({
        [STORAGE_KEYS.LIBRE_TRANSLATE_URL]: DEFAULTS.LIBRE_TRANSLATE_URL,
      });
      showSaveFeedback("Configurado para espelho público gratuito");
      await testLibreTranslateConnection(DEFAULTS.LIBRE_TRANSLATE_URL);
    });
  }

  if (elements.testLibreServerBtn) {
    elements.testLibreServerBtn.addEventListener("click", () => {
      testLibreTranslateConnection();
    });
  }

  // Gerenciamento Offline
  elements.toggleOfflineEngineBtn.addEventListener("click", async () => {
    const nextEnabled = !isOfflineEngineEnabled;
    try {
      const response = await browser.runtime.sendMessage({
        type: MESSAGE_TYPES.SET_OFFLINE_ENGINE_ENABLED,
        payload: { enabled: nextEnabled },
      });
      if (response && response.ok) {
        renderOfflineManagementStatus(response);
        showSaveFeedback(nextEnabled ? "Modelo local ativado" : "Modelo local desativado da memória");
      }
    } catch (_err) {
      // Ignora erro
    }
  });

  elements.uninstallOfflineModelsBtn.addEventListener("click", () => {
    elements.uninstallOfflineModelsBtn.classList.add("hidden");
    elements.uninstallOfflineConfirmGroup.classList.remove("hidden");
  });

  elements.cancelUninstallOfflineBtn.addEventListener("click", () => {
    elements.uninstallOfflineConfirmGroup.classList.add("hidden");
    elements.uninstallOfflineModelsBtn.classList.remove("hidden");
  });

  elements.confirmUninstallOfflineBtn.addEventListener("click", async () => {
    try {
      const response = await browser.runtime.sendMessage({
        type: MESSAGE_TYPES.UNINSTALL_OFFLINE_MODELS,
      });
      if (response && response.ok) {
        renderOfflineManagementStatus(response);
        showSaveFeedback("Modelos locais desinstalados");
      }
    } catch (_err) {
      // Ignora erro
    }
  });

  // Auto-Save: Tema (Cartões visuais e botão no topo)
  async function setAndSaveTheme(nextTheme) {
    applyThemeToDocument(nextTheme);
    await saveUserPreferences({
      [STORAGE_KEYS.THEME]: currentTheme,
    });
    showSaveFeedback("Tema atualizado");
  }

  elements.themeCardDark.addEventListener("click", () => setAndSaveTheme(THEMES.DARK));
  elements.themeCardLight.addEventListener("click", () => setAndSaveTheme(THEMES.LIGHT));
  elements.themeToggleBtn.addEventListener("click", () => {
    const nextTheme = currentTheme === THEMES.DARK ? THEMES.LIGHT : THEMES.DARK;
    setAndSaveTheme(nextTheme);
  });

  // Auto-Save: Ícone de seleção
  elements.showSelectionIconInput.addEventListener("change", async () => {
    await saveUserPreferences({
      [STORAGE_KEYS.SHOW_SELECTION_ICON]: Boolean(elements.showSelectionIconInput.checked),
    });
    showSaveFeedback("Preferência de ícone salva");
  });

  // Auto-Save + Preview Ao Vivo: Opacidade do Vidro
  elements.modalOpacityInput.addEventListener("input", () => {
    updateLiveGlassPreview(elements.modalOpacityInput.value);
  });

  elements.modalOpacityInput.addEventListener("change", async () => {
    const modalOpacityRatio = clampModalOpacity(Number(elements.modalOpacityInput.value) / 100);
    await saveUserPreferences({
      [STORAGE_KEYS.MODAL_OPACITY]: modalOpacityRatio,
    });
    showSaveFeedback("Opacidade do vidro salva");
  });

  // Gravador e Restauração de Atalhos
  bindShortcutRecorder(elements.shortcutInput, elements.shortcutKbdPreview, COMMAND_NAMES.TRANSLATE_SELECTION, STORAGE_KEYS.SHORTCUT);

  bindShortcutRecorder(elements.sidebarShortcutInput, elements.sidebarShortcutKbdPreview, COMMAND_NAMES.EXECUTE_SIDEBAR_ACTION, STORAGE_KEYS.SIDEBAR_SHORTCUT);

  elements.resetShortcutBtn.addEventListener("click", () => {
    applyAndSaveShortcut(COMMAND_NAMES.TRANSLATE_SELECTION, STORAGE_KEYS.SHORTCUT, elements.shortcutInput, elements.shortcutKbdPreview, DEFAULTS.SHORTCUT);
  });

  elements.resetSidebarShortcutBtn.addEventListener("click", () => {
    applyAndSaveShortcut(COMMAND_NAMES.EXECUTE_SIDEBAR_ACTION, STORAGE_KEYS.SIDEBAR_SHORTCUT, elements.sidebarShortcutInput, elements.sidebarShortcutKbdPreview, DEFAULTS.SIDEBAR_SHORTCUT);
  });

  elements.openBrowserShortcutsBtn.addEventListener("click", openBrowserShortcutManager);

  if (typeof browser !== "undefined" && browser.storage && browser.storage.onChanged) {
    browser.storage.onChanged.addListener((changes, areaName) => {
      if (areaName !== "local") {
        return;
      }
      if (changes[STORAGE_KEYS.PROVIDER]) {
        const nextProvider = changes[STORAGE_KEYS.PROVIDER].newValue;
        if (nextProvider && nextProvider !== selectedProviderId) {
          selectProvider(nextProvider, { persistImmediately: false });
        }
      }
      if (changes[STORAGE_KEYS.THEME]) {
        applyThemeToDocument(changes[STORAGE_KEYS.THEME].newValue);
      }
      if (changes[STORAGE_KEYS.OFFLINE_DOWNLOADED_MODELS] || changes[STORAGE_KEYS.OFFLINE_ENGINE_ENABLED]) {
        if (selectedProviderId === PROVIDERS.OFFLINE) {
          refreshOfflineManagementState();
        }
      }
    });
  }

  window.addEventListener("focus", () => {
    refreshShortcutsFromBrowser();
    if (selectedProviderId === PROVIDERS.OFFLINE) {
      refreshOfflineManagementState();
    }
  });

  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) {
      refreshShortcutsFromBrowser();
      if (selectedProviderId === PROVIDERS.OFFLINE) {
        refreshOfflineManagementState();
      }
    }
  });

  elements.openWelcomeBtn.addEventListener("click", () => {
    browser.runtime.sendMessage({
      type: MESSAGE_TYPES.OPEN_WELCOME_PAGE,
    });
  });

  elements.form.addEventListener("submit", (event) => {
    event.preventDefault();
  });

  loadInitialPreferences();
})(typeof globalThis !== "undefined" ? globalThis : window);
