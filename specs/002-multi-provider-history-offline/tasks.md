---

description: "Task list for feature implementation 002-multi-provider-history-offline"
---

# Tasks: Fontes de Tradução Gratuitas, Modo Offline, Histórico e Modal Arrastável

**Input**: Design documents from `/specs/002-multi-provider-history-offline/`

**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/messaging-and-providers.md

**Tests**: Validation scenarios are defined in `specs/002-multi-provider-history-offline/quickstart.md` and `tests/manual-test-page.html`.

**Organization**: Tasks are grouped by user story (`US1` to `US4`) to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (`[US1]`, `[US2]`, `[US3]`, `[US4]`)
- Exact file paths are included in all descriptions

---

## Phase 1: Setup (Shared Infrastructure & Assets)

**Purpose**: Preparação de permissões do manifesto e ativos visuais das 5 fontes de tradução.

- [X] T001 Atualizar `manifest.json` para a versão `2.0.0`, adicionando `content_security_policy` (`"script-src 'self' 'wasm-unsafe-eval' https://cdn.jsdelivr.net; object-src 'self'"`) e registrando `src/shared/providers.js` nos contextos `background` e `content_scripts` em `manifest.json`
- [X] T002 [P] Criar os logotipos vetoriais das 5 fontes de tradução em `assets/providers/lingva.svg`, `assets/providers/mymemory.svg`, `assets/providers/libretranslate.svg`, `assets/providers/google.svg` e `assets/providers/offline.svg`
- [X] T003 [P] Atualizar `src/popup/popup.html` e `src/options/options.html` para importar `<script src="../shared/providers.js"></script>` antes dos controladores principais

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Constantes compartilhadas, catálogo declarativo das fontes e camada de persistência (`UserPreferences`, `TranslationHistoryEntry`, `ModalPositionPreference`) em `browser.storage.local`.

**⚠️ CRITICAL**: Nenhuma User Story pode iniciar antes da conclusão desta fase.

- [X] T004 Atualizar `src/shared/constants.js` adicionando o enum `PROVIDERS` (`["lingva", "mymemory", "libretranslate", "google", "offline"]`), `LIMITS.MAX_HISTORY_ITEMS = 20`, novas chaves em `STORAGE_KEYS` (`PROVIDER`, `LIBRE_TRANSLATE_URL`, `LIBRE_TRANSLATE_API_KEY`, `MODAL_POSITION`, `TRANSLATION_HISTORY`), novos status em `SESSION_STATUS` (`PROVIDER_LIMIT_ERROR`, `OFFLINE_DOWNLOADING`) e novos tipos em `MESSAGE_TYPES` (`GET_TRANSLATION_HISTORY`, `CLEAR_TRANSLATION_HISTORY`, `QUICK_SWITCH_PROVIDER`, `OFFLINE_DOWNLOAD_PROGRESS`)
- [X] T005 [P] Criar `src/shared/providers.js` exportando `TranslatorExt.Providers` com metadados completos das 5 fontes (`id`, `name`, `badgeFallback` (`"LV"`, `"MM"`, `"LT"`, `"GT"`, `"IA"`), `accentColor`, `logoSvg`, `tagline`, `description`, `limitations[]`, `requiresApiKey`) e espelhos públicos para Lingva (`https://lingva.ml`, `https://translate.plausibility.cloud`, `https://lingva.lunar.icu`) e LibreTranslate (`https://translate.terraprint.co`, `https://libretranslate.de`, `https://translate.argosopentech.com`)
- [X] T006 [P] Adicionar heurística leve de detecção de idioma local (`detectLanguageLocally(text, baseLanguage, secondaryLanguage)`) em `src/shared/languages.js` para resolver `sourceLanguage === "auto"` quando a fonte ativa exigir par explícito (como `MyMemory` e `Offline`)
- [X] T007 Atualizar `src/shared/storage.js` para validar e persistir `provider` (padrão `"lingva"`, ou `"google"` se `apiKey` já existir), `libreTranslateUrl` (`"https://translate.terraprint.co"`), `libreTranslateApiKey` (`""`), `modalPosition` (`{ isCustom: false, x: null, y: null }`), e funções de histórico `getTranslationHistory()`, `recordTranslationHistoryEntry(entry)` (com desduplicação no topo e corte em `LIMITS.MAX_HISTORY_ITEMS` = `20`) e `clearTranslationHistory()`

**Checkpoint**: Fundação pronta — a implementação das User Stories pode começar.

---

## Phase 3: User Story 1 - Escolha de Fontes de Tradução Gratuitas com Seletor Animado (Priority: P1) 🎯 MVP

