(function initContentScript(globalScope) {
  "use strict";

  if (globalScope.__translatorExtContentLoaded) {
    return;
  }
  globalScope.__translatorExtContentLoaded = true;

  const namespace = globalScope.TranslatorExt || {};
  const { MESSAGE_TYPES, STORAGE_KEYS, DEFAULTS } = namespace.CONSTANTS;
  const TranslatorWidget = namespace.TranslatorWidget;

  const widget = new TranslatorWidget();
  namespace.activeContentWidget = widget;
  let lastSelectionText = "";
  let lastSelectionRect = null;
  let lastSidebarSentText = "";
  let showSelectionIcon = DEFAULTS.SHOW_SELECTION_ICON;

  function initSelectionIconPreference() {
    if (typeof browser === "undefined" || !browser.storage || !browser.storage.local) {
      return;
    }

    browser.storage.local
      .get({ [STORAGE_KEYS.SHOW_SELECTION_ICON]: DEFAULTS.SHOW_SELECTION_ICON })
      .then((stored) => {
        showSelectionIcon = stored[STORAGE_KEYS.SHOW_SELECTION_ICON] !== false;
        if (!showSelectionIcon && widget.isTriggerVisible()) {
          widget.hideFloatingTrigger();
        }
      })
      .catch(() => {});

    if (browser.storage.onChanged) {
      browser.storage.onChanged.addListener((changes, areaName) => {
        if (areaName !== "local" || !changes[STORAGE_KEYS.SHOW_SELECTION_ICON]) {
          return;
        }
        showSelectionIcon = changes[STORAGE_KEYS.SHOW_SELECTION_ICON].newValue !== false;
        if (!showSelectionIcon && widget.isTriggerVisible()) {
          widget.hideFloatingTrigger();
        }
      });
    }
  }

  function isEditableFormElement(element) {
    if (!element || !(element instanceof Element)) {
      return false;
    }
    const tagName = element.tagName ? element.tagName.toLowerCase() : "";
    if (tagName === "input" || tagName === "textarea") {
      return true;
    }
    return Boolean(element.isContentEditable);
  }

  function extractActiveSelectionInfo() {
    const activeElement = document.activeElement;
    if (
      activeElement &&
      (activeElement.tagName === "INPUT" || activeElement.tagName === "TEXTAREA") &&
      typeof activeElement.selectionStart === "number" &&
      typeof activeElement.selectionEnd === "number"
    ) {
      if (activeElement.tagName === "INPUT" && activeElement.type === "password") {
        return null;
      }
      const selectedInputSlice = activeElement.value.slice(
        activeElement.selectionStart,
        activeElement.selectionEnd
      );
      const trimmedSlice = selectedInputSlice.trim();
      if (!trimmedSlice) {
        return null;
      }
      return {
        text: trimmedSlice,
        rect: activeElement.getBoundingClientRect(),
        isInsideEditable: true
      };
    }

    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
      return null;
    }

    const rawText = selection.toString();
    const trimmedText = rawText.trim();
    if (!trimmedText) {
      return null;
    }

    const anchorElement = selection.anchorNode?.nodeType === Node.ELEMENT_NODE
      ? selection.anchorNode
      : selection.anchorNode?.parentElement;

    if (anchorElement && typeof anchorElement.closest === "function" && anchorElement.closest('input[type="password"]')) {
      return null;
    }

    const range = selection.getRangeAt(0);
    let rect = range.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) {
      const clientRects = range.getClientRects();
      if (clientRects.length > 0) {
        rect = clientRects[clientRects.length - 1];
      }
    }

    if (rect.width === 0 && rect.height === 0) {
      return {
        text: trimmedText,
        rect: {
          left: Math.round(window.innerWidth / 2),
          top: Math.round(window.innerHeight / 3),
          right: Math.round(window.innerWidth / 2),
          bottom: Math.round(window.innerHeight / 3),
          width: 10,
          height: 10
        },
        isInsideEditable: false
      };
    }

    return {
      text: trimmedText,
      rect: {
        left: rect.left,
        top: rect.top,
        right: rect.right,
        bottom: rect.bottom,
        width: rect.width,
        height: rect.height
      },
      isInsideEditable: isEditableFormElement(anchorElement)
    };
  }

  async function tryForwardSelectionToSidebar(text) {
    if (!text || typeof browser === "undefined" || !browser.runtime || !browser.runtime.sendMessage) {
      return false;
    }

    try {
      const response = await browser.runtime.sendMessage({
        type: MESSAGE_TYPES.PAGE_TEXT_SELECTED,
        payload: { text }
      });
      return Boolean(response && response.deliveredToSidebar);
    } catch (_err) {
      return false;
    }
  }

  widget.setOnTriggerClick(async () => {
    const activeSelection = extractActiveSelectionInfo();
    const textToTranslate = activeSelection?.text || lastSelectionText;
    if (!textToTranslate) {
      return;
    }

    const deliveredToSidebar = await tryForwardSelectionToSidebar(textToTranslate);
    if (deliveredToSidebar) {
      widget.hideFloatingTrigger();
      return;
    }

    widget.openCenteredModal({
      initialText: textToTranslate,
      focusInput: false
    });
  });

  function evaluateSelectionAndShowTrigger(event) {
    if (event && widget.isEventInsideWidget(event)) {
      return;
    }

    setTimeout(async () => {
      const selectionInfo = extractActiveSelectionInfo();

      if (!selectionInfo) {
        lastSelectionText = "";
        lastSelectionRect = null;
        lastSidebarSentText = "";
        if (widget.isTriggerVisible()) {
          widget.hideFloatingTrigger();
        }
        return;
      }

      lastSelectionText = selectionInfo.text;
      lastSelectionRect = selectionInfo.rect;

      // Se o Painel Lateral estiver aberto, envia o novo texto selecionado diretamente para ele
      if (selectionInfo.text !== lastSidebarSentText) {
        const deliveredToSidebar = await tryForwardSelectionToSidebar(selectionInfo.text);
        if (deliveredToSidebar) {
          lastSidebarSentText = selectionInfo.text;
          if (widget.isTriggerVisible()) {
            widget.hideFloatingTrigger();
          }
          return;
        }
      }

      if (!showSelectionIcon || widget.isModalOpen() || selectionInfo.isInsideEditable) {
        if (!showSelectionIcon && widget.isTriggerVisible()) {
          widget.hideFloatingTrigger();
        }
        return;
      }

      widget.showFloatingTrigger(selectionInfo.rect);
    }, 15);
  }

  document.addEventListener("mouseup", evaluateSelectionAndShowTrigger, true);

  // Evita layout thrashing síncrono (getBoundingClientRect) a cada movimento de cursor
  document.addEventListener("selectionchange", () => {
    const activeEl = document.activeElement;
    const isInput = activeEl && (activeEl.tagName === "INPUT" || activeEl.tagName === "TEXTAREA");
    let hasActiveSelection = false;

    if (isInput && activeEl.type !== "password") {
      hasActiveSelection =
        typeof activeEl.selectionStart === "number" &&
        typeof activeEl.selectionEnd === "number" &&
        activeEl.selectionStart !== activeEl.selectionEnd &&
        Boolean(activeEl.value.slice(activeEl.selectionStart, activeEl.selectionEnd).trim());
    } else {
      const sel = window.getSelection();
      hasActiveSelection = Boolean(
        sel && sel.rangeCount > 0 && !sel.isCollapsed && sel.toString().trim()
      );
    }

    if (!hasActiveSelection) {
      lastSelectionText = "";
      lastSelectionRect = null;
      lastSidebarSentText = "";
      if (widget.isTriggerVisible()) {
        widget.hideFloatingTrigger();
      }
    }
  });

  // Oculta o botão flutuante ao rolar a página para não deixá-lo órfão no ar
  window.addEventListener("scroll", () => {
    if (widget.isTriggerVisible()) {
      widget.hideFloatingTrigger();
    }
  }, { passive: true });

  document.addEventListener("keyup", (event) => {
    if (event.key === "Escape") {
      return;
    }
    if (event.shiftKey || event.key.startsWith("Arrow")) {
      evaluateSelectionAndShowTrigger(event);
    }
  }, true);

  document.addEventListener("mousedown", (event) => {
    if (widget.isEventInsideWidget(event)) {
      return;
    }

    if (widget.isModalOpen() || widget.isTriggerVisible()) {
      widget.hideAll();
    }
  }, true);

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && (widget.isModalOpen() || widget.isTriggerVisible())) {
      widget.hideAll();
    }
  }, true);

  if (typeof browser !== "undefined" && browser.runtime && browser.runtime.onMessage) {
    browser.runtime.onMessage.addListener((message) => {
      if (!message || typeof message.type !== "string") {
        return undefined;
      }

      if (message.type === MESSAGE_TYPES.PING_CONTENT_SCRIPT) {
        return Promise.resolve({ alive: true });
      }

      if (message.type === MESSAGE_TYPES.CLOSE_IN_PAGE_MODAL) {
        widget.hideAll();
        return Promise.resolve({ ok: true });
      }

      if (message.type === MESSAGE_TYPES.TRIGGER_SHORTCUT_MODAL) {
        if (widget.isModalOpen()) {
          widget.hideAll();
          return Promise.resolve({ ok: true, mode: "closed" });
        }

        const selectionInfo = extractActiveSelectionInfo();
        const textToTranslate = selectionInfo?.text || "";

        if (textToTranslate) {
          lastSelectionText = textToTranslate;
          widget.openCenteredModal({
            initialText: textToTranslate,
            focusInput: false
          });
          return Promise.resolve({ ok: true, mode: "selection" });
        }

        widget.openCenteredModal({
          initialText: "",
          focusInput: true
        });
        return Promise.resolve({ ok: true, mode: "free-input" });
      }

      if (message.type === MESSAGE_TYPES.OPEN_MODAL_WITH_TEXT) {
        const providedText = typeof message.payload?.text === "string"
          ? message.payload.text.trim()
          : "";
        const fallbackSelection = extractActiveSelectionInfo()?.text || "";
        const finalText = providedText || fallbackSelection;

        widget.openCenteredModal({
          initialText: finalText,
          focusInput: !finalText
        });
        return Promise.resolve({ ok: true });
      }

      if (message.type === MESSAGE_TYPES.GET_ACTIVE_SELECTION) {
        const selectionInfo = extractActiveSelectionInfo();
        return Promise.resolve({
          text: selectionInfo ? selectionInfo.text : ""
        });
      }

      return undefined;
    });
  }

  initSelectionIconPreference();
})(typeof globalThis !== "undefined" ? globalThis : window);
