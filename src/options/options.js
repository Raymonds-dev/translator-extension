(function initOptionsPage(globalScope) {
  "use strict";

  const namespace = globalScope.TranslatorExt || {};
  const {
    STORAGE_KEYS,
    THEMES,
    COMMAND_NAMES,
    DEFAULTS,
    LIMITS,
    MESSAGE_TYPES,
    EXTERNAL_URLS
  } = namespace.CONSTANTS;
  const { SUPPORTED_LANGUAGES, normalizeLanguageCode } = namespace.Languages;
  const { getUserPreferences, saveUserPreferences, clampModalOpacity } = namespace.Storage;

  const elements = {
    form: document.getElementById("optionsForm"),
    openWelcomeBtn: document.getElementById("openWelcomeBtn"),
    themeToggleBtn: document.getElementById("themeToggleBtn"),
    apiKeyInput: document.getElementById("apiKeyInput"),
    togglePasswordBtn: document.getElementById("togglePasswordBtn"),
    googleCloudLink: document.getElementById("googleCloudLink"),
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

  function applyThemeToDocument(themeValue) {
    currentTheme = themeValue === THEMES.LIGHT ? THEMES.LIGHT : THEMES.DARK;
    document.body.setAttribute("data-theme", currentTheme);
    elements.themeSelect.value = currentTheme;
    elements.themeToggleBtn.textContent = currentTheme === THEMES.DARK ? "Tema Claro" : "Tema Escuro";
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

    const [preferences, liveShortcuts] = await Promise.all([
      getUserPreferences(),
      readLiveBrowserShortcuts()
    ]);

    const effectiveModalShortcut =
      liveShortcuts[COMMAND_NAMES.TRANSLATE_SELECTION] ||
      preferences[STORAGE_KEYS.SHORTCUT] ||
      DEFAULTS.SHORTCUT;

    const effectiveSidebarShortcut =
      liveShortcuts[COMMAND_NAMES.EXECUTE_SIDEBAR_ACTION] ||
      preferences[STORAGE_KEYS.SIDEBAR_SHORTCUT] ||
      DEFAULTS.SIDEBAR_SHORTCUT;

    elements.apiKeyInput.value = preferences[STORAGE_KEYS.API_KEY] || "";
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
      [STORAGE_KEYS.API_KEY]: trimmedApiKey,
      [STORAGE_KEYS.BASE_LANGUAGE]: selectedBaseLanguage,
      [STORAGE_KEYS.SHORTCUT]: chosenShortcut,
      [STORAGE_KEYS.SIDEBAR_SHORTCUT]: chosenSidebarShortcut,
      [STORAGE_KEYS.THEME]: selectedTheme,
      [STORAGE_KEYS.MODAL_OPACITY]: modalOpacityRatio,
      [STORAGE_KEYS.SHOW_SELECTION_ICON]: showSelectionIcon
    });

    applyThemeToDocument(selectedTheme);
    elements.apiKeyInput.value = trimmedApiKey;
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

  elements.togglePasswordBtn.addEventListener("click", togglePasswordVisibility);

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

  async function openBrowserShortcutManager() {
    const extApi = typeof browser !== "undefined"
      ? browser
      : (typeof chrome !== "undefined" ? chrome : null);

    if (extApi?.commands && typeof extApi.commands.openShortcutSettings === "function") {
      try {
        await extApi.commands.openShortcutSettings();
        return;
      } catch (_openSettingsError) {
        // Continua para o fallback por URL caso não suportado nesta versão
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
        // Caso o navegador restrinja abrir páginas internas via extensão, copia o endereço
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

  elements.openBrowserShortcutsBtn.addEventListener("click", openBrowserShortcutManager);

  window.addEventListener("focus", refreshShortcutsFromBrowser);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) {
      refreshShortcutsFromBrowser();
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