**Goal**: Permitir traduzir imediatamente usando **Lingva Translate**, **MyMemory**, **LibreTranslate** ou **Google Tradutor (Chave Pessoal)**, com um seletor personalizado e animado nas Opções exibindo logo (com fallback de iniciais), descrição simples e limitações de cada fonte, além de fallback de espelhos e botão de troca rápida.

**Independent Test**: Abrir as Opções, interagir com o seletor animado das 5 fontes, conferir logo/fallback, descrição e etiquetas de limitação, selecionar Lingva ou MyMemory sem chave cadastrada e traduzir imediatamente no Pop-up, Painel Lateral ou Modal.

### Implementation for User Story 1

- [X] T008 [US1] Expandir `src/background/api-client.js` implementando os adaptadores `requestLingvaTranslation` (com fallback automático pelos espelhos de `lingva`), `requestMyMemoryTranslation` (resolvendo `langpair={source}|{target}`), `requestLibreTranslateTranslation` (com fallback pelos espelhos e URL/chave configuráveis) e o roteador unificado `requestTranslationByProvider(options)`
- [X] T009 [US1] Atualizar `src/background/background.js` para rotear `TRANSLATE_TEXT` pelo `provider` ativo em `UserPreferences`, dispensar `apiKey` quando `provider !== "google"`, responder a `QUICK_SWITCH_PROVIDER` e incluir `provider` no retorno de `GET_SESSION_BOOTSTRAP`
- [X] T010 [P] [US1] Atualizar `src/options/options.html` substituindo a seção fixa do Google pela seção **"1. Fonte de Tradução"** com o seletor personalizado animado, painel de detalhes/limitações da fonte selecionada e campos condicionais para chave do Google (`provider === "google"`) e servidor/chave opcional do LibreTranslate (`provider === "libretranslate"`)
- [X] T011 [P] [US1] Adicionar em `src/options/options.css` os estilos e animações do seletor personalizado de fontes (cartões interativos com transição `cubic-bezier(0.22, 1, 0.36, 1)`, brilho de seleção na cor temática da fonte, container de logo com emblema fallback `data-fallback` e pílulas visuais de limitações)
- [X] T012 [US1] Atualizar `src/options/options.js` para renderizar o seletor animado a partir de `TranslatorExt.Providers`, tratar fallback automático de logo para iniciais (`badgeFallback`), exibir/ocultar campos condicionais de cada fonte com animação e salvar a fonte escolhida imediatamente
- [X] T013 [US1] Atualizar `src/popup/popup.js` e `src/content/translator-widget.js` para tratar o status `PROVIDER_LIMIT_ERROR`, exibindo no banner de status a limitação atingida e o botão de troca rápida para outra fonte gratuita com 1 clique

**Checkpoint**: User Story 1 completa — o usuário já pode escolher fontes gratuitas no seletor animado e traduzir sem chave de API.

---

## Phase 4: User Story 2 - Histórico de Traduções Integrado com Reuso e Edição Rápida (Priority: P2)

**Goal**: Exibir um histórico das últimas 20 traduções no Pop-up, no Painel Lateral e no Modal da página, permitindo copiar novamente qualquer tradução (com aviso `"Copiado"`), enviá-la para edição na aba de texto livre invertendo o par de idiomas através do ícone de lápis, ou limpar todo o histórico.

**Independent Test**: Realizar traduções, abrir a aba Histórico no Pop-up, Painel Lateral e Modal, copiar um item, clicar no ícone de lápis para enviar a tradução para a caixa de texto livre com idiomas invertidos e clicar em "Limpar histórico".

### Implementation for User Story 2

- [X] T014 [US2] Atualizar `src/background/background.js` para registrar cada tradução concluída com sucesso em `recordTranslationHistoryEntry` (máximo de `20` itens com `id`, `sourceText`, `translatedText`, `sourceLanguage`, `targetLanguage`, `provider`, `createdAt`) e responder às mensagens `GET_TRANSLATION_HISTORY` e `CLEAR_TRANSLATION_HISTORY`
- [X] T015 [P] [US2] Atualizar `src/popup/popup.html` e `src/popup/popup.css` adicionando o botão/aba **Histórico** no cabeçalho e o painel `#historySection` contendo contador (`X / 20`), botão **Limpar histórico**, lista de cartões de tradução (com botões **Copiar** e **Editar com ícone de lápis**) e estado vazio amigável
- [X] T016 [US2] Atualizar `src/popup/popup.js` para alternar entre a visão de Tradução e a visão de Histórico, renderizar os até 20 itens, copiar tradução com feedback `"Copiado"`, limpar o histórico e, ao clicar no ícone de lápis, voltar para a visão de texto livre preenchendo `sourceInput` com `item.translatedText` e invertendo o par (`sourceLanguage = item.targetLanguage`, `targetLanguage = item.sourceLanguage`)
- [X] T017 [P] [US2] Atualizar `src/content/widget.css` e `src/content/widget-styles.js` adicionando os estilos da aba de Histórico, cartões de itens, botão de lápis, botão de copiar e cabeçalho de limpeza dentro do Shadow DOM do modal
- [X] T018 [US2] Atualizar `src/content/translator-widget.js` adicionando o botão de alternância **Histórico** no cabeçalho do modal centralizado, a renderização dos até 20 itens, a cópia com feedback visual, a limpeza do histórico e a ação do ícone de lápis que move a tradução para a caixa de entrada livre invertendo origem e destino
- [X] T019 [US2] Sincronizar atualizações de `STORAGE_KEYS.TRANSLATION_HISTORY` via `browser.storage.onChanged` em `src/popup/popup.js` e `src/content/translator-widget.js` para que o Painel Lateral, Pop-up e Modal reflitam o histórico em tempo real

