# Phase 0 Research: Fontes de Tradução Gratuitas, Modo Offline, Histórico e Modal Arrastável

**Feature**: `002-multi-provider-history-offline`
**Date**: 2026-11-08

## 1. Integração de Fontes de Tradução Gratuitas e Fallback de Espelhos

### Decision
Implementar um roteador de provedores em `src/background/api-client.js` apoiado pelo catálogo declarativo `src/shared/providers.js`, suportando 5 fontes (`lingva`, `mymemory`, `libretranslate`, `google`, `offline`), com **Lingva Translate** (`lingva`) como padrão inicial para instalações sem chave do Google.

### Rationale
- **Lingva Translate**: Oferece traduções com a mesma qualidade do Google Tradutor via REST simples (`GET /api/v1/{source}/{target}/{query}`) sem exigir chave de API ou cadastro. Como instâncias públicas comunitárias podem oscilar, o cliente percorrerá automaticamente uma lista de instâncias espelho confiáveis (`https://lingva.ml`, `https://translate.plausibility.cloud`, `https://lingva.lunar.icu`) antes de reportar indisponibilidade.
- **MyMemory Translation API**: API REST pública e gratuita (`GET https://api.mymemory.translated.net/get?q={text}&langpair={source}|{target}`). Como a API pública do MyMemory não aceita `auto` no parâmetro `langpair`, quando o idioma de origem estiver em modo automático (`auto`), o cliente determinará o idioma de origem por heurística/detecção leve (comparando com o Idioma Mãe e idioma secundário) antes de montar o par `source|target`.
- **LibreTranslate**: Motor open-source (`POST {serverUrl}/translate`). Utiliza lista de espelhos públicos com opção de o usuário informar URL própria ou chave opcional nas Opções.
- **Compatibilidade com usuários atuais**: Se `storage.local` já contiver uma `apiKey` do Google salva e nenhuma preferência explícita de `provider`, a extensão mantém `"google"` selecionado para não alterar o comportamento de quem já configurou sua chave.

### Alternatives Considered
- **Troca silenciosa entre provedores diferentes (ex.: Lingva → MyMemory)**: Rejeitada durante a fase `/speckit-clarify` (Questão 3) em favor de tentar apenas espelhos da mesma fonte e, caso todos falhem, exibir o aviso da limitação com um botão de troca rápida para que o usuário mantenha controle sobre qual serviço processa seu texto.

---

## 2. Tradução Offline com Transformers.js (`@huggingface/transformers`), Web Worker e CSP para WebAssembly

### Decision
Executar a biblioteca oficial da Hugging Face **`@huggingface/transformers`** (anteriormente chamada `@xenova/transformers`) dentro de um **Web Worker dedicado** (`src/background/offline-worker.js`) gerenciado pelo script de background, utilizando modelos compactos quantizados em ONNX hospedados no Hugging Face Hub (`Xenova/opus-mt-*`) e declarando `'wasm-unsafe-eval'` na `content_security_policy` do `manifest.json`.

### Rationale
- **Isolamento em Web Worker**: A inferência neural e a compilação de WebAssembly (ONNX Runtime) consomem CPU intensa e ~200 MB a 500 MB de RAM. Rodar no thread principal travaria o Pop-up ou a página. No Web Worker, a interface permanece a 60fps.
- **Modelos Compactos (40 MB – 80 MB)**: Modelos quantizados da família MarianMT/Opus-MT (`Xenova/opus-mt-en-ROMANCE`, `Xenova/opus-mt-ROMANCE-en`, `Xenova/opus-mt-tc-big-*`) possuem entre 40 MB e 75 MB, são armazenados automaticamente na Cache API / IndexedDB do navegador após o primeiro download e traduzem frases curtas em menos de 1 segundo.
- **Barra de Progresso em Tempo Real**: O `progress_callback` do `pipeline('translation', modelName, { quantized: true, progress_callback })` emite eventos de download com percentual (`progress`). O Worker envia mensagens para o background, que retransmite `OFFLINE_DOWNLOAD_PROGRESS` para o Pop-up, Painel Lateral, Modal ou Opções abertos, atualizando a barra `"Baixando pacote de tradução: X%..."`.
- **CSP no Manifesto**: No Firefox/Gecko WebExtensions (MV2), o ONNX Runtime WebAssembly exige `'wasm-unsafe-eval'` em `content_security_policy` para instanciar módulos `.wasm`.

