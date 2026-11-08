(function initWelcomePage(globalScope) {
  "use strict";

  const namespace = globalScope.TranslatorExt || {};
  const { STORAGE_KEYS, THEMES, DEFAULTS, MESSAGE_TYPES } = namespace.CONSTANTS;
  const { SUPPORTED_LANGUAGES, normalizeLanguageCode } = namespace.Languages;
  const { PROVIDER_CATALOG, normalizeProviderId } = namespace.Providers;
  const { getUserPreferences, saveUserPreferences } = namespace.Storage;

  const themeToggleBtn = document.getElementById("themeToggleBtn");
  const openOptionsTopBtn = document.getElementById("openOptionsTopBtn");
  const openOptionsBtn = document.getElementById("openOptionsBtn");
  const welcomeBaseLangSelect = document.getElementById("welcomeBaseLangSelect");
  const welcomeProviderSelect = document.getElementById("welcomeProviderSelect");
  const quickSaveBadge = document.getElementById("quickSaveBadge");
  const openFreeModalBtn = document.getElementById("openFreeModalBtn");
  const trySampleButtons = document.querySelectorAll(".try-sample-btn");

  let currentTheme = THEMES.DARK;
  let badgeTimer = null;

  const demoWidget =
    namespace.activeContentWidget ||
    (namespace.TranslatorWidget ? new namespace.TranslatorWidget() : null);

  function applyThemeToDocument(theme) {
    currentTheme = theme === THEMES.LIGHT ? THEMES.LIGHT : THEMES.DARK;
    document.body.setAttribute("data-theme", currentTheme);
    themeToggleBtn.textContent = currentTheme === THEMES.DARK ? "Tema Claro" : "Tema Escuro";
  }

  function populateQuickSetupSelects() {
    welcomeBaseLangSelect.innerHTML = "";
    for (const lang of SUPPORTED_LANGUAGES) {
      const opt = document.createElement("option");
      opt.value = lang.code;
      opt.textContent = lang.label;
      welcomeBaseLangSelect.appendChild(opt);
    }

    welcomeProviderSelect.innerHTML = "";
    for (const provider of PROVIDER_CATALOG) {
      const opt = document.createElement("option");
      opt.value = provider.id;
      opt.textContent = `${provider.name} (${provider.requiresApiKey ? "Com chave" : "Gratuito"})`;
      welcomeProviderSelect.appendChild(opt);
    }
  }

  function flashQuickSaveFeedback(text) {
    clearTimeout(badgeTimer);
    quickSaveBadge.textContent = text;
    badgeTimer = setTimeout(() => {
      quickSaveBadge.textContent = "Tudo pronto para usar";
    }, 2200);
  }

  async function initPage() {
    populateQuickSetupSelects();
    const preferences = await getUserPreferences();
    applyThemeToDocument(preferences[STORAGE_KEYS.THEME]);
    welcomeBaseLangSelect.value = normalizeLanguageCode(preferences[STORAGE_KEYS.BASE_LANGUAGE]);
    welcomeProviderSelect.value = normalizeProviderId(preferences[STORAGE_KEYS.PROVIDER], DEFAULTS.PROVIDER);
  }

  welcomeBaseLangSelect.addEventListener("change", async () => {
    const chosenLang = normalizeLanguageCode(welcomeBaseLangSelect.value);
    await saveUserPreferences({
      [STORAGE_KEYS.BASE_LANGUAGE]: chosenLang
    });
    flashQuickSaveFeedback("Idioma Mãe salvo automaticamente");
  });

  welcomeProviderSelect.addEventListener("change", async () => {
    const chosenProvider = normalizeProviderId(welcomeProviderSelect.value, DEFAULTS.PROVIDER);
    await saveUserPreferences({
      [STORAGE_KEYS.PROVIDER]: chosenProvider
    });
    flashQuickSaveFeedback("Fonte de tradução atualizada");
  });

  themeToggleBtn.addEventListener("click", async () => {
    const nextTheme = currentTheme === THEMES.DARK ? THEMES.LIGHT : THEMES.DARK;
    applyThemeToDocument(nextTheme);
    await saveUserPreferences({
      [STORAGE_KEYS.THEME]: nextTheme
    });
  });

  function openOptionsPage() {
    if (typeof browser !== "undefined" && browser.runtime && typeof browser.runtime.openOptionsPage === "function") {
      browser.runtime.openOptionsPage();
      return;
    }
    browser.runtime.sendMessage({
      type: MESSAGE_TYPES.OPEN_OPTIONS_PAGE
    });
  }

  openOptionsTopBtn.addEventListener("click", openOptionsPage);
  openOptionsBtn.addEventListener("click", openOptionsPage);

  if (openFreeModalBtn && demoWidget) {
    openFreeModalBtn.addEventListener("click", () => {
      demoWidget.openCenteredModal({
        initialText: "",
        focusInput: true
      });
    });
  }

  for (const btn of trySampleButtons) {
    btn.addEventListener("click", () => {
      const sampleText = btn.getAttribute("data-sample") || "";
      if (demoWidget && sampleText) {
        demoWidget.openCenteredModal({
          initialText: sampleText,
          focusInput: false
        });
      }
    });
  }

  initPage();
})(typeof globalThis !== "undefined" ? globalThis : window);