**Checkpoint**: User Stories 1 e 2 completas — histórico de 20 itens funcional nas 3 interfaces com cópia, edição via lápis e limpeza.

---

## Phase 5: User Story 3 - Modal de Página Arrastável com Posição Persistente e Retorno ao Centro (Priority: P3)

**Goal**: Permitir arrastar o modal centralizado na página através de seu cabeçalho, restringindo-o a 100% da área visível da tela (*viewport clamping*), salvando a posição para as próximas aberturas e oferecendo um botão **Centralizar** para restaurar a posição padrão.

**Independent Test**: Abrir o modal (`Alt+T`), arrastá-lo para um canto tentando passar da borda da tela (verificando o bloqueio na margem visível), fechar e reabrir o modal (verificando que mantém a posição), e clicar em **Centralizar** (verificando que retorna ao centro).

### Implementation for User Story 3

- [X] T020 [P] [US3] Atualizar `src/content/widget.css` e `src/content/widget-styles.js` adicionando estilos de alça de arraste (`cursor: grab` / `cursor: grabbing`, `user-select: none`) em `.brand-bar`, estado `.modal-card.dragging` (sem transição de posição para resposta a 60fps) e estilo do botão **Centralizar** (`#resetPositionBtn`)
- [X] T021 [US3] Implementar em `src/content/translator-widget.js` a função pura `clampModalCoordinates(x, y, modalWidth, modalHeight)` respeitando `LIMITS.VIEWPORT_MARGIN_PX` (`16px`) e os handlers de arraste (`mousedown`, `mousemove`, `mouseup`) no cabeçalho do modal (ignorando cliques em botões de ação)
- [X] T022 [US3] Integrar em `src/content/translator-widget.js` o carregamento e salvamento de `STORAGE_KEYS.MODAL_POSITION` (`{ isCustom: boolean, x: number | null, y: number | null }`), o listener `window.addEventListener("resize")` para manter o modal sempre dentro da janela visível e a ação do botão **Centralizar** que restaura `{ isCustom: false, x: null, y: null }`
- [X] T023 [US3] Atualizar `handleGetSessionBootstrap` em `src/background/background.js` para incluir `modalPosition` no pacote inicial enviado ao modal

**Checkpoint**: User Stories 1, 2 e 3 completas — modal arrastável com limites de tela, posição persistente e botão Centralizar.

---

## Phase 6: User Story 4 - Tradução Offline no Navegador com Progresso de Download em Tempo Real (Priority: P4)

**Goal**: Permitir tradução 100% local usando `@huggingface/transformers` em um Web Worker dedicado, exibindo barra de carregamento em tempo real (`"Baixando pacote de tradução: X%..."`) durante o download inicial de 40–80 MB e avisos claros sobre consumo de memória RAM (200–500 MB).

**Independent Test**: Selecionar "Tradução Offline" nas Opções, conferir os avisos de download (40–80 MB) e RAM (200–500 MB), traduzir um texto no Pop-up ou Modal acompanhando a barra `"Baixando pacote de tradução: X%..."` sem travar a interface e verificar que a segunda tradução no mesmo par ocorre instantaneamente.

### Implementation for User Story 4

