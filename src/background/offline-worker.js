/* Web Worker dedicado para Tradução Offline com Hugging Face Transformers.js */

const ROMANCE_LANGS = new Set(["pt", "es", "fr", "it"]);
const ROMANCE_PREFIX_MAP = {
  pt: ">>pt<< ",
  es: ">>es<< ",
  fr: ">>fr<< ",
  it: ">>it<< "
};

let transformersModulePromise = null;
const loadedPipelines = new Map();
const inFlightPipelines = new Map();

async function loadTransformersLibrary() {
  if (!transformersModulePromise) {
    transformersModulePromise = (async () => {
      const localUrl = new URL("../../assets/vendor/transformers.min.js", import.meta.url).href;
      const mod = await import(localUrl);
      if (mod && mod.env) {
        mod.env.allowLocalModels = false;
        mod.env.useBrowserCache = true;
      }
      return mod;
    })();
  }
  return transformersModulePromise;
}

function normalizeIsoPairCode(lang) {
  if (!lang || typeof lang !== "string") {
    return "en";
  }
  return lang.trim().toLowerCase().split(/[-_]/)[0];
}

function resolveModelSpecForPair(src, tgt) {
  if (src === "en" && ROMANCE_LANGS.has(tgt)) {
    return {
      modelId: "Xenova/opus-mt-en-ROMANCE",
      prefix: ROMANCE_PREFIX_MAP[tgt] || ""
    };
  }

  if (ROMANCE_LANGS.has(src) && tgt === "en") {
    return {
      modelId: "Xenova/opus-mt-ROMANCE-en",
      prefix: ""
    };
  }

  return {
    modelId: `Xenova/opus-mt-${src}-${tgt}`,
    prefix: ""
  };
}

function formatMegabytes(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return "0 MB";
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

async function getOrCreateTranslationPipeline(modelId, requestId, src, tgt) {
  if (loadedPipelines.has(modelId)) {
    return loadedPipelines.get(modelId);
  }

  const downloadContext = {
    requestId,
    src,
    tgt,
    languagePair: `${src}-${tgt}`,
    modelId
  };

  if (inFlightPipelines.has(modelId)) {
    return inFlightPipelines.get(modelId);
  }

  const creationPromise = (async () => {
    try {
      const { pipeline } = await loadTransformersLibrary();
      const fileBytesMap = new Map();
      const filePercentFallbackMap = new Map();
      let lastReportedPercent = -1;

      const translator = await pipeline("translation", modelId, {
        quantized: true,
        dtype: "q8",
        progress_callback: (event) => {
          if (!event) {
            return;
          }

          const ctx = downloadContext;

          if (event.status === "initiate" || event.status === "download") {
            if (lastReportedPercent < 1) {
              lastReportedPercent = 1;
              self.postMessage({
                type: "OFFLINE_PROGRESS",
                requestId: ctx.requestId,
                progress: 1,
                modelId: ctx.modelId,
                sourceLanguage: ctx.src,
                targetLanguage: ctx.tgt,
                languagePair: ctx.languagePair,
                sizeDetail: ""
              });
            }
            return;
          }

          if (event.status === "progress") {
            const fileKey = event.file || "default";

            if (typeof event.loaded === "number" && typeof event.total === "number" && event.total > 0) {
              fileBytesMap.set(fileKey, {
                loaded: event.loaded,
                total: event.total
              });
            } else if (typeof event.progress === "number") {
              filePercentFallbackMap.set(fileKey, event.progress);
            }

            let totalLoaded = 0;
            let totalSize = 0;
            for (const entry of fileBytesMap.values()) {
              totalLoaded += entry.loaded;
              totalSize += entry.total;
            }

            let computedPercent = 1;
            let sizeDetail = "";

            if (totalSize > 0) {
              computedPercent = Math.min(99, Math.max(1, Math.round((totalLoaded / totalSize) * 100)));
              if (totalSize > 1024 * 1024) {
                sizeDetail = ` (${formatMegabytes(totalLoaded)} / ${formatMegabytes(totalSize)})`;
              }
            } else if (filePercentFallbackMap.size > 0) {
              let sum = 0;
              for (const val of filePercentFallbackMap.values()) {
                sum += val;
              }
              computedPercent = Math.min(99, Math.max(1, Math.round(sum / filePercentFallbackMap.size)));
            }

            if (computedPercent !== lastReportedPercent || sizeDetail) {
              lastReportedPercent = computedPercent;
              self.postMessage({
                type: "OFFLINE_PROGRESS",
                requestId: ctx.requestId,
                progress: computedPercent,
                modelId: ctx.modelId,
                sourceLanguage: ctx.src,
                targetLanguage: ctx.tgt,
                languagePair: ctx.languagePair,
                sizeDetail
              });
            }
            return;
          }

          if (event.status === "ready") {
            self.postMessage({
              type: "OFFLINE_PROGRESS",
              requestId: ctx.requestId,
              progress: 100,
              modelId: ctx.modelId,
              sourceLanguage: ctx.src,
              targetLanguage: ctx.tgt,
              languagePair: ctx.languagePair,
              sizeDetail: ""
            });
          }
        }
      });

      loadedPipelines.set(modelId, translator);
      return translator;
    } finally {
      inFlightPipelines.delete(modelId);
    }
  })();

  inFlightPipelines.set(modelId, creationPromise);
  return creationPromise;
}

async function runSinglePairTranslation(text, src, tgt, requestId, usedModels) {
  const { modelId, prefix } = resolveModelSpecForPair(src, tgt);
  usedModels.push({ modelId, src, tgt });
  const translator = await getOrCreateTranslationPipeline(modelId, requestId, src, tgt);
  const inputWithPrefix = `${prefix}${text}`;
  const output = await translator(inputWithPrefix);
  const firstResult = Array.isArray(output) ? output[0] : output;
  return typeof firstResult?.translation_text === "string"
    ? firstResult.translation_text.trim()
    : "";
}

self.addEventListener("message", async (event) => {
  const data = event.data;
  if (!data || data.type !== "TRANSLATE_OFFLINE") {
    return;
  }

  const { requestId, text, sourceLanguage, targetLanguage } = data;
  const src = normalizeIsoPairCode(sourceLanguage);
  const tgt = normalizeIsoPairCode(targetLanguage);

  if (src === tgt) {
    self.postMessage({
      type: "OFFLINE_RESULT",
      requestId,
      ok: true,
      translatedText: text,
      detectedSourceLanguage: src,
      usedModels: []
    });
    return;
  }

  try {
    let translatedText = "";
    const usedModels = [];

    if (src !== "en" && tgt !== "en" && (ROMANCE_LANGS.has(src) || ROMANCE_LANGS.has(tgt))) {
      const englishIntermediate = await runSinglePairTranslation(text, src, "en", requestId, usedModels);
      translatedText = await runSinglePairTranslation(englishIntermediate, "en", tgt, requestId, usedModels);
    } else {
      translatedText = await runSinglePairTranslation(text, src, tgt, requestId, usedModels);
    }

    if (!translatedText) {
      throw new Error("Empty offline translation output");
    }

    self.postMessage({
      type: "OFFLINE_RESULT",
      requestId,
      ok: true,
      translatedText,
      detectedSourceLanguage: src,
      usedModels
    });
  } catch (_err) {
    self.postMessage({
      type: "OFFLINE_ERROR",
      requestId,
      ok: false,
      errorMessage:
        "Não foi possível carregar o pacote offline para este par de idiomas. Confira sua conexão no primeiro download ou escolha outra fonte gratuita."
    });
  }
});
