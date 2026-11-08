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
  const { LIBRETRANSLATE_MIRRORS } = namespace.Providers;
  const { recordDownloadedOfflineModel, clearDownloadedOfflineModels } = namespace.Storage;

  let offlineWorkerInstance = null;
  let offlineWorkerIdleTimer = null;
  const OFFLINE_WORKER_IDLE_TIMEOUT_MS = 90000;
  let offlineRequestCounter = 0;
  const pendingOfflineRequests = new Map();

  function decodeHtmlEntities(text) {
    if (!text || typeof text !== "string") {
      return "";
    }
    return text
      .replace(/&#(\d+);/g, (_match, dec) => {
        try {
          return String.fromCodePoint(Number(dec));
        } catch (_err) {
          return "";
        }
      })
      .replace(/&#x([0-9a-fA-F]+);/g, (_match, hex) => {
        try {
          return String.fromCodePoint(parseInt(hex, 16));
        } catch (_err) {
          return "";
        }
      })
      .replace(/&quot;/g, "\"")
      .replace(/&#39;/g, "'")
      .replace(/&apos;/g, "'")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&nbsp;/g, " ")
      .replace(/&mdash;/g, "—")
      .replace(/&ndash;/g, "–")
      .replace(/&hellip;/g, "…")
      .replace(/&ldquo;/g, "“")
      .replace(/&rdquo;/g, "”")
      .replace(/&lsquo;/g, "‘")
      .replace(/&rsquo;/g, "’")
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

  async function requestMyMemoryTranslation({ text, sourceLanguage, targetLanguage, baseLanguage, secondaryLanguage }) {
    let resolvedSource = sourceLanguage;
    if (!resolvedSource || resolvedSource === DEFAULTS.AUTO_LANGUAGE) {
      resolvedSource = detectLanguageLocally(text, baseLanguage, secondaryLanguage);
    }

    let normalizedSource = normalizeLanguageCode(resolvedSource);
    let normalizedTarget = normalizeLanguageCode(targetLanguage);

    if (areSameLanguages(normalizedSource, normalizedTarget)) {
      normalizedTarget = areSameLanguages(normalizedTarget, baseLanguage)
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

  function isLocalServerUrl(urlValue) {
    return /^https?:\/\/(localhost|127\.\d+\.\d+\.\d+|\[::1\]|192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+)(:\d+)?(\/|$)/i.test(
      String(urlValue || "").trim()
    );
  }

  let cachedServerLanguages = null;
  let cachedServerLanguagesUrl = "";
  let cachedServerLanguagesTimestamp = 0;

  async function getServerLanguages(serverUrl) {
    const normalized = String(serverUrl || "").trim().replace(/\/+$/, "");
    if (!normalized) {
      return null;
    }
    const now = Date.now();
    if (
      cachedServerLanguages &&
      cachedServerLanguagesUrl === normalized &&
      now - cachedServerLanguagesTimestamp < 60000
    ) {
      return cachedServerLanguages;
    }
    try {
      const res = await fetchWithTimeout(`${normalized}/languages`, { method: "GET" }, 2500);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          cachedServerLanguages = data
            .map((item) => String(item.code || "").trim().toLowerCase())
            .filter(Boolean);
          cachedServerLanguagesUrl = normalized;
          cachedServerLanguagesTimestamp = now;
          return cachedServerLanguages;
        }
      }
    } catch (_err) {}
    return null;
  }

  async function fetchWithTimeout(url, options, timeoutMs) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await fetch(url, { ...options, signal: controller.signal });
    } finally {
      clearTimeout(timeoutId);
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
    const configuredUrl =
      libreTranslateUrl && typeof libreTranslateUrl === "string" && libreTranslateUrl.trim()
        ? libreTranslateUrl.trim().replace(/\/+$/, "")
        : "";
    const usingOwnServer = Boolean(configuredUrl) && isLocalServerUrl(configuredUrl);

    const candidateServers = [];
    if (configuredUrl) {
      candidateServers.push(configuredUrl);
    }
    // Servidor próprio do usuário: não mistura com espelhos públicos
    if (!usingOwnServer) {
      for (const mirror of LIBRETRANSLATE_MIRRORS) {
        if (!candidateServers.includes(mirror)) {
          candidateServers.push(mirror);
        }
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

    let ownServerRejection = null; // { status, message }
    let ownServerUnreachable = false;

    for (const serverBase of candidateServers) {
      const isOwn = usingOwnServer && serverBase === configuredUrl;
      try {
        const response = await fetchWithTimeout(
          `${serverBase}/translate`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json"
            },
            body: JSON.stringify(bodyPayload)
          },
          isOwn ? 30000 : 8000
        );

        if (!response.ok) {
          if (isOwn) {
            let serverError = "";
            try {
              const errorJson = await response.json();
              serverError = String(errorJson?.error || "");
            } catch (_parseErr) {
              // Corpo sem JSON
            }
            ownServerRejection = { status: response.status, message: serverError };
          }
          continue;
        }

        const json = await response.json();
        if (typeof json?.translatedText === "string" && json.translatedText.trim()) {
          const rawDetectedObj = json?.detectedLanguage;
          const detectedFromLibre = typeof rawDetectedObj?.language === "string"
            ? rawDetectedObj.language.trim().toLowerCase()
            : "";
          const confidence = typeof rawDetectedObj?.confidence === "number"
            ? rawDetectedObj.confidence
            : 100;

          const locallyDetected = detectLanguageLocally(text, baseLanguage, secondaryLanguage);
          const serverLanguages = usingOwnServer ? await getServerLanguages(serverBase) : null;

          // Se o servidor retornou confidence 0.0, é a assinatura oficial do LibreTranslate
          // para idioma não instalado/não reconhecido (ele força "en" e tenta fatiar a frase sem traduzir)
          const isZeroConfidenceFallback = confidence <= 0.0 || (confidence <= 10.0 && detectedFromLibre === "en");

          // Verifica se a língua real da frase está entre as instaladas no servidor
          const effectiveSourceCode = srcCode !== "auto" ? srcCode : locallyDetected;
          const isSourceMissingOnServer =
            serverLanguages &&
            effectiveSourceCode &&
            !serverLanguages.includes(effectiveSourceCode.toLowerCase());

          // Verifica se o texto traduzido é idêntico ou reteve a maior parte das palavras originais
          const normalizeForCompare = (value) => String(value).trim().replace(/\s+/g, " ").toLowerCase();
          const origNorm = normalizeForCompare(text);
          const transNorm = normalizeForCompare(json.translatedText);
          const isExactSame = /\p{L}/u.test(text) && transNorm === origNorm;

          const origWords = origNorm.match(/\p{L}{3,}/gu) || [];
          let retainedWords = 0;
          for (const w of origWords) {
            if (transNorm.includes(w)) {
              retainedWords++;
            }
          }
          const highWordRetention = origWords.length >= 3 && (retainedWords / origWords.length) >= 0.65;

          const isSourceSameAsTarget =
            areSameLanguages(detectedFromLibre, tgtCode) ||
            areSameLanguages(locallyDetected, tgtCode);

          const hasFailedTranslation =
            (!isSourceSameAsTarget && isSourceMissingOnServer) ||
            (!isSourceSameAsTarget && isZeroConfidenceFallback && (isExactSame || highWordRetention)) ||
            (!isSourceSameAsTarget && isZeroConfidenceFallback && !serverLanguages?.includes("en"));

          if (hasFailedTranslation) {
            let hintLang = "";
            if (effectiveSourceCode && effectiveSourceCode !== tgtCode && effectiveSourceCode !== "en") {
              hintLang = effectiveSourceCode;
            } else if (locallyDetected && locallyDetected !== tgtCode && locallyDetected !== "en") {
              hintLang = locallyDetected;
            } else if (detectedFromLibre && detectedFromLibre !== tgtCode && !isZeroConfidenceFallback) {
              hintLang = detectedFromLibre;
            }

            const hint = hintLang ? `Adicione "${hintLang}"` : "Adicione o idioma da frase";
            return {
              ok: false,
              status: SESSION_STATUS.PROVIDER_LIMIT_ERROR,
              provider: PROVIDERS.LIBRETRANSLATE,
              errorMessage: `Sem tradução. ${hint} em --load-only no servidor ou troque de fonte.`
            };
          }

          const detected =
            sourceLanguage !== DEFAULTS.AUTO_LANGUAGE
              ? sourceLanguage
              : (detectedFromLibre || locallyDetected || DEFAULTS.SECONDARY_LANGUAGE_DEFAULT);

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

        if (isOwn) {
          ownServerRejection = { status: response.status, message: "resposta vazia" };
        }
      } catch (_mirrorErr) {
        if (isOwn) {
          ownServerUnreachable = true;
        }
      }
    }

    if (usingOwnServer && ownServerUnreachable) {
      return {
        ok: false,
        status: SESSION_STATUS.PROVIDER_LIMIT_ERROR,
        provider: PROVIDERS.LIBRETRANSLATE,
        errorMessage: `Servidor LibreTranslate inacessível (${configuredUrl}). Inicie-o ou troque de fonte.`
      };
    }

    if (usingOwnServer && ownServerRejection) {
      const involved = [srcCode === "auto" ? null : srcCode, tgtCode].filter(Boolean).join(", ");
      const languageProblem =
        ownServerRejection.status === HTTP_STATUS.BAD_REQUEST ||
        /not supported|not installed|not available|unsupported/i.test(ownServerRejection.message);
      return {
        ok: false,
        status: SESSION_STATUS.PROVIDER_LIMIT_ERROR,
        provider: PROVIDERS.LIBRETRANSLATE,
        errorMessage: languageProblem
          ? `Idioma não instalado no servidor. Adicione ${involved} em --load-only ou troque de fonte.`
          : "O servidor LibreTranslate recusou a tradução. Troque de fonte ou verifique-o."
      };
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

  function scheduleOfflineWorkerIdleTermination() {
    clearTimeout(offlineWorkerIdleTimer);
    offlineWorkerIdleTimer = setTimeout(() => {
      terminateOfflineWorker();
    }, OFFLINE_WORKER_IDLE_TIMEOUT_MS);
  }

  function cancelOfflineWorkerIdleTermination() {
    if (offlineWorkerIdleTimer) {
      clearTimeout(offlineWorkerIdleTimer);
      offlineWorkerIdleTimer = null;
    }
  }

  function terminateOfflineWorker() {
    cancelOfflineWorkerIdleTermination();
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
    cancelOfflineWorkerIdleTermination();
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
      terminateOfflineWorker();
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

  async function requestMyMemoryWithOfflineFallback(options) {
    const primaryResult = await requestMyMemoryTranslation(options);
    if (primaryResult.ok) {
      return primaryResult;
    }

    // Cota diária atingida ou falha de rede: troca rapidamente para a IA offline
    const offlineResult = await requestOfflineTranslation(options);
    if (offlineResult.ok) {
      return {
        ...offlineResult,
        fallbackFrom: PROVIDERS.MYMEMORY
      };
    }

    return primaryResult;
  }

  async function requestTranslationByProvider(options) {
    const provider = options?.provider || DEFAULTS.PROVIDER;

    if (provider === PROVIDERS.OFFLINE) {
      cancelOfflineWorkerIdleTermination();
    } else if (isOfflineWorkerRunning()) {
      // Agenda encerramento por inatividade em vez de terminar de imediato,
      // evitando churn (recriação contínua) caso o MyMemory esteja em modo de fallback.
      scheduleOfflineWorkerIdleTermination();
    }

    if (provider === PROVIDERS.GOOGLE) {
      return requestGoogleTranslation(options);
    }

    if (provider === PROVIDERS.LIBRETRANSLATE) {
      return requestLibreTranslateTranslation(options);
    }

    if (provider === PROVIDERS.OFFLINE) {
      return requestOfflineTranslation(options);
    }

    return requestMyMemoryWithOfflineFallback(options);
  }

  namespace.ApiClient = Object.freeze({
    requestGoogleTranslation,
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
