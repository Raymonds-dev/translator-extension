(function initProviders(globalScope) {
  "use strict";

  const namespace = globalScope.TranslatorExt || {};
  const { PROVIDERS } = namespace.CONSTANTS;

  const LIBRETRANSLATE_MIRRORS = Object.freeze(["https://translate.terraprint.co", "https://libretranslate.de", "https://translate.argosopentech.com"]);

  const PROVIDER_CATALOG = Object.freeze([
    Object.freeze({
      id: PROVIDERS.MYMEMORY,
      name: "MyMemory",
      shortName: "MyMemory",
      badgeFallback: "MM",
      accentColor: "#10B981",
      logoPath: "assets/providers/mymemory.svg",
      tagline: "Gratuito · Memória colaborativa · Sem chave",
      description: "Maior banco público de memórias de tradução do mundo (Translated.net), combinando traduções humanas revisadas com tradução automática.",
      limitations: Object.freeze(["Limite gratuito estrito de cerca de 5.000 caracteres por dia por endereço de IP", "Ao atingir a cota (ou sem conexão), o TraduzAí troca automaticamente para a Tradução Offline (IA no navegador)", "Frases muito coloquiais podem apresentar variações por mesclar memórias humanas de diferentes contextos"]),
      credits: Object.freeze({
        author: "Translated S.r.l.",
        officialUrl: "https://mymemory.translated.net",
        officialLabel: "Site Oficial MyMemory",
        repoUrl: "https://mymemory.translated.net/doc/spec.php",
        repoLabel: "Documentação da API",
      }),
      requiresApiKey: false,
      isFreeNoKey: true,
    }),
    Object.freeze({
      id: PROVIDERS.LIBRETRANSLATE,
      name: "LibreTranslate",
      shortName: "LibreTranslate",
      badgeFallback: "LT",
      accentColor: "#6366F1",
      logoPath: "assets/providers/libretranslate.svg",
      tagline: "Open Source · Suporta servidor próprio local",
      description: "Motor de tradução 100% livre e de código aberto baseado no Argos Translate. Pode usar espelhos públicos ou rodar como um mini-servidor na sua própria máquina.",
      limitations: Object.freeze(["Espelhos públicos gratuitos possuem limite de requisições por minuto ou podem exigir chave em horários de pico", "Quando rodado localmente na máquina (localhost:5000), não possui limites, mas exige ter o servidor iniciado no computador"]),
      credits: Object.freeze({
        author: "LibreTranslate / Argos Open Tech",
        officialUrl: "https://libretranslate.com",
        officialLabel: "Site Oficial LibreTranslate",
        repoUrl: "https://github.com/LibreTranslate/LibreTranslate",
        repoLabel: "GitHub & Download Local (AGPL-3.0)",
      }),
      requiresApiKey: false,
      isFreeNoKey: true,
    }),
    Object.freeze({
      id: PROVIDERS.OFFLINE,
      name: "Tradução Offline (IA no Navegador)",
      shortName: "Offline (IA)",
      badgeFallback: "IA",
      accentColor: "#F59E0B",
      logoPath: "assets/providers/offline.svg",
      tagline: "Open Source · 100% Privado · Hugging Face + OPUS-MT",
      description: "Executa modelos neurais abertos (MarianMT / OPUS-MT) via WebAssembly diretamente dentro do navegador. Nenhum texto sai do seu computador.",
      limitations: Object.freeze(["Exige download inicial de ~45 MB a 75 MB no primeiro uso de cada par de idiomas", "Consome entre 180 MB e 400 MB de memória RAM enquanto o motor estiver ativo na sessão", "Suporta os idiomas principais: Português, Inglês, Espanhol, Francês, Italiano e Alemão"]),
      credits: Object.freeze({
        author: "Hugging Face (Transformers.js) & Helsinki-NLP (OPUS-MT)",
        officialUrl: "https://huggingface.co/Xenova",
        officialLabel: "Modelos OPUS-MT na Hugging Face",
        repoUrl: "https://github.com/huggingface/transformers.js",
        repoLabel: "GitHub Transformers.js (Apache-2.0)",
      }),
      requiresApiKey: false,
      isFreeNoKey: true,
    }),
    Object.freeze({
      id: PROVIDERS.GOOGLE,
      name: "Google Cloud (Chave Pessoal)",
      shortName: "Google Cloud",
      badgeFallback: "GC",
      accentColor: "#3B82F6",
      logoPath: "assets/providers/google.svg",
      tagline: "API Oficial v2 · Requer chave Google Cloud",
      description: "Conecta diretamente à API oficial empresarial Google Cloud Translation v2 usando sua própria chave de acesso pessoal, sem limites de IP compartilhado.",
      limitations: Object.freeze(["Exige criar conta no Google Cloud Platform, ativar faturamento e gerar uma API Key", "Cota gratuita oficial limitada a 500.000 caracteres por mês (cobrado por uso acima disso)"]),
      credits: Object.freeze({
        author: "Google Cloud Platform",
        officialUrl: "https://cloud.google.com/translate/docs",
        officialLabel: "Documentação Cloud Translation",
        repoUrl: "https://console.cloud.google.com/apis/credentials",
        repoLabel: "Painel de Credenciais Google",
      }),
      requiresApiKey: true,
      isFreeNoKey: false,
    }),
  ]);

  const PROVIDER_BY_ID = new Map(PROVIDER_CATALOG.map((provider) => [provider.id, provider]));

  function isValidProviderId(providerId) {
    return typeof providerId === "string" && PROVIDER_BY_ID.has(providerId.trim().toLowerCase());
  }

  function normalizeProviderId(providerId, fallbackId = PROVIDERS.MYMEMORY) {
    if (!providerId || typeof providerId !== "string") {
      return fallbackId;
    }
    const cleaned = providerId.trim().toLowerCase();
    return PROVIDER_BY_ID.has(cleaned) ? cleaned : fallbackId;
  }

  function getProviderMetadata(providerId) {
    const normalized = normalizeProviderId(providerId);
    return PROVIDER_BY_ID.get(normalized) || PROVIDER_CATALOG[0];
  }

  function getNextFreeProviderId(currentProviderId) {
    const freeIds = [PROVIDERS.MYMEMORY, PROVIDERS.LIBRETRANSLATE, PROVIDERS.OFFLINE];
    const currentIndex = freeIds.indexOf(currentProviderId);
    if (currentIndex === -1) {
      return PROVIDERS.MYMEMORY;
    }
    return freeIds[(currentIndex + 1) % freeIds.length];
  }

  namespace.Providers = Object.freeze({
    PROVIDER_CATALOG,
    LIBRETRANSLATE_MIRRORS,
    isValidProviderId,
    normalizeProviderId,
    getProviderMetadata,
    getNextFreeProviderId,
  });

  globalScope.TranslatorExt = namespace;
})(typeof globalThis !== "undefined" ? globalThis : window);