### Alternatives Considered
- **Executar Transformers.js diretamente no Content Script da página**: Rejeitado porque violaria o CSP das páginas visitadas, baixaria os modelos repetidamente por domínio (40–80 MB por site) e degradaria a memória das abas do usuário.

---

## 3. Histórico de Traduções Compartilhado (Até 20 Itens) e Fluxo de Edição via Lápis

### Decision
Persistir o histórico em `browser.storage.local` sob a chave `translationHistory` (limitado a `LIMITS.MAX_HISTORY_ITEMS = 20`), expondo uma visão/aba de **Histórico** uniforme no Pop-up, no Painel Lateral e no Modal da página.

### Rationale
- **Desduplicação Inteligente**: Como a tradução ocorre com *debounce* (500ms) durante a digitação livre, registrar cada pausa parcial criaria várias entradas quase iguais. Ao concluir uma tradução, se o item mais recente no topo do histórico compartilhar o mesmo idioma de destino e for prefixo/igual ao texto atual (dentro da mesma sessão de digitação) ou idêntico, o item do topo é atualizado no lugar; caso contrário, é inserido no topo e a lista é truncada em 20 itens.
- **Ação do Ícone de Lápis (Inversão de Par)**: Conforme definido no `/speckit-clarify` (Questão 2), clicar no lápis em um item do histórico alterna para a aba de texto livre, preenche o campo de entrada com `item.translatedText`, define `sourceLanguage = item.targetLanguage` e `targetLanguage = item.sourceLanguage`, e foca o campo para edição imediata.

### Alternatives Considered
- **Armazenar histórico apenas em memória**: Rejeitado porque o usuário perderia as consultas ao fechar o navegador ou alternar entre o Modal da página e o Painel Lateral.

---

## 4. Modal da Página Arrastável com Posição Persistente e Clamping de Viewport

### Decision
Tornar o cabeçalho (`.brand-bar`) do modal no Shadow DOM (`src/content/translator-widget.js`) uma alça de arraste com restrição geométrica (*clamping*) em tempo real aos limites de `window.innerWidth` e `window.innerHeight`, salvando `{ x, y, isCustom: true }` em `browser.storage.local` (`modalPosition`).

### Rationale
- **Performance (60fps)**: Atualizar `left` e `top` diretamente em pixels durante o arraste (com `transform: none`) evita recálculos de layout complexos.
- **Segurança de Tela (Viewport Clamping)**: Sempre que o modal é arrastado, aberto ou quando a janela sofre `resize`, uma função pura `clampModalCoordinates(x, y, modalWidth, modalHeight, viewportWidth, viewportHeight, margin)` garante que `margin <= x <= viewportWidth - modalWidth - margin` e `margin <= y <= viewportHeight - modalHeight - margin`.
- **Reset para o Centro**: Um botão **"Centralizar"** no cabeçalho do modal limpa `modalPosition` (`{ isCustom: false, x: null, y: null }`) e reaplica o posicionamento centralizado padrão.

---

## 5. Seletor Personalizado e Animado de Fontes com Logos e Fallback

### Decision
Construir na página de Opções (`src/options/`) um seletor visual interativo em formato de cartões animados (*Interactive Provider Deck*) com ícones SVG dedicados para cada fonte e fallback automático para emblema tipográfico (`data-fallback-initials`), além de um atalho de troca rápida nos banners de erro das interfaces de tradução.

### Rationale
- **Zero-Manual UX**: O usuário bate o olho nos cartões das fontes e enxerga imediatamente o logotipo, se é gratuita/sem chave, a velocidade esperada e as etiquetas de limitação (como `"Download inicial: 40–80 MB"` e `"Memória: 200–500 MB"` no modo Offline, ou `"Limite diário por IP"` no MyMemory).
- **Resiliência Visual**: Cada logo possui tratamento de erro (`onerror`) e versão vetorial embutida/emblema com as iniciais e cor temática da fonte caso o ativo gráfico não esteja disponível.
