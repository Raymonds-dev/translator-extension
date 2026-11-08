# Implementation Plan: Fontes de Tradução Gratuitas, Modo Offline, Histórico e Modal Arrastável

**Branch**: `002-multi-provider-history-offline` | **Date**: 2026-11-08 | **Spec**: [spec.md](file:///C:/Users/garam/.projetos/translator-extension/specs/002-multi-provider-history-offline/spec.md)

**Input**: Feature specification from `/specs/002-multi-provider-history-offline/spec.md`

## Summary

Expandir a extensão **Tradutor Rápido** com quatro grandes capacidades centradas na experiência do usuário:
1. **Múltiplas Fontes de Tradução Gratuitas (`lingva`, `mymemory`, `libretranslate`) + `google` + `offline`**, com **Lingva Translate** ativo por padrão e um seletor personalizado e animado nas Opções contendo logotipos (com fallback automático para emblema de iniciais), descrição acessível e avisos claros das limitações de cada opção.
2. **Tradução Offline no Navegador** usando `@huggingface/transformers` (Transformers.js oficial da Hugging Face) executado em um **Web Worker dedicado** (`src/background/offline-worker.js`), com permissão `content_security_policy` (`'wasm-unsafe-eval'`) no `manifest.json` e barra de progresso em tempo real (`"Baixando pacote de tradução: X%..."`) em todas as interfaces.
3. **Histórico de Traduções (até 20 itens)** sincronizado no Pop-up, Painel Lateral e Modal da página, permitindo copiar novamente qualquer tradução, enviá-la para edição na caixa de texto livre com inversão automática do par de idiomas através do ícone de lápis, ou limpar todo o histórico.
4. **Modal Centralizado Arrastável** com persistência de posição entre chamadas, restrição geométrica aos limites da tela (*viewport clamping*) e botão **Centralizar** para restaurar ao centro.

## Technical Context

**Language/Version**: HTML5, CSS3, Vanilla JavaScript (ES2022+) sem etapa de build/bundlers.

**Primary Dependencies**: WebExtensions API (`browser.*`), `@huggingface/transformers` (Transformers.js oficial da Hugging Face, carregado sob demanda dentro do Web Worker de tradução offline).

**Storage**: `browser.storage.local` (preferências do provedor, histórico de até 20 traduções e posição salva do modal) + Cache API nativa do navegador (para os pacotes de modelo ONNX/WASM do modo offline).

**Testing**: Página de validação interativa (`tests/manual-test-page.html`) e roteiro de verificação (`specs/002-multi-provider-history-offline/quickstart.md`).

**Target Platform**: Firefox / Zen Browser (Gecko WebExtensions MV2 com `sidebar_action`, `browser_action` e `content_security_policy` compatível com WebAssembly).

**Project Type**: Browser WebExtension (`manifest.json`).

**Performance Goals**: Arraste do modal a 60fps sem *layout thrashing*; zero bloqueio da thread principal durante download/inferência do modelo offline (isolado em Web Worker); resposta imediata ao alternar abas de Tradução e Histórico.

**Constraints**: Limite máximo de 20 itens no histórico; modal restrito a `100%` da área visível da tela com margem mínima de `16px`; aviso explícito de download (`40–80 MB`) e memória (`200–500 MB`) no modo offline.

**Scale/Scope**: 5 fontes de tradução, 3 superfícies de tradução/histórico (Pop-up, Painel Lateral e Modal Shadow DOM), 1 página de Opções com seletor animado e 1 Web Worker para IA local.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

1. **Prioridade no Motor Firefox (Firefox-First)**: **PASS** — Utiliza APIs `browser.*`, Web Worker padrão de extensão e `content_security_policy` compatível com Gecko para WebAssembly (`'wasm-unsafe-eval'`).
2. **Usabilidade, UX e Simplicidade Autoexplicativa (Zero-Manual UX)**: **PASS** — Funciona imediatamente após instalar graças ao Lingva como padrão gratuito; seletor animado explica limitações sem jargões técnicos; barra de progresso informa exatamente o percentual do download offline.
3. **Simplicidade de Código e Abstração Equilibrada (KISS & DRY Pragmático)**: **PASS** — Catálogo declarativo de provedores em `src/shared/providers.js` compartilhado entre Opções, Background e UIs; sem frameworks ou bundlers.
4. **Fluxo de Controle Defensivo e Separação de Conceitos**: **PASS** — Web Worker isolado para IA offline (`src/background/offline-worker.js`), adaptadores de API com *Guard Clauses* em `src/background/api-client.js` e manipulação de DOM restrita às camadas de UI.
5. **Código Autoexplicativo e Regra do Escoteiro**: **PASS** — Todas as constantes (`PROVIDERS`, `LIMITS.MAX_HISTORY_ITEMS = 20`, `MESSAGE_TYPES`) centralizadas em `src/shared/constants.js`.

## Project Structure

### Documentation (this feature)

```text
specs/002-multi-provider-history-offline/
├── plan.md              # Este plano de implementação
├── research.md          # Decisões arquiteturais (Fase 0)
├── data-model.md        # Entidades de dados e regras de validação (Fase 1)
├── quickstart.md        # Roteiro de validação passo a passo (Fase 1)
├── contracts/
│   └── messaging-and-providers.md # Contratos de mensageria e APIs (Fase 1)
└── tasks.md             # Lista de tarefas ordenadas (/speckit-tasks - Fase 2)
```

### Source Code (repository root)

```text
manifest.json
assets/
├── icons/
│   ├── icon-16.svg
│   ├── icon-48.svg
│   └── icon-128.svg
└── providers/
    ├── lingva.svg
    ├── mymemory.svg
    ├── libretranslate.svg
    ├── google.svg
    └── offline.svg
src/
├── shared/
│   ├── constants.js          # Enums PROVIDERS, LIMITS.MAX_HISTORY_ITEMS, MESSAGE_TYPES
│   ├── languages.js          # Idiomas suportados e heurística de detecção local
│   ├── providers.js          # NOVO: Metadados, logos, descrições e limitações das 5 fontes
│   └── storage.js            # Persistência de provedor, histórico (20 itens) e posição do modal
├── background/
│   ├── api-client.js         # Roteador multi-provedor (Lingva, MyMemory, LibreTranslate, Google, Offline)
│   ├── offline-worker.js     # NOVO: Web Worker isolado executando Transformers.js + progresso
│   └── background.js         # Orquestração de tradução, histórico e broadcast de progresso offline
├── content/
│   ├── widget.css            # Estilos do histórico, barra de progresso, arraste e botão Centralizar
│   ├── widget-styles.js      # Estilos encapsulados no Shadow DOM do modal
│   ├── translator-widget.js  # Modal arrastável com clamping de tela, aba de histórico e progresso
│   └── content.js            # Integração de seleção e atalhos na página
├── popup/
│   ├── popup.html            # Abas Tradutor / Histórico e barra de progresso offline
│   ├── popup.css             # Estilos do histórico, cartões com copiar/lápis e barra de download
│   └── popup.js              # Controle de histórico, edição via lápis, progresso e troca rápida
├── options/
│   ├── options.html          # Seletor personalizado e animado de fontes + configurações específicas
│   ├── options.css           # Animações dos cartões de provedores, logos, badges de limitação
│   └── options.js            # Lógica do seletor animado, fallback de logos e salvamento
└── welcome/
    ├── welcome.html          # Atualização das dicas com fontes gratuitas e histórico
    ├── welcome.css
    └── welcome.js
tests/
└── manual-test-page.html     # Cenários de validação das novas funcionalidades
```

**Structure Decision**: Mantida a arquitetura modular nativa da WebExtension em `src/` (`shared`, `background`, `content`, `popup`, `options`, `welcome`), adicionando `src/shared/providers.js` para centralizar os metadados/logos/limitações das 5 fontes, `src/background/offline-worker.js` para isolar o processamento pesado do Transformers.js em um Web Worker dedicado e `assets/providers/` para os logotipos vetoriais das fontes.

## Complexity Tracking

Nenhuma violação à Constituição do projeto. Todos os gates foram aprovados na verificação pré-pesquisa e pós-design.
