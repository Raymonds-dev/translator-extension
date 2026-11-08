(function initWelcomePage(globalScope) {
  "use strict";

  const namespace = globalScope.TranslatorExt || {};
  const { STORAGE_KEYS, THEMES, MESSAGE_TYPES } = namespace.CONSTANTS;
  const { getUserPreferences, saveUserPreferences } = namespace.Storage;

  const themeToggleBtn = document.getElementById("themeToggleBtn");
  const openOptionsBtn = document.getElementById("openOptionsBtn");

  let currentTheme = THEMES.DARK;

  function applyThemeToDocument(theme) {
    currentTheme = theme === THEMES.LIGHT ? THEMES.LIGHT : THEMES.DARK;
    document.body.setAttribute("data-theme", currentTheme);
    themeToggleBtn.textContent = currentTheme === THEMES.DARK ? "Tema Claro" : "Tema Escuro";
  }

  async function initPage() {
    const preferences = await getUserPreferences();
    applyThemeToDocument(preferences[STORAGE_KEYS.THEME]);
  }

  themeToggleBtn.addEventListener("click", async () => {
    const nextTheme = currentTheme === THEMES.DARK ? THEMES.LIGHT : THEMES.DARK;
    applyThemeToDocument(nextTheme);
    await saveUserPreferences({
      [STORAGE_KEYS.THEME]: nextTheme
    });
  });

  openOptionsBtn.addEventListener("click", () => {
    if (typeof browser !== "undefined" && browser.runtime && typeof browser.runtime.openOptionsPage === "function") {
      browser.runtime.openOptionsPage();
      return;
    }
    browser.runtime.sendMessage({
      type: MESSAGE_TYPES.OPEN_OPTIONS_PAGE
    });
  });

  initPage();
})(typeof globalThis !== "undefined" ? globalThis : window);