- [X] T024 [US4] Criar o Web Worker dedicado `src/background/offline-worker.js` importando `@huggingface/transformers`, mapeando pares de idiomas para modelos compactos quantizados ONNX (`Xenova/opus-mt-en-ROMANCE`, `Xenova/opus-mt-ROMANCE-en`, `Xenova/opus-mt-*`) e emitindo eventos de progresso (`"Baixando pacote de tradução: X%..."`) via `progress_callback`
- [X] T025 [US4] Implementar em `src/background/api-client.js` o gerenciador do Web Worker offline (`requestOfflineTranslation`), instanciando `src/background/offline-worker.js` sob demanda e retransmitindo o progresso por `browser.runtime.sendMessage({ type: MESSAGE_TYPES.OFFLINE_DOWNLOAD_PROGRESS, payload })`
- [X] T026 [P] [US4] Adicionar a barra visual de progresso de download offline (`#offlineProgressContainer`, `#offlineProgressBar`, `#offlineProgressText`) em `src/popup/popup.html`, `src/popup/popup.css`, `src/content/widget.css` e `src/content/widget-styles.js`
- [X] T027 [US4] Conectar o listener `MESSAGE_TYPES.OFFLINE_DOWNLOAD_PROGRESS` em `src/popup/popup.js` e `src/content/translator-widget.js` para exibir e atualizar em tempo real a barra `"Baixando pacote de tradução: X%..."` durante o download do pacote de idioma
- [X] T028 [US4] Destacar no cartão da opção Offline em `src/options/options.html` e `src/options/options.js` os avisos claros sobre o download inicial de 40 MB a 80 MB por idioma e o uso de 200 MB a 500 MB de memória RAM durante a execução

**Checkpoint**: Todas as 4 User Stories completas e integradas.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Atualização da página de boas-vindas, página de testes e verificação final de conformidade.

- [X] T029 [P] Atualizar `src/welcome/welcome.html` para mencionar as fontes gratuitas prontas para uso, o histórico de traduções e a possibilidade de mover o modal na tela
- [X] T030 [P] Atualizar `tests/manual-test-page.html` com instruções de teste para o seletor de fontes gratuitas, o histórico de 20 traduções (copiar/editar no lápis/limpar), o arraste do modal e o modo offline
- [X] T031 Validar todos os cenários do guia `specs/002-multi-provider-history-offline/quickstart.md` e a sintaxe de `manifest.json`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: Sem dependências — pode iniciar imediatamente.
- **Phase 2 (Foundational)**: Depende da Fase 1 — bloqueia todas as User Stories.
- **Phase 3 (US1 - Fontes Gratuitas e Seletor Animado)**: Depende da Fase 2.
- **Phase 4 (US2 - Histórico de 20 Traduções)**: Depende da Fase 2 (pode rodar em paralelo ou logo após US1).
- **Phase 5 (US3 - Modal Arrastável)**: Depende da Fase 2 (independente de US1/US2).
- **Phase 6 (US4 - Tradução Offline com Web Worker)**: Depende da Fase 2 e de `T008` (roteador de provedores em `src/background/api-client.js`).
- **Phase 7 (Polish)**: Depende da conclusão das Fases 3 a 6.

### Parallel Opportunities

- `T002` e `T003` podem ser executadas em paralelo na Fase 1.
- `T005` e `T006` podem ser executadas em paralelo na Fase 2.
- `T010` e `T011` (UI do seletor em Opções) podem rodar em paralelo com `T008` e `T009` (adaptadores de API no background).
- `T015` (Histórico no Pop-up/Sidebar) e `T017` (Estilos do Histórico no Modal) podem rodar em paralelo na Fase 4.
- `T020` (Estilos de arraste) e `T026` (Barra de progresso offline) atuam em seções independentes de estilo.

---

## Parallel Example: User Story 1

```bash
# Em paralelo (camada de background vs camada visual de Opções):
Task T008: "Expandir src/background/api-client.js implementando Lingva, MyMemory e LibreTranslate"
Task T010: "Atualizar src/options/options.html com o seletor personalizado animado"
Task T011: "Adicionar em src/options/options.css estilos e animações do seletor de fontes"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Concluir Fase 1 (Setup) e Fase 2 (Foundational).
2. Concluir Fase 3 (User Story 1 — Fontes Gratuitas + Seletor Animado).
3. **Validar**: Traduzir textos com Lingva e MyMemory sem chave de API e testar o seletor animado nas Opções.

### Incremental Delivery

1. **Setup + Foundational** → Constantes, catálogo de provedores e storage prontos.
2. **US1 (Fontes Gratuitas + Seletor Animado)** → Uso imediato sem chave ou cartão.
3. **US2 (Histórico de 20 Traduções)** → Reuso, cópia e edição via lápis no Pop-up, Painel Lateral e Modal.
4. **US3 (Modal Arrastável)** → Posicionamento livre na página com limites de tela e botão Centralizar.
5. **US4 (Modo Offline com Hugging Face Transformers.js)** → Tradução local em Web Worker com barra de progresso em tempo real.
