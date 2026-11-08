(function initConstants(globalScope) {
  "use strict";

  const namespace = globalScope.TranslatorExt || {};

  const LIMITS = Object.freeze({
    MAX_CHARS_PER_QUERY: 2000,
    MAX_HISTORY_ITEMS: 20,
    TYPING_DEBOUNCE_MS: 500,
    COPY_FEEDBACK_DURATION_MS: 1500,
    STATUS_FEEDBACK_DURATION_MS: 2500,
    ICON_OFFSET_PX: 8,
    ICON_SIZE_PX: 34,
    MODAL_WIDTH_PX: 420,
    VIEWPORT_MARGIN_PX: 16,
    MIN_MODAL_OPACITY: 0.65,
    MAX_MODAL_OPACITY: 1.0,
    DEFAULT_MODAL_OPACITY: 0.88
  });

  const PROVIDERS = Object.freeze({
    LINGVA: "lingva",
    MYMEMORY: "mymemory",
    LIBRETRANSLATE: "libretranslate",
    GOOGLE: "google",
    OFFLINE: "offline"
  });

  const STORAGE_KEYS = Object.freeze({
    PROVIDER: "provider",
    API_KEY: "apiKey",
    LIBRE_TRANSLATE_URL: "libreTranslateUrl",
    LIBRE_TRANSLATE_API_KEY: "libreTranslateApiKey",
    OFFLINE_ENGINE_ENABLED: "offlineEngineEnabled",
    OFFLINE_DOWNLOADED_MODELS: "offlineDownloadedModels",
    BASE_LANGUAGE: "baseLanguage",
    LAST_SECONDARY_LANGUAGE: "lastSecondaryLanguage",
    SHORTCUT: "shortcut",
    SIDEBAR_SHORTCUT: "sidebarShortcut",
    SHOW_SELECTION_ICON: "showSelectionIcon",
    THEME: "theme",
    MODAL_OPACITY: "modalOpacity",
    MODAL_POSITION: "modalPosition",
    TRANSLATION_HISTORY: "translationHistory",
    WELCOME_SHOWN: "welcomeShown"
  });

  const THEMES = Object.freeze({
    LIGHT: "light",
    DARK: "dark"
  });

  const COMMAND_NAMES = Object.freeze({
    TRANSLATE_SELECTION: "translate-selection",
    EXECUTE_SIDEBAR_ACTION: "_execute_sidebar_action",
    EXECUTE_BROWSER_ACTION: "_execute_browser_action"
  });

  const DEFAULTS = Object.freeze({
    PROVIDER: PROVIDERS.LINGVA,
    API_KEY: "",
    LIBRE_TRANSLATE_URL: "https://translate.terraprint.co",
    LIBRE_TRANSLATE_API_KEY: "",
    OFFLINE_ENGINE_ENABLED: true,
    BASE_LANGUAGE: "pt",
    SECONDARY_LANGUAGE_DEFAULT: "en",
    SECONDARY_LANGUAGE_ALT: "pt",
    AUTO_LANGUAGE: "auto",
    SHORTCUT: "Alt+T",
    SIDEBAR_SHORTCUT: "Alt+Shift+T",
    POPUP_SHORTCUT: "Ctrl+Shift+Y",
    COMMAND_NAME: COMMAND_NAMES.TRANSLATE_SELECTION,
    SHOW_SELECTION_ICON: true,
    THEME: THEMES.DARK,
    MODAL_OPACITY: LIMITS.DEFAULT_MODAL_OPACITY,
    MODAL_POSITION: Object.freeze({
      isCustom: false,
      x: null,
      y: null
    })
  });

  const SESSION_STATUS = Object.freeze({
    IDLE: "IDLE",
    LOADING: "LOADING",
    OFFLINE_DOWNLOADING: "OFFLINE_DOWNLOADING",
    SUCCESS: "SUCCESS",
    MISSING_API_KEY: "MISSING_API_KEY",
    INVALID_API_KEY: "INVALID_API_KEY",
    PROVIDER_LIMIT_ERROR: "PROVIDER_LIMIT_ERROR",
    TEXT_TOO_LONG: "TEXT_TOO_LONG",
    NETWORK_ERROR: "NETWORK_ERROR"
  });

  const MESSAGE_TYPES = Object.freeze({
    TRANSLATE_TEXT: "TRANSLATE_TEXT",
    OPEN_OPTIONS_PAGE: "OPEN_OPTIONS_PAGE",
    OPEN_WELCOME_PAGE: "OPEN_WELCOME_PAGE",
    GET_SESSION_BOOTSTRAP: "GET_SESSION_BOOTSTRAP",
    GET_TRANSLATION_HISTORY: "GET_TRANSLATION_HISTORY",
    CLEAR_TRANSLATION_HISTORY: "CLEAR_TRANSLATION_HISTORY",
    QUICK_SWITCH_PROVIDER: "QUICK_SWITCH_PROVIDER",
    OFFLINE_DOWNLOAD_PROGRESS: "OFFLINE_DOWNLOAD_PROGRESS",
    GET_OFFLINE_RUNTIME_STATUS: "GET_OFFLINE_RUNTIME_STATUS",
    SET_OFFLINE_ENGINE_ENABLED: "SET_OFFLINE_ENGINE_ENABLED",
    UNINSTALL_OFFLINE_MODELS: "UNINSTALL_OFFLINE_MODELS",
    PAGE_TEXT_SELECTED: "PAGE_TEXT_SELECTED",
    TRIGGER_SHORTCUT_MODAL: "TRIGGER_SHORTCUT_MODAL",
    OPEN_MODAL_WITH_TEXT: "OPEN_MODAL_WITH_TEXT",
    CLOSE_IN_PAGE_MODAL: "CLOSE_IN_PAGE_MODAL",
    GET_ACTIVE_SELECTION: "GET_ACTIVE_SELECTION",
    PING_CONTENT_SCRIPT: "PING_CONTENT_SCRIPT"
  });

  const CONTEXT_MENU_IDS = Object.freeze({
    TRANSLATE_SELECTION: "ctx-translate-selection",
    OPEN_FREE_TRANSLATOR: "ctx-open-free-translator",
    OPEN_OPTIONS: "ctx-open-options"
  });

  const EXTERNAL_URLS = Object.freeze({
    GOOGLE_TRANSLATE_V2_ENDPOINT: "https://translation.googleapis.com/language/translate/v2",
    MYMEMORY_GET_ENDPOINT: "https://api.mymemory.translated.net/get",
    GOOGLE_CLOUD_CREDENTIALS_URL: "https://console.cloud.google.com/apis/credentials",
    CHROMIUM_SHORTCUTS_URL: "chrome://extensions/shortcuts",
    GECKO_SHORTCUTS_URL: "about:addons"
  });

  const HTTP_STATUS = Object.freeze({
    BAD_REQUEST: 400,
    UNAUTHORIZED: 401,
    FORBIDDEN: 403,
    TOO_MANY_REQUESTS: 429
  });

  const UI_MESSAGES = Object.freeze({
    MISSING_API_KEY: "Para usar o Google Tradutor Oficial, adicione sua chave nas Opções ou troque para uma fonte gratuita.",
    INVALID_API_KEY: "Sua chave do Google não foi aceita ou atingiu o limite. Confira nas Opções ou use uma fonte gratuita.",
    PROVIDER_LIMIT_ERROR: "Esta fonte gratuita atingiu o limite momentâneo. Você pode alternar para outra fonte gratuita agora.",
    OFFLINE_DISABLED_ERROR: "O motor de tradução local está desativado nas Opções para economizar memória. Ative-o nas Opções ou escolha outra fonte.",
    TEXT_TOO_LONG: "O trecho selecionado é muito longo. Selecione até 2.000 caracteres por vez.",
    NETWORK_ERROR: "Sem conexão com o serviço de tradução no momento. Tente novamente.",
    OPEN_OPTIONS_BUTTON: "Abrir Opções",
    QUICK_SWITCH_BUTTON: "Usar outra fonte gratuita",
    RETRY_BUTTON: "Tentar novamente"
  });

  namespace.CONSTANTS = Object.freeze({
    LIMITS,
    PROVIDERS,
    STORAGE_KEYS,
    THEMES,
    COMMAND_NAMES,
    DEFAULTS,
    SESSION_STATUS,
    MESSAGE_TYPES,
    CONTEXT_MENU_IDS,
    EXTERNAL_URLS,
    HTTP_STATUS,
    UI_MESSAGES
  });

  globalScope.TranslatorExt = namespace;
})(typeof globalThis !== "undefined" ? globalThis : window);
