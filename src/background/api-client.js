(function initApiClient(globalScope) {
  "use strict";

  const namespace = globalScope.TranslatorExt || {};
  const {
    EXTERNAL_URLS,
    PROVIDERS,
    DEFAULTS,
    SESSION_STATUS,
    HTTP_STATUS,
    MESSAGE_TYPES,
    UI_MESSAGES
  } = namespace.CONSTANTS;
  const {
    normalizeLanguageCode,
    getLanguageLabel,
    areSameLanguages,
    resolveFallbackSecondaryLanguage,
    detectLanguageLocally
  } = namespace.Languages;
  const { LINGVA_MIRRORS, LIBRETRANSLATE_MIRRORS } = namespace.Providers;
  const { recordDownloadedOfflineModel, clearDownloadedOfflineModels } = namespace.Storage;

  let offlineWorkerInstance = null;
  let offlineRequestCounter = 0;
  const pendingOfflineRequests = new Map();

  function decodeHtmlEntities(text) {
    if (!text || typeof text !== "string") {
      return "";
    }
    return text
      .replace(/&quot;/g, "\"")
      .replace(/&#39;/g, "'")
      .replace(/&apos;/g, "'")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&amp;/g, "&");
  }

  function isAuthenticationOrQuotaHttpStatus(httpStatus) {
    return (
      httpStatus === HTTP_STATUS.BAD_REQUEST ||
      httpStatus === HTTP_STATUS.UNAUTHORIZED ||
      httpStatus === HTTP_STATUS.FORBIDDEN ||
      httpStatus === HTTP_STATUS.TOO_MANY_REQUESTS
    );
  }

  function toShortIsoCode(langCode) {
    if (!langCode || langCode === DEFAULTS.AUTO_LANGUAGE) {
      return DEFAULTS.AUTO_LANGUAGE;
    }
    const normalized = normalizeLanguageCode(langCode);
    if (normalized === "zh-CN") {
      return "zh";
    }
    if (normalized === "zh-TW") {
      return "zt";
    }
    return normalized.split(/[-_]/)[0].toLowerCase();
  }

  function describeModelIdInPortuguese(modelId, srcCode, tgtCode) {
    if (modelId === "Xenova/opus-mt-en-ROMANCE") {
      return "Inglês → Português / Espanhol / Francês / Italiano";
    }
    if (modelId === "Xenova/opus-mt-ROMANCE-en") {
      return "Português / Espanhol / Francês / Italiano → Inglês";
    }
    if (srcCode && tgtCode) {
      return `${getLanguageLabel(srcCode)} → ${getLanguageLabel(tgtCode)}`;
    }
    const match = typeof modelId === "string" ? modelId.match(/opus-mt-([a-z]+)-([a-z]+)/i) : null;
    if (match) {
      return `${getLanguageLabel(match[1])} → ${getLanguageLabel(match[2])}`;
    }
    return modelId || "Pacote local";
  }

  async function requestGoogleTranslation({ apiKey, text, sourceLanguage, targetLanguage }) {
    const trimmedKey = typeof apiKey === "string" ? apiKey.trim() : "";
    if (!trimmedKey) {
      return {
        ok: false,
        status: SESSION_STATUS.MISSING_API_KEY,
        provider: PROVIDERS.GOOGLE,
        errorMessage: UI_MESSAGES.MISSING_API_KEY
      };
    }

    const requestBody = {
      q: text,
      target: normalizeLanguageCode(targetLanguage),
      format: "text"
    };

    if (sourceLanguage && sourceLanguage !== DEFAULTS.AUTO_LANGUAGE) {
      requestBody.source = normalizeLanguageCode(sourceLanguage);
    }

    const endpointUrl = `${EXTERNAL_URLS.GOOGLE_TRANSLATE_V2_ENDPOINT}?key=${encodeURIComponent(trimmedKey)}`;

    let response;
    try {
      response = await fetch(endpointUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json; charset=utf-8"
        },
        body: JSON.stringify(requestBody)
      });
    } catch (_networkError) {
      return {
        ok: false,
        status: SESSION_STATUS.NETWORK_ERROR,
        provider: PROVIDERS.GOOGLE,
        errorMessage: UI_MESSAGES.NETWORK_ERROR
      };
    }

    if (!response.ok) {
      if (isAuthenticationOrQuotaHttpStatus(response.status)) {
        return {
          ok: false,
          status: SESSION_STATUS.INVALID_API_KEY,
          provider: PROVIDERS.GOOGLE,
          errorMessage: UI_MESSAGES.INVALID_API_KEY
        };
      }

      return {
        ok: false,
        status: SESSION_STATUS.NETWORK_ERROR,
        provider: PROVIDERS.GOOGLE,
        errorMessage: UI_MESSAGES.NETWORK_ERROR
      };
    }

    let responseJson;
    try {
      responseJson = await response.json();
    } catch (_parseError) {
      return {
        ok: false,
        status: SESSION_STATUS.NETWORK_ERROR,
        provider: PROVIDERS.GOOGLE,
        errorMessage: UI_MESSAGES.NETWORK_ERROR
      };
    }

    const firstTranslation = responseJson?.data?.translations?.[0];
    if (!firstTranslation || typeof firstTranslation.translatedText !== "string") {
      return {
        ok: false,
        status: SESSION_STATUS.NETWORK_ERROR,
        provider: PROVIDERS.GOOGLE,
        errorMessage: UI_MESSAGES.NETWORK_ERROR
      };
    }

    const detectedSource = firstTranslation.detectedSourceLanguage
      ? normalizeLanguageCode(firstTranslation.detectedSourceLanguage)
      : normalizeLanguageCode(sourceLanguage);

    return {
      ok: true,
      status: SESSION_STATUS.SUCCESS,
      provider: PROVIDERS.GOOGLE,
      data: {
        translatedText: decodeHtmlEntities(firstTranslation.translatedText),
        detectedSourceLanguage: detectedSource
      }
    };
  }

  async function requestLingvaTranslation({ text, sourceLanguage, targetLanguage, baseLanguage, secondaryLanguage }) {
    const srcParam = sourceLanguage === DEFAULTS.AUTO_LANGUAGE
      ? "auto"
      : toShortIsoCode(sourceLanguage);
    const tgtParam = toShortIsoCode(targetLanguage);

    for (const mirrorBase of LINGVA_MIRRORS) {
      const endpoint = `${mirrorBase}/api/v1/${encodeURIComponent(srcParam)}/${encodeURIComponent(tgtParam)}/${encodeURIComponent(text)}`;
      try {
        const response = await fetch(endpoint, { method: "GET" });
        if (!response.ok) {
          continue;
        }
        const json = await response.json();
        if (typeof json?.translation === "string" && json.translation.trim()) {
          const rawDetected = json?.info?.detectedSource ||
            (sourceLanguage !== DEFAULTS.AUTO_LANGUAGE
              ? sourceLanguage
              : detectLanguageLocally(text, baseLanguage, secondaryLanguage));

          return {
            ok: true,
            status: SESSION_STATUS.SUCCESS,
            provider: PROVIDERS.LINGVA,
            data: {
              translatedText: decodeHtmlEntities(json.translation),
              detectedSourceLanguage: normalizeLanguageCode(rawDetected)
            }
          };
        }
      } catch (_mirrorError) {
        // Tenta o próximo servidor espelho do Lingva
      }
    }

    return {
      ok: false,
      status: SESSION_STATUS.PROVIDER_LIMIT_ERROR,
      provider: PROVIDERS.LINGVA,
      errorMessage:
        "Os servidores públicos do Lingva estão ocupados no momento. Você pode alternar para outra fonte gratuita com um clique."
    };
  }

  async function requestMyMemoryTranslation({ text, sourceLanguage, targetLanguage, baseLanguage, secondaryLanguage }) {
    let resolvedSource = sourceLanguage;
    if (!resolvedSource || resolvedSource === DEFAULTS.AUTO_LANGUAGE) {
      resolvedSource = detectLanguageLocally(text, baseLanguage, secondaryLanguage);
    }

    let normalizedSource = normalizeLanguageCode(resolvedSource);
    const normalizedTarget = normalizeLanguageCode(targetLanguage);

    if (areSameLanguages(normalizedSource, normalizedTarget)) {
      normalizedSource = areSameLanguages(normalizedTarget, baseLanguage)
        ? normalizeLanguageCode(secondaryLanguage || resolveFallbackSecondaryLanguage(baseLanguage))
        : normalizeLanguageCode(baseLanguage);
    }

    const langPair = `${normalizedSource}|${normalizedTarget}`;
    const url = `${EXTERNAL_URLS.MYMEMORY_GET_ENDPOINT}?q=${encodeURIComponent(text)}&langpair=${encodeURIComponent(langPair)}`;

    try {
      const response = await fetch(url, { method: "GET" });
      if (!response.ok) {
        if (response.status === HTTP_STATUS.TOO_MANY_REQUESTS || response.status === HTTP_STATUS.FORBIDDEN) {
          return {
            ok: false,
            status: SESSION_STATUS.PROVIDER_LIMIT_ERROR,
            provider: PROVIDERS.MYMEMORY,
            errorMessage:
              "O limite diário gratuito do MyMemory foi atingido. Troque para outra fonte gratuita abaixo."
          };
        }
        return {
          ok: false,
          status: SESSION_STATUS.NETWORK_ERROR,
          provider: PROVIDERS.MYMEMORY,
          errorMessage: UI_MESSAGES.NETWORK_ERROR
        };
      }

      const json = await response.json();
      const quotaFinished = Boolean(json?.quotaFinished) || Number(json?.responseStatus) === 429;
      if (quotaFinished) {
        return {
          ok: false,
          status: SESSION_STATUS.PROVIDER_LIMIT_ERROR,
          provider: PROVIDERS.MYMEMORY,
          errorMessage:
            "O limite gratuito diário do MyMemory foi atingido. Troque para outra fonte gratuita abaixo."
        };
      }

      const translatedText = json?.responseData?.translatedText;
      if (typeof translatedText !== "string" || !translatedText.trim()) {
        return {
          ok: false,
          status: SESSION_STATUS.PROVIDER_LIMIT_ERROR,
          provider: PROVIDERS.MYMEMORY,
          errorMessage: UI_MESSAGES.PROVIDER_LIMIT_ERROR
        };
      }

      return {
        ok: true,
        status: SESSION_STATUS.SUCCESS,
        provider: PROVIDERS.MYMEMORY,
        data: {
          translatedText: decodeHtmlEntities(translatedText),
          detectedSourceLanguage: normalizedSource
        }
      };
    } catch (_error) {
      return {
        ok: false,
        status: SESSION_STATUS.NETWORK_ERROR,
        provider: PROVIDERS.MYMEMORY,
        errorMessage: UI_MESSAGES.NETWORK_ERROR
      };
    }
  }

  async function requestLibreTranslateTranslation({
    text,
    sourceLanguage,
    targetLanguage,
    libreTranslateUrl,
    libreTranslateApiKey,
    baseLanguage,
    secondaryLanguage
  }) {
    const candidateServers = [];
    if (libreTranslateUrl && typeof libreTranslateUrl === "string" && libreTranslateUrl.trim()) {
      candidateServers.push(libreTranslateUrl.trim().replace(/\/+$/, ""));
    }
    for (const mirror of LIBRETRANSLATE_MIRRORS) {
      if (!candidateServers.includes(mirror)) {
        candidateServers.push(mirror);
      }
    }

    const srcCode = sourceLanguage === DEFAULTS.AUTO_LANGUAGE
      ? "auto"
      : toShortIsoCode(sourceLanguage);
    const tgtCode = toShortIsoCode(targetLanguage);

    const bodyPayload = {
      q: text,
      source: srcCode,
      target: tgtCode,
      format: "text"
    };

    if (libreTranslateApiKey && typeof libreTranslateApiKey === "string" && libreTranslateApiKey.trim()) {
      bodyPayload.api_key = libreTranslateApiKey.trim();
    }

    for (const serverBase of candidateServers) {
      try {
        const response = await fetch(`${serverBase}/translate`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify(bodyPayload)
        });

        if (!response.ok) {
          continue;
        }

        const json = await response.json();
        if (typeof json?.translatedText === "string" && json.translatedText.trim()) {
          const detected = json?.detectedLanguage?.language ||
            (sourceLanguage !== DEFAULTS.AUTO_LANGUAGE
              ? sourceLanguage
              : detectLanguageLocally(text, baseLanguage, secondaryLanguage));

          return {
            ok: true,
            status: SESSION_STATUS.SUCCESS,
            provider: PROVIDERS.LIBRETRANSLATE,
            data: {
              translatedText: decodeHtmlEntities(json.translatedText),
              detectedSourceLanguage: normalizeLanguageCode(detected)
            }
          };
        }
      } catch (_mirrorErr) {
        // Continua para o próximo espelho do LibreTranslate
      }
    }

    return {
      ok: false,
      status: SESSION_STATUS.PROVIDER_LIMIT_ERROR,
      provider: PROVIDERS.LIBRETRANSLATE,
      errorMessage:
        "Os servidores públicos do LibreTranslate exigiram chave ou atingiram o limite. Você pode trocar para outra fonte gratuita com um clique."
    };
  }

  function broadcastOfflineProgress(payload) {
    if (typeof browser === "undefined" || !browser.runtime) {
      return;
    }

    browser.runtime
      .sendMessage({
        type: MESSAGE_TYPES.OFFLINE_DOWNLOAD_PROGRESS,
        payload
      })
      .catch(() => {});

    if (browser.tabs && typeof browser.tabs.query === "function") {
      browser.tabs
        .query({ active: true })
        .then((tabs) => {
          for (const tab of tabs) {
            if (tab && typeof tab.id === "number") {
              browser.tabs
                .sendMessage(tab.id, {
                  type: MESSAGE_TYPES.OFFLINE_DOWNLOAD_PROGRESS,
                  payload
                })
                .catch(() => {});
            }
          }
        })
        .catch(() => {});
    }
  }

  function isOfflineWorkerRunning() {
    return Boolean(offlineWorkerInstance);
  }

  function terminateOfflineWorker() {
    if (offlineWorkerInstance) {
      try {
        offlineWorkerInstance.terminate();
      } catch (_terminateError) {
        // Ignora erro ao encerrar worker
      }
      offlineWorkerInstance = null;
    }

    for (const [reqId, resolver] of pendingOfflineRequests.entries()) {
      pendingOfflineRequests.delete(reqId);
      resolver({
        type: "OFFLINE_ERROR",
        requestId: reqId,
        ok: false,
        errorMessage: "O motor de tradução local foi desativado da memória."
      });
    }
  }

  function ensureOfflineWorker() {
    if (offlineWorkerInstance) {
      return offlineWorkerInstance;
    }

    const workerUrl = browser.runtime.getURL("src/background/offline-worker.js");
    offlineWorkerInstance = new Worker(workerUrl, { type: "module" });

    offlineWorkerInstance.addEventListener("message", (event) => {
      const data = event.data;
      if (!data) {
        return;
      }

      if (data.type === "OFFLINE_PROGRESS") {
        const srcLabel = data.sourceLanguage ? getLanguageLabel(data.sourceLanguage) : "";
        const tgtLabel = data.targetLanguage ? getLanguageLabel(data.targetLanguage) : "";
        const pairDisplay = srcLabel && tgtLabel ? ` (${srcLabel} → ${tgtLabel})` : "";
        const sizeDetail = typeof data.sizeDetail === "string" ? data.sizeDetail : "";
        const formattedMessage = `Baixando pacote de tradução${pairDisplay}: ${data.progress}%${sizeDetail}...`;

        broadcastOfflineProgress({
          provider: PROVIDERS.OFFLINE,
          status: data.progress >= 100 ? "ready" : "downloading",
          progress: data.progress,
          message: formattedMessage,
          languagePair: data.languagePair,
          sourceLanguage: data.sourceLanguage,
          targetLanguage: data.targetLanguage
        });
        return;
      }

      if (data.type === "OFFLINE_RESULT" || data.type === "OFFLINE_ERROR") {
        const resolver = pendingOfflineRequests.get(data.requestId);
        if (resolver) {
          pendingOfflineRequests.delete(data.requestId);
          resolver(data);
        }
      }
    });

    offlineWorkerInstance.addEventListener("error", () => {
      for (const [reqId, resolver] of pendingOfflineRequests.entries()) {
        pendingOfflineRequests.delete(reqId);
        resolver({
          type: "OFFLINE_ERROR",
          requestId: reqId,
          ok: false,
          errorMessage:
            "Não foi possível iniciar o motor de tradução offline neste navegador. Experimente uma das fontes gratuitas online."
        });
      }
    });

    return offlineWorkerInstance;
  }

  async function inspectCachedOfflineModels(storedModels = []) {
    const mergedByModelId = new Map();
    for (const item of storedModels) {
      if (item && item.modelId) {
        mergedByModelId.set(item.modelId, {
          modelId: item.modelId,
          label: item.label || describeModelIdInPortuguese(item.modelId),
          downloadedAt: item.downloadedAt || Date.now()
        });
      }
    }

    if (typeof caches !== "undefined" && typeof caches.keys === "function") {
      try {
        const cacheNames = await caches.keys();
        for (const name of cacheNames) {
          if (name.includes("transformers") || name.includes("huggingface") || name.includes("xenova")) {
            const cache = await caches.open(name);
            const requests = await cache.keys();
            for (const req of requests) {
              const url = req.url || "";
              const match = url.match(/Xenova\/(opus-mt-[^/]+)/i);
              if (match) {
                const fullModelId = `Xenova/${match[1]}`;
                if (!mergedByModelId.has(fullModelId)) {
                  mergedByModelId.set(fullModelId, {
                    modelId: fullModelId,
                    label: describeModelIdInPortuguese(fullModelId),
                    downloadedAt: Date.now()
                  });
                }
              }
            }
          }
        }
      } catch (_cacheInspectErr) {
        // Ignora erro caso CacheStorage não esteja acessível
      }
    }

    return Array.from(mergedByModelId.values());
  }

  async function uninstallOfflineModels() {
    terminateOfflineWorker();

    if (typeof caches !== "undefined" && typeof caches.keys === "function") {
      try {
        const cacheNames = await caches.keys();
        for (const name of cacheNames) {
          if (name.includes("transformers") || name.includes("huggingface") || name.includes("xenova")) {
            await caches.delete(name);
          }
        }
      } catch (_cacheDeleteErr) {
        // Ignora erro ao apagar CacheStorage
      }
    }

    await clearDownloadedOfflineModels();
    return [];
  }

  async function requestOfflineTranslation({
    text,
    sourceLanguage,
    targetLanguage,
    baseLanguage,
    secondaryLanguage,
    offlineEngineEnabled = true
  }) {
    if (offlineEngineEnabled === false) {
      terminateOfflineWorker();
      return {
        ok: false,
        status: SESSION_STATUS.PROVIDER_LIMIT_ERROR,
        provider: PROVIDERS.OFFLINE,
        errorMessage: UI_MESSAGES.OFFLINE_DISABLED_ERROR
      };
    }

    let resolvedSource = sourceLanguage;
    if (!resolvedSource || resolvedSource === DEFAULTS.AUTO_LANGUAGE) {
      resolvedSource = detectLanguageLocally(text, baseLanguage, secondaryLanguage);
    }

    const normalizedSource = normalizeLanguageCode(resolvedSource);
    const normalizedTarget = normalizeLanguageCode(targetLanguage);

    let worker;
    try {
      worker = ensureOfflineWorker();
    } catch (_workerInitError) {
      return {
        ok: false,
        status: SESSION_STATUS.PROVIDER_LIMIT_ERROR,
        provider: PROVIDERS.OFFLINE,
        errorMessage:
          "Não foi possível iniciar o Web Worker de tradução offline. Escolha outra fonte gratuita."
      };
    }

    const requestId = `offline_${++offlineRequestCounter}_${Date.now()}`;

    const workerResponse = await new Promise((resolve) => {
      pendingOfflineRequests.set(requestId, resolve);
      worker.postMessage({
        type: "TRANSLATE_OFFLINE",
        requestId,
        text,
        sourceLanguage: normalizedSource,
        targetLanguage: normalizedTarget
      });
    });

    if (!workerResponse || !workerResponse.ok) {
      return {
        ok: false,
        status: SESSION_STATUS.PROVIDER_LIMIT_ERROR,
        provider: PROVIDERS.OFFLINE,
        errorMessage:
          workerResponse?.errorMessage || UI_MESSAGES.PROVIDER_LIMIT_ERROR
      };
    }

    if (Array.isArray(workerResponse.usedModels)) {
      for (const used of workerResponse.usedModels) {
        if (used && used.modelId) {
          await recordDownloadedOfflineModel({
            modelId: used.modelId,
            label: describeModelIdInPortuguese(used.modelId, used.src, used.tgt)
          });
        }
      }
    }

    return {
      ok: true,
      status: SESSION_STATUS.SUCCESS,
      provider: PROVIDERS.OFFLINE,
      data: {
        translatedText: workerResponse.translatedText,
        detectedSourceLanguage: normalizeLanguageCode(
          workerResponse.detectedSourceLanguage || normalizedSource
        )
      }
    };
  }

  async function requestTranslationByProvider(options) {
    const provider = options?.provider || DEFAULTS.PROVIDER;

    if (provider !== PROVIDERS.OFFLINE && isOfflineWorkerRunning()) {
      terminateOfflineWorker();
    }

    if (provider === PROVIDERS.GOOGLE) {
      return requestGoogleTranslation(options);
    }

    if (provider === PROVIDERS.MYMEMORY) {
      return requestMyMemoryTranslation(options);
    }

    if (provider === PROVIDERS.LIBRETRANSLATE) {
      return requestLibreTranslateTranslation(options);
    }

    if (provider === PROVIDERS.OFFLINE) {
      return requestOfflineTranslation(options);
    }

    return requestLingvaTranslation(options);
  }

  namespace.ApiClient = Object.freeze({
    requestGoogleTranslation,
    requestLingvaTranslation,
    requestMyMemoryTranslation,
    requestLibreTranslateTranslation,
    requestOfflineTranslation,
    requestTranslationByProvider,
    isOfflineWorkerRunning,
    terminateOfflineWorker,
    inspectCachedOfflineModels,
    uninstallOfflineModels
  });

  globalScope.TranslatorExt = namespace;
})(typeof globalThis !== "undefined" ? globalThis : window);
