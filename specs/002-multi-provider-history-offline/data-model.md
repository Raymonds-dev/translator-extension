# Data Model: Fontes de Tradução Gratuitas, Modo Offline, Histórico e Modal Arrastável

**Feature**: `002-multi-provider-history-offline`
**Date**: 2026-11-08

## 1. Entidades Persistentes (`browser.storage.local`)

### 1.1 `UserPreferences` (Expandida)
Armazena todas as preferências do usuário, incluindo a fonte de tradução ativa, configurações de provedores e posição do modal.

| Campo | Tipo | Valor Padrão | Regras de Validação |
|-------|------|--------------|---------------------|
| `provider` | `string` (Enum `PROVIDERS`) | `"lingva"` (ou `"google"` se `apiKey` já existir) | Deve pertencer a `["lingva", "mymemory", "libretranslate", "google", "offline"]`. |
| `apiKey` | `string` | `""` | Obrigatório apenas quando `provider === "google"`. |
| `libreTranslateUrl` | `string` | `"https://translate.terraprint.co"` | URL HTTP/HTTPS válida usada como servidor preferencial do LibreTranslate. |
| `libreTranslateApiKey` | `string` | `""` | Chave opcional para instâncias LibreTranslate que exijam autenticação. |
| `baseLanguage` | `string` | `"pt"` | Código ISO 639-1 suportado em `SUPPORTED_LANGUAGES`. |
| `lastSecondaryLanguage` | `string` | `"en"` | Código ISO 639-1 diferente de `baseLanguage`. |
| `shortcut` | `string` | `"Alt+T"` | Atalho do modal centralizado. |
| `sidebarShortcut` | `string` | `"Alt+Shift+T"` | Atalho do painel lateral nativo. |
| `showSelectionIcon` | `boolean` | `true` | Define se o botão flutuante aparece ao selecionar texto na página. |
| `theme` | `string` | `"dark"` | `"dark"` ou `"light"`. |
| `modalOpacity` | `number` | `0.88` | Número decimal limitado ao intervalo `[0.65, 1.0]`. |
| `modalPosition` | `ModalPositionPreference` | `{ isCustom: false, x: null, y: null }` | Objeto contendo coordenadas salvas do modal na página. |
| `translationHistory` | `TranslationHistoryEntry[]` | `[]` | Lista ordenada da tradução mais recente para a mais antiga, máximo de 20 itens. |

---

### 1.2 `TranslationHistoryEntry` (Item do Histórico)
Representa uma consulta de tradução realizada com sucesso.

| Campo | Tipo | Descrição / Validação |
|-------|------|-----------------------|
| `id` | `string` | Identificador único gerado no momento do registro (ex.: `hist_<timestamp>_<random>`). |
| `sourceText` | `string` | Texto original traduzido (1 a 2.000 caracteres, sem espaços vazios nas pontas). |
| `translatedText` | `string` | Resultado da tradução retornado pelo provedor. |
| `sourceLanguage` | `string` | Código ISO 639-1 do idioma de origem efetivo/detectado (ex.: `"en"`). |
| `targetLanguage` | `string` | Código ISO 639-1 do idioma de destino efetivo (ex.: `"pt"`). |
| `provider` | `string` | Identificador da fonte que realizou a tradução (`"lingva"`, `"mymemory"`, etc.). |
| `createdAt` | `number` | Timestamp Unix em milissegundos (`Date.now()`). |

**Regras de Transição do Histórico**:
1. **Inserção / Atualização no Topo**: Ao concluir uma tradução válida, verifica-se o primeiro elemento (`history[0]`). Se `history[0]` tiver o mesmo `targetLanguage` e o mesmo `sourceText` (ou for uma continuação imediata da mesma digitação dentro da janela de edição), atualiza-se `history[0]` em vez de duplicar. Caso contrário, insere-se no início (`unshift`).
2. **Limite de Capacidade**: Se `history.length > 20` (`LIMITS.MAX_HISTORY_ITEMS`), os itens excedentes no final da lista são descartados (`slice(0, 20)`).
3. **Limpeza Total**: A ação de limpar histórico redefine `translationHistory` para `[]`.

---

### 1.3 `ModalPositionPreference` (Posição do Modal na Página)
Representa o estado de posicionamento do modal flutuante.

| Campo | Tipo | Descrição / Validação |
|-------|------|-----------------------|
| `isCustom` | `boolean` | `true` quando o usuário arrastou o modal para uma posição personalizada; `false` quando centralizado. |
| `x` | `number \| null` | Distância horizontal (`left` em pixels) relativa à janela visível quando `isCustom === true`. |
| `y` | `number \| null` | Distância vertical (`top` em pixels) relativa à janela visível quando `isCustom === true`. |

**Regras de Clamping (Restrição à Área da Tela)**:
- Ao aplicar `{ x, y }` na abertura do modal, durante o arraste ou no redimensionamento da janela:
  - `clampedX = Math.min(Math.max(x, VIEWPORT_MARGIN_PX), Math.max(VIEWPORT_MARGIN_PX, window.innerWidth - modalWidth - VIEWPORT_MARGIN_PX))`
  - `clampedY = Math.min(Math.max(y, VIEWPORT_MARGIN_PX), Math.max(VIEWPORT_MARGIN_PX, window.innerHeight - modalHeight - VIEWPORT_MARGIN_PX))`

---

## 2. Entidades de Catálogo e Estado em Tempo de Execução

### 2.1 `TranslationProviderMetadata` (`src/shared/providers.js`)
Define as propriedades visuais e funcionais de cada uma das 5 fontes de tradução:

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `id` | `string` | `"lingva" \| "mymemory" \| "libretranslate" \| "google" \| "offline"` |
| `name` | `string` | Nome amigável da fonte (ex.: `"Lingva Translate"`). |
| `badgeFallback` | `string` | Iniciais/texto curto para fallback caso a logo não carregue (ex.: `"LV"`, `"MM"`, `"LT"`, `"GT"`, `"IA"`). |
| `accentColor` | `string` | Cor temática da fonte no seletor animado. |
| `logoSvg` | `string` | Caminho/SVG da logo da fonte. |
| `tagline` | `string` | Resumo curto (ex.: `"Gratuito · Sem chave · Qualidade Google"`). |
| `description` | `string` | Explicação clara e sem jargões técnicos sobre como a fonte funciona. |
| `limitations` | `string[]` | Lista de limitações claras exibidas em destaque para o usuário. |
| `requiresApiKey` | `boolean` | Indica se exige chave obrigatória (`true` apenas para `"google"`). |

### 2.2 `OfflineDownloadProgressPayload`
Transmitido do Web Worker para o Background e para as interfaces abertas durante o download de modelos locais:

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `provider` | `"offline"` | Identificador fixo do modo offline. |
| `status` | `"downloading" \| "ready" \| "error"` | Estado atual do pacote de idioma. |
| `progress` | `number` | Percentual inteiro de `0` a `100`. |
| `message` | `string` | Texto formatado para exibição: `"Baixando pacote de tradução: 45%..."`. |
| `languagePair` | `string` | Par de idiomas do pacote (ex.: `"en-pt"`). |
