(function initProviders(globalScope) {
  "use strict";

  const namespace = globalScope.TranslatorExt || {};
  const { PROVIDERS } = namespace.CONSTANTS;

  const LINGVA_MIRRORS = Object.freeze(["https://lingva.ml", "https://translate.plausibility.cloud", "https://lingva.lunar.icu"]);

  const LIBRETRANSLATE_MIRRORS = Object.freeze(["https://translate.terraprint.co", "https://libretranslate.de", "https://translate.argosopentech.com"]);

  const PROVIDER_CATALOG = Object.freeze([
    Object.freeze({
      id: PROVIDERS.LINGVA,
      name: "Lingva Translate",
      badgeFallback: "LV",
      accentColor: "#0EA5E9",
      logoPath: "assets/providers/lingva.svg",
      tagline: "Gratuito · Sem cadastro · Qualidade Google",
      description: "Traduz gratuitamente com a mesma qualidade do Google Tradutor através de servidores comunitários abertos, sem precisar criar conta ou chave.",
      limitations: Object.freeze(["Depende de servidores públicos da comunidade, que podem oscilar em horários de pico", "Troca automática entre servidores espelho caso um esteja ocupado"]),
      requiresApiKey: false,
      isFreeNoKey: true,
    }),
    Object.freeze({
      id: PROVIDERS.MYMEMORY,
      name: "MyMemory",
      badgeFallback: "MM",
      accentColor: "#10B981",
      logoPath: "assets/providers/mymemory.svg",
      tagline: "Gratuito · Memória colaborativa · Sem chave",
      description: "Maior banco público de traduções colaborativas e automáticas do mundo. Funciona imediatamente sem chave de acesso.",
      limitations: Object.freeze(["Limite gratuito de cerca de 5.000 caracteres por dia por endereço de internet", "Textos muito longos ou gírias podem ter variações por combinar memórias humanas e automáticas"]),
      requiresApiKey: false,
      isFreeNoKey: true,
    }),
    Object.freeze({
      id: PROVIDERS.LIBRETRANSLATE,
      name: "LibreTranslate",
      badgeFallback: "LT",
      accentColor: "#6366F1",
      logoPath: "assets/providers/libretranslate.svg",
      tagline: "Código aberto · Servidor personalizável",
      description: "Motor de tradução livre e de código aberto. Pode usar servidores públicos gratuitos ou um endereço próprio configurado abaixo.",
      limitations: Object.freeze(["Servidores públicos gratuitos possuem limite de velocidade por minuto", "Alguns servidores públicos podem pedir uma chave opcional em horários de alta demanda", "Traduções um pouco mais literais que o Google em frases complexas"]),
      requiresApiKey: false,
      isFreeNoKey: true,
    }),
    Object.freeze({
      id: PROVIDERS.OFFLINE,
      name: "Tradução Offline (IA no Navegador)",
      badgeFallback: "IA",
      accentColor: "#F59E0B",
      logoPath: "assets/providers/offline.svg",
      tagline: "100% Privado · Sem internet após baixar · Hugging Face",
      description: "Executa um modelo de Inteligência Artificial da Hugging Face diretamente dentro do seu navegador em segundo plano. Nenhum texto sai do seu computador.",
      limitations: Object.freeze(["Download inicial de 40 MB a 80 MB no primeiro uso de cada par de idiomas (com barra de progresso)", "Consumo elevado de memória RAM (cerca de 200 MB a 500 MB enquanto estiver carregado)", "Suporta os idiomas principais mais usados (Português, Inglês, Espanhol, Francês, Italiano e Alemão)"]),
      requiresApiKey: false,
      isFreeNoKey: true,
    }),
    Object.freeze({
      id: PROVIDERS.GOOGLE,
      name: "Google Tradutor (Chave Pessoal)",
      badgeFallback: "GT",
      accentColor: "#2563EB",
      logoPath: "assets/providers/google.svg",
      tagline: "Máxima velocidade · Requer chave Google Cloud",
      description: "Conecta diretamente ao serviço oficial do Google Cloud usando sua própria chave de acesso pessoal, sem intermediários.",
      limitations: Object.freeze(["Exige criar conta no Google Cloud e configurar uma chave de acesso pessoal", "Sujeito às cotas da sua conta no Google Cloud", "Há um limite de 500.000 caracteres traduzidos por mês na opção gratuita"]),
      requiresApiKey: true,
      isFreeNoKey: false,
    }),
  ]);

  const PROVIDER_BY_ID = new Map(PROVIDER_CATALOG.map((provider) => [provider.id, provider]));

  function isValidProviderId(providerId) {
    return typeof providerId === "string" && PROVIDER_BY_ID.has(providerId.trim().toLowerCase());
  }

  function normalizeProviderId(providerId, fallbackId = PROVIDERS.LINGVA) {
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
    const freeIds = [PROVIDERS.LINGVA, PROVIDERS.MYMEMORY, PROVIDERS.LIBRETRANSLATE];
    const currentIndex = freeIds.indexOf(currentProviderId);
    if (currentIndex === -1) {
      return PROVIDERS.LINGVA;
    }
    return freeIds[(currentIndex + 1) % freeIds.length];
  }

  namespace.Providers = Object.freeze({
    PROVIDER_CATALOG,
    LINGVA_MIRRORS,
    LIBRETRANSLATE_MIRRORS,
    isValidProviderId,
    normalizeProviderId,
    getProviderMetadata,
    getNextFreeProviderId,
  });

  globalScope.TranslatorExt = namespace;
})(typeof globalThis !== "undefined" ? globalThis : window);
