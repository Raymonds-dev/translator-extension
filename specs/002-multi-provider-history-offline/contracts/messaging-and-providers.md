# Contracts: Mensageria Interna e Provedores de Tradução

**Feature**: `002-multi-provider-history-offline`
**Date**: 2026-11-08

## 1. Contratos de Mensagens Internas (`browser.runtime.sendMessage`)

### 1.1 `GET_SESSION_BOOTSTRAP` (Atualizado)
Retorna as preferências iniciais, o provedor ativo, o histórico de traduções e a posição salva do modal.

**Response**:
```json
{
  "provider": "lingva",
  "hasApiKey": false,
  "baseLanguage": "pt",
  "lastSecondaryLanguage": "en",
  "shortcut": "Alt+T",
  "sidebarShortcut": "Alt+Shift+T",
  "showSelectionIcon": true,
  "theme": "dark",
  "modalOpacity": 0.88,
  "modalPosition": {
    "isCustom": false,
    "x": null,
    "y": null
  },
  "history": []
}
```

### 1.2 `TRANSLATE_TEXT` (Atualizado)
Executa a tradução usando a fonte ativa (ou uma fonte específica passada opcionalmente) e registra automaticamente o resultado no histórico de até 20 itens.

**Request**:
```json
{
  "type": "TRANSLATE_TEXT",
  "payload": {
    "text": "Hello world",
    "sourceLanguage": "auto",
    "targetLanguage": "pt",
    "allowAutoRedirect": true
  }
}
```

**Response (Sucesso)**:
```json
{
  "ok": true,
  "status": "SUCCESS",
  "data": {
    "translatedText": "Olá mundo",
    "detectedSourceLanguage": "en",
    "effectiveTargetLanguage": "pt",
    "provider": "lingva",
    "autoRedirected": false,
    "history": [
      {
        "id": "hist_1731030000_a1b2",
        "sourceText": "Hello world",
        "translatedText": "Olá mundo",
        "sourceLanguage": "en",
        "targetLanguage": "pt",
        "provider": "lingva",
        "createdAt": 1731030000000
      }
    ]
  }
}
```

**Response (Limite/Indisponibilidade de Fonte com Ação de Troca Rápida)**:
```json
{
  "ok": false,
  "status": "PROVIDER_LIMIT_ERROR",
  "provider": "mymemory",
  "errorMessage": "O limite gratuito diário do MyMemory foi atingido. Você pode trocar para outra fonte gratuita com um clique."
}
```

### 1.3 `GET_TRANSLATION_HISTORY` & `CLEAR_TRANSLATION_HISTORY`
Permite consultar ou limpar as 20 traduções salvas a partir do Pop-up, Painel Lateral ou Modal.

**Request (Limpar)**:
```json
{
  "type": "CLEAR_TRANSLATION_HISTORY"
}
```

**Response**:
```json
{
  "ok": true,
  "history": []
}
```

### 1.4 `QUICK_SWITCH_PROVIDER`
Permite alternar rapidamente para outra fonte gratuita (ex.: de `mymemory` para `lingva`) diretamente pelo botão de ação do banner de erro ou pelo seletor.

**Request**:
```json
{
  "type": "QUICK_SWITCH_PROVIDER",
  "payload": {
    "provider": "lingva"
  }
}
```

### 1.5 `OFFLINE_DOWNLOAD_PROGRESS` (Broadcast de Progresso)
Enviado em tempo real pelo Background (a partir do Web Worker) para atualizar a barra de progresso no Pop-up, Painel Lateral, Modal na página e Opções.

**Message**:
```json
{
  "type": "OFFLINE_DOWNLOAD_PROGRESS",
  "payload": {
    "status": "downloading",
    "progress": 45,
    "message": "Baixando pacote de tradução: 45%...",
    "languagePair": "en-pt"
  }
}
```

---

## 2. Contratos das Fontes de Tradução Externas e Locais

### 2.1 Lingva Translate (`lingva`)
- **Método**: `GET {mirrorUrl}/api/v1/{source}/{target}/{encodeURIComponent(text)}`
- **Espelhos**: `https://lingva.ml`, `https://translate.plausibility.cloud`, `https://lingva.lunar.icu`
- **Resposta esperada**: `{ "translation": "...", "info": { "detectedSource": "en" } }`

### 2.2 MyMemory Translation API (`mymemory`)
- **Método**: `GET https://api.mymemory.translated.net/get?q={encodeURIComponent(text)}&langpair={resolvedSource}|{target}`
- **Resposta esperada**: `{ "responseStatus": 200, "responseData": { "translatedText": "...", "match": 1 } }`

### 2.3 LibreTranslate (`libretranslate`)
- **Método**: `POST {serverUrl}/translate`
- **Body**: `{ "q": text, "source": sourceLanguage, "target": targetLanguage, "format": "text", "api_key": optionalKey }`
- **Resposta esperada**: `{ "translatedText": "...", "detectedLanguage": { "language": "en" } }`

### 2.4 Google Cloud Translation v2 (`google`)
- **Método**: `POST https://translation.googleapis.com/language/translate/v2?key={apiKey}`
- **Body**: `{ "q": text, "target": targetLanguage, "format": "text", "source": optionalSource }`

### 2.5 Motor Offline (`offline` — Web Worker `src/background/offline-worker.js`)
- **Comunicação Worker ↔ Background**: `postMessage({ type: "TRANSLATE_OFFLINE", requestId, text, sourceLanguage, targetLanguage })`
- **Eventos do Worker**:
  - `PROGRESS`: `{ type: "OFFLINE_PROGRESS", requestId, progress: 0..100, message: "Baixando pacote de tradução: X%..." }`
  - `RESULT`: `{ type: "OFFLINE_RESULT", requestId, ok: true, translatedText, detectedSourceLanguage }`
  - `ERROR`: `{ type: "OFFLINE_ERROR", requestId, ok: false, errorMessage }`
