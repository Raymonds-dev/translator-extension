# Interface Contracts: Mensageria Interna e Integração de API

**Feature**: `001-contextual-quick-translator`
**Date**: 2026-11-07

## 1. Contratos de Mensagens WebExtensions (`browser.runtime.sendMessage` / `tabs.sendMessage`)

Toda comunicação entre *Content Scripts*, *Popup* e *Background Script* utiliza constantes definidas em `MESSAGE_TYPES` (`src/shared/constants.js`).

### 1.1 `GET_SESSION_BOOTSTRAP` (Content/Popup → Background)

Consulta o estado inicial necessário antes de abrir ou renderizar o modal (verifica se há chave configurada e qual o idioma base padrão, sem expor a chave de API em si para o *Content Script*).

- **Request**:
  ```json
  {
    "type": "GET_SESSION_BOOTSTRAP"
  }
  ```
- **Response**:
  ```json
  {
    "hasApiKey": true,
    "baseLanguage": "pt",
    "lastSecondaryLanguage": "en"
  }
  ```

### 1.2 `TRANSLATE_TEXT` (Content/Popup → Background)

Solicita a tradução de um texto aplicando *Guard Clauses* no Background Script (existência da chave, texto não vazio, limite de 2.000 caracteres) e redirecionamento automático caso o idioma detectado seja igual ao idioma base.

- **Request**:
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
- **Response (Sucesso)**:
  ```json
  {
    "ok": true,
    "status": "SUCCESS",
    "data": {
      "translatedText": "Olá Mundo",
      "detectedSourceLanguage": "en",
      "effectiveTargetLanguage": "pt",
      "autoRedirected": false
    }
  }
  ```
- **Response (Erro / Guard Clause)**:
  ```json
  {
    "ok": false,
    "status": "MISSING_API_KEY",
    "errorMessage": "Para traduzir, insira sua chave da API nas configurações da extensão"
  }
  ```
  *(Valores possíveis de `status` em falha: `MISSING_API_KEY`, `TEXT_TOO_LONG`, `INVALID_API_KEY`, `NETWORK_ERROR`)*

### 1.3 `OPEN_OPTIONS_PAGE` (Content/Popup → Background)

Acionado quando o usuário clica no botão para abrir as configurações a partir do aviso de chave ausente/inválida no modal. O Background executa `browser.runtime.openOptionsPage()`.

- **Request**:
  ```json
  {
    "type": "OPEN_OPTIONS_PAGE"
  }
  ```
- **Response**:
  ```json
  {
    "ok": true
  }
  ```

### 1.4 `TRIGGER_SHORTCUT_MODAL` (Background → Content Script da Aba Ativa)

Enviado pelo Background quando o comando de teclado (`Alt + T` / `translate-selection`) é acionado pelo usuário. O *Content Script* verifica se há seleção ativa na página: se houver, abre o modal traduzindo a seleção; se não houver, abre o modal em modo de digitação livre com foco no campo de entrada.

- **Message**:
  ```json
  {
    "type": "TRIGGER_SHORTCUT_MODAL"
  }
  ```

---

## 2. Contrato de Integração Externa: Google Cloud Translation API v2 (BYOK)

- **Endpoint**: `POST https://translation.googleapis.com/language/translate/v2?key={API_KEY}`
- **Headers**: `Content-Type: application/json; charset=utf-8`
- **Body**:
  ```json
  {
    "q": "Texto a ser traduzido",
    "target": "pt",
    "format": "text"
  }
  ```
  *(O campo `"source"` só é enviado quando `sourceLanguage !== "auto"`).*
- **Success Response (`200 OK`)**:
  ```json
  {
    "data": {
      "translations": [
        {
          "translatedText": "Texto traduzido",
          "detectedSourceLanguage": "en"
        }
      ]
    }
  }
  ```
- **Error Mapping**:
  - `HTTP 400 / 401 / 403`: Mapeado para `SESSION_STATUS.INVALID_API_KEY` (exibe aviso de chave inválida/sem permissão com botão para abrir Opções).
  - `Falha de rede / 5xx`: Mapeado para `SESSION_STATUS.NETWORK_ERROR` (exibe aviso amigável de falha de conexão com botão "Tentar novamente").
