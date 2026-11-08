(function initOptionsPage(globalScope) {
  "use strict";

  const namespace = globalScope.TranslatorExt || {};
  const {
    PROVIDERS,
    STORAGE_KEYS,
    THEMES,
    COMMAND_NAMES,
    DEFAULTS,
    LIMITS,
    MESSAGE_TYPES,
    EXTERNAL_URLS
  } = namespace.CONSTANTS;
  const { SUPPORTED_LANGUAGES, normalizeLanguageCode } = namespace.Languages;
  const { PROVIDER_CATALOG, getProviderMetadata, normalizeProviderId } = namespace.Providers;
  const { getUserPreferences, saveUserPreferences, clampModalOpacity } = namespace.Storage;

  const elements = {
    form: document.getElementById("optionsForm"),
    openWelcomeBtn: document.getElementById("openWelcomeBtn"),
    themeToggleBtn: document.getElementById("themeToggleBtn"),
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
    apiKeyInput: document.getElementById("apiKeyInput"),
    togglePasswordBtn: document.getElementById("togglePasswordBtn"),
    googleCloudLink: document.getElementById("googleCloudLink"),
    libreTranslateUrlInput: document.getElementById("libreTranslateUrlInput"),
    libreTranslateKeyInput: document.getElementById("libreTranslateKeyInput"),
    baseLanguageSelect: document.getElementById("baseLanguageSelect"),
    themeSelect: document.getElementById("themeSelect"),
    modalOpacityInput: document.getElementById("modalOpacityInput"),
    modalOpacityValue: document.getElementById("modalOpacityValue"),
    showSelectionIconInput: document.getElementById("showSelectionIconInput"),
    shortcutInput: document.getElementById("shortcutInput"),
    resetShortcutBtn: document.getElementById("resetShortcutBtn"),
    sidebarShortcutInput: document.getElementById("sidebarShortcutInput"),
    resetSidebarShortcutBtn: document.getElementById("resetSidebarShortcutBtn"),
    openBrowserShortcutsBtn: document.getElementById("openBrowserShortcutsBtn"),
    saveStatusFeedback: document.getElementById("saveStatusFeedback")
  };

  let feedbackTimer = null;
  let currentTheme = DEFAULTS.THEME;
  let selectedProviderId = DEFAULTS.PROVIDER;
  let isOfflineEngineEnabled = true;

  function applyThemeToDocument(themeValue) {
    currentTheme = themeValue === THEMES.LIGHT ? THEMES.LIGHT : THEMES.DARK;
    document.body.setAttribute("data-theme", currentTheme);
    elements.themeSelect.value = currentTheme;
    elements.themeToggleBtn.textContent = currentTheme === THEMES.DARK ? "Tema Claro" : "Tema Escuro";
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
    elements.providerDeckContainer.innerHTML = "";

    for (const provider of PROVIDER_CATALOG) {
      const cardBtn = document.createElement("button");
      cardBtn.type = "button";
      cardBtn.className = "provider-option-card";
      cardBtn.dataset.providerId = provider.id;
      cardBtn.setAttribute("role", "radio");
      cardBtn.setAttribute("aria-checked", String(provider.id === selectedProviderId));

      if (provider.id === selectedProviderId) {
        cardBtn.classList.add("is-selected");
      }

      const topRow = document.createElement("div");
      topRow.className = "provider-card-top";

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
      topRow.appendChild(logoWrap);
      topRow.appendChild(titleGroup);
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
    elements.providerToggleActionText.textContent = isOpen ? "Ocultar" : "Trocar fonte";
  }

  function toggleProviderDeck() {
    const currentlyOpen = elements.providerDeckContainer.classList.contains("is-open");
    setProviderDeckOpen(!currentlyOpen);
  }

  function renderOfflineManagementStatus(statusResponse) {
    const enabled = statusResponse ? statusResponse.enabled !== false : isOfflineEngineEnabled;
    const workerRunning = Boolean(statusResponse?.workerRunning);
    const downloadedModels = Array.isArray(statusResponse?.downloadedModels)
      ? statusResponse.downloadedModels
      : [];

    isOfflineEngineEnabled = enabled;

    if (!enabled) {
      elements.offlineEngineStatusLabel.textContent =
        "Desativado — O motor local está desligado e não consome memória RAM.";
      elements.toggleOfflineEngineBtn.textContent = "Ativar modelo local";
    } else if (workerRunning) {
      elements.offlineEngineStatusLabel.textContent =
        "Ativo na memória agora — Pronto para traduzir instantaneamente (desliga sozinho ao trocar de fonte).";
      elements.toggleOfflineEngineBtn.textContent = "Desativar da memória";
    } else {
      elements.offlineEngineStatusLabel.textContent =
        "Ativado (Em espera: 0 MB de RAM em uso até a próxima tradução offline).";
      elements.toggleOfflineEngineBtn.textContent = "Desativar modelo local";
    }

    elements.uninstallOfflineConfirmGroup.classList.add("hidden");

    if (downloadedModels.length === 0) {
      elements.offlineModelsSummary.textContent = "Nenhum pacote de idioma instalado no navegador.";
      elements.uninstallOfflineModelsBtn.classList.add("hidden");
      elements.offlineInstalledModelsList.classList.add("hidden");
      elements.offlineInstalledModelsList.innerHTML = "";
    } else {
      elements.offlineModelsSummary.textContent = `${downloadedModels.length} pacote(s) de idioma armazenado(s) no navegador:`;
      elements.uninstallOfflineModelsBtn.classList.remove("hidden");
      elements.offlineInstalledModelsList.classList.remove("hidden");
      elements.offlineInstalledModelsList.innerHTML = "";

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
        type: MESSAGE_TYPES.GET_OFFLINE_RUNTIME_STATUS
      });
      if (response && response.ok) {
        renderOfflineManagementStatus(response);
      }
    } catch (_err) {
      // Ignora erro caso background ainda não tenha respondido
    }
  }

  async function selectProvider(providerId, { persistImmediately = false } = {}) {
    selectedProviderId = normalizeProviderId(providerId, DEFAULTS.PROVIDER);
    const meta = getProviderMetadata(selectedProviderId);

    elements.activeProviderLogoFallback.textContent = meta.badgeFallback;
    elements.activeProviderLogoImg.src = `../../${meta.logoPath}`;
    elements.activeProviderName.textContent = meta.name;
    elements.activeProviderTagline.textContent = meta.tagline;
    elements.activeProviderPill.textContent = meta.requiresApiKey
      ? "Requer chave pessoal"
      : "Gratuito · Sem chave";

    elements.detailsDescription.textContent = meta.description;
    elements.detailsLimitationsList.innerHTML = "";
    for (const limitation of meta.limitations) {
      const li = document.createElement("li");
      li.textContent = limitation;
      elements.detailsLimitationsList.appendChild(li);
    }

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
    }

    if (persistImmediately) {
      await saveUserPreferences({
        [STORAGE_KEYS.PROVIDER]: selectedProviderId
      });
      showSaveFeedback(`Fonte alterada para ${meta.name}!`);
    }
  }

  function populateBaseLanguageSelect() {
    elements.baseLanguageSelect.innerHTML = "";
    for (const language of SUPPORTED_LANGUAGES) {
      const option = document.createElement("option");
      option.value = language.code;
      option.textContent = language.label;
      elements.baseLanguageSelect.appendChild(option);
    }
  }

  function showSaveFeedback(message, isError = false) {
    clearTimeout(feedbackTimer);
    elements.saveStatusFeedback.textContent = message;
    elements.saveStatusFeedback.className = `save-feedback ${isError ? "error" : "success"}`;
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

    const normalizedKey = event.key.length === 1
      ? event.key.toUpperCase()
      : event.key;

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
        shortcut: shortcutValue
      });
      return { ok: true };
    } catch (_error) {
      return {
        ok: false,
        message: "Use uma combinação com Alt ou Ctrl seguida de uma letra ou número, como Alt+T ou Alt+Shift+T."
      };
    }
  }

  async function loadInitialPreferences() {
    elements.googleCloudLink.href = EXTERNAL_URLS.GOOGLE_CLOUD_CREDENTIALS_URL;
    populateBaseLanguageSelect();
    attachLogoFallback(
      elements.activeProviderLogoImg,
      elements.activeProviderLogoFallback
    );

    const [preferences, liveShortcuts] = await Promise.all([
      getUserPreferences(),
      readLiveBrowserShortcuts()
    ]);

    isOfflineEngineEnabled = preferences[STORAGE_KEYS.OFFLINE_ENGINE_ENABLED] !== false;
    selectedProviderId = normalizeProviderId(preferences[STORAGE_KEYS.PROVIDER], DEFAULTS.PROVIDER);
    renderProviderDeck();
    await selectProvider(selectedProviderId, { persistImmediately: false });

    const effectiveModalShortcut =
      liveShortcuts[COMMAND_NAMES.TRANSLATE_SELECTION] ||
      preferences[STORAGE_KEYS.SHORTCUT] ||
      DEFAULTS.SHORTCUT;

    const effectiveSidebarShortcut =
      liveShortcuts[COMMAND_NAMES.EXECUTE_SIDEBAR_ACTION] ||
      preferences[STORAGE_KEYS.SIDEBAR_SHORTCUT] ||
      DEFAULTS.SIDEBAR_SHORTCUT;

    elements.apiKeyInput.value = preferences[STORAGE_KEYS.API_KEY] || "";
    elements.libreTranslateUrlInput.value = preferences[STORAGE_KEYS.LIBRE_TRANSLATE_URL] || DEFAULTS.LIBRE_TRANSLATE_URL;
    elements.libreTranslateKeyInput.value = preferences[STORAGE_KEYS.LIBRE_TRANSLATE_API_KEY] || "";
    elements.baseLanguageSelect.value = normalizeLanguageCode(preferences[STORAGE_KEYS.BASE_LANGUAGE]);
    elements.shortcutInput.value = effectiveModalShortcut;
    elements.sidebarShortcutInput.value = effectiveSidebarShortcut;
    elements.showSelectionIconInput.checked = preferences[STORAGE_KEYS.SHOW_SELECTION_ICON] !== false;

    applyThemeToDocument(preferences[STORAGE_KEYS.THEME]);

    const opacityPercent = Math.round(clampModalOpacity(preferences[STORAGE_KEYS.MODAL_OPACITY]) * 100);
    elements.modalOpacityInput.value = String(opacityPercent);
    elements.modalOpacityValue.textContent = `${opacityPercent}%`;
  }

  async function handleFormSubmit(event) {
    event.preventDefault();

    const trimmedApiKey = elements.apiKeyInput.value.trim();
    const trimmedLibreUrl = elements.libreTranslateUrlInput.value.trim() || DEFAULTS.LIBRE_TRANSLATE_URL;
    const trimmedLibreKey = elements.libreTranslateKeyInput.value.trim();
    const selectedBaseLanguage = normalizeLanguageCode(elements.baseLanguageSelect.value);
    const chosenShortcut = elements.shortcutInput.value.trim() || DEFAULTS.SHORTCUT;
    const chosenSidebarShortcut = elements.sidebarShortcutInput.value.trim() || DEFAULTS.SIDEBAR_SHORTCUT;
    const selectedTheme = elements.themeSelect.value === THEMES.LIGHT ? THEMES.LIGHT : THEMES.DARK;
    const modalOpacityRatio = clampModalOpacity(Number(elements.modalOpacityInput.value) / 100);
    const showSelectionIcon = Boolean(elements.showSelectionIconInput.checked);

    const modalShortcutResult = await updateBrowserCommandShortcut(
      COMMAND_NAMES.TRANSLATE_SELECTION,
      chosenShortcut
    );
    if (!modalShortcutResult.ok) {
      showSaveFeedback(modalShortcutResult.message, true);
      return;
    }

    const sidebarShortcutResult = await updateBrowserCommandShortcut(
      COMMAND_NAMES.EXECUTE_SIDEBAR_ACTION,
      chosenSidebarShortcut
    );
    if (!sidebarShortcutResult.ok) {
      showSaveFeedback(sidebarShortcutResult.message, true);
      return;
    }

    await saveUserPreferences({
      [STORAGE_KEYS.PROVIDER]: selectedProviderId,
      [STORAGE_KEYS.API_KEY]: trimmedApiKey,
      [STORAGE_KEYS.LIBRE_TRANSLATE_URL]: trimmedLibreUrl,
      [STORAGE_KEYS.LIBRE_TRANSLATE_API_KEY]: trimmedLibreKey,
      [STORAGE_KEYS.BASE_LANGUAGE]: selectedBaseLanguage,
      [STORAGE_KEYS.SHORTCUT]: chosenShortcut,
      [STORAGE_KEYS.SIDEBAR_SHORTCUT]: chosenSidebarShortcut,
      [STORAGE_KEYS.THEME]: selectedTheme,
      [STORAGE_KEYS.MODAL_OPACITY]: modalOpacityRatio,
      [STORAGE_KEYS.SHOW_SELECTION_ICON]: showSelectionIcon
    });

    applyThemeToDocument(selectedTheme);
    elements.apiKeyInput.value = trimmedApiKey;
    elements.libreTranslateUrlInput.value = trimmedLibreUrl;
    elements.shortcutInput.value = chosenShortcut;
    elements.sidebarShortcutInput.value = chosenSidebarShortcut;
    showSaveFeedback("Opções salvas com sucesso!");
  }

  function bindShortcutRecorder(inputElement) {
    inputElement.addEventListener("keydown", (event) => {
      if (event.key === "Tab") {
        return;
      }
      const recorded = formatKeyEventToShortcut(event);
      if (recorded) {
        event.preventDefault();
        inputElement.value = recorded;
      }
    });
  }

  async function openBrowserShortcutManager() {
    const extApi = typeof browser !== "undefined"
      ? browser
      : (typeof chrome !== "undefined" ? chrome : null);

    if (extApi?.commands && typeof extApi.commands.openShortcutSettings === "function") {
      try {
        await extApi.commands.openShortcutSettings();
        return;
      } catch (_openSettingsError) {
        // Continua para o fallback por URL
      }
    }

    const runtimeBaseUrl = extApi?.runtime && typeof extApi.runtime.getURL === "function"
      ? extApi.runtime.getURL("")
      : "";
    const isChromiumEngine = runtimeBaseUrl.startsWith("chrome-extension://") ||
      (!runtimeBaseUrl.startsWith("moz-extension://") && /Chrome|Chromium|Edg|OPR|Brave/i.test(navigator.userAgent));

    const targetShortcutUrl = isChromiumEngine
      ? EXTERNAL_URLS.CHROMIUM_SHORTCUTS_URL
      : EXTERNAL_URLS.GECKO_SHORTCUTS_URL;

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
      showSaveFeedback(`Endereço ${targetShortcutUrl} copiado! Cole na barra de endereços do navegador.`);
    } catch (_clipboardError) {
      showSaveFeedback(`Acesse ${targetShortcutUrl} na barra de endereços do navegador.`);
    }
  }

  async function refreshShortcutsFromBrowser() {
    const liveShortcuts = await readLiveBrowserShortcuts();
    if (liveShortcuts[COMMAND_NAMES.TRANSLATE_SELECTION]) {
      elements.shortcutInput.value = liveShortcuts[COMMAND_NAMES.TRANSLATE_SELECTION];
    }
    if (liveShortcuts[COMMAND_NAMES.EXECUTE_SIDEBAR_ACTION]) {
      elements.sidebarShortcutInput.value = liveShortcuts[COMMAND_NAMES.EXECUTE_SIDEBAR_ACTION];
    }
  }

  elements.providerSelectorToggleBtn.addEventListener("click", toggleProviderDeck);
  elements.togglePasswordBtn.addEventListener("click", togglePasswordVisibility);

  elements.toggleOfflineEngineBtn.addEventListener("click", async () => {
    const nextEnabled = !isOfflineEngineEnabled;
    try {
      const response = await browser.runtime.sendMessage({
        type: MESSAGE_TYPES.SET_OFFLINE_ENGINE_ENABLED,
        payload: { enabled: nextEnabled }
      });
      if (response && response.ok) {
        renderOfflineManagementStatus(response);
        showSaveFeedback(
          nextEnabled
            ? "Modelo local ativado!"
            : "Modelo local desativado da memória!"
        );
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
        type: MESSAGE_TYPES.UNINSTALL_OFFLINE_MODELS
      });
      if (response && response.ok) {
        renderOfflineManagementStatus(response);
        showSaveFeedback("Modelos locais desinstalados com sucesso!");
      }
    } catch (_err) {
      // Ignora erro
    }
  });

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
      if (
        changes[STORAGE_KEYS.OFFLINE_DOWNLOADED_MODELS] ||
        changes[STORAGE_KEYS.OFFLINE_ENGINE_ENABLED]
      ) {
        if (selectedProviderId === PROVIDERS.OFFLINE) {
          refreshOfflineManagementState();
        }
      }
    });
  }

  elements.resetShortcutBtn.addEventListener("click", () => {
    elements.shortcutInput.value = DEFAULTS.SHORTCUT;
  });

  elements.resetSidebarShortcutBtn.addEventListener("click", () => {
    elements.sidebarShortcutInput.value = DEFAULTS.SIDEBAR_SHORTCUT;
  });

  bindShortcutRecorder(elements.shortcutInput);
  bindShortcutRecorder(elements.sidebarShortcutInput);

  elements.showSelectionIconInput.addEventListener("change", async () => {
    await saveUserPreferences({
      [STORAGE_KEYS.SHOW_SELECTION_ICON]: Boolean(elements.showSelectionIconInput.checked)
    });
  });

  elements.modalOpacityInput.addEventListener("input", () => {
    elements.modalOpacityValue.textContent = `${elements.modalOpacityInput.value}%`;
  });

  elements.themeSelect.addEventListener("change", async () => {
    applyThemeToDocument(elements.themeSelect.value);
    await saveUserPreferences({
      [STORAGE_KEYS.THEME]: currentTheme
    });
  });

  elements.themeToggleBtn.addEventListener("click", async () => {
    const nextTheme = currentTheme === THEMES.DARK ? THEMES.LIGHT : THEMES.DARK;
    applyThemeToDocument(nextTheme);
    await saveUserPreferences({
      [STORAGE_KEYS.THEME]: nextTheme
    });
  });

  elements.openBrowserShortcutsBtn.addEventListener("click", openBrowserShortcutManager);

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
      type: MESSAGE_TYPES.OPEN_WELCOME_PAGE
    });
  });

  elements.form.addEventListener("submit", handleFormSubmit);

  loadInitialPreferences();
})(typeof globalThis !== "undefined" ? globalThis : window);
