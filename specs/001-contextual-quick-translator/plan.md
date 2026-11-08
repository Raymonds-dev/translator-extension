# Implementation Plan: Tradutor Contextual Rápido e Dinâmico

**Branch**: `001-contextual-quick-translator` | **Date**: 2026-11-07 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-contextual-quick-translator/spec.md`

## Summary

Construir do zero uma extensão para navegador com foco prioritário no Firefox (motor Gecko / WebExtensions API) utilizando HTML5, CSS3 e JavaScript nativos (sem bundlers ou frameworks). A extensão oferece tradução contextual ao selecionar textos (via ícone flutuante ou atalho `Alt + T`), caixa de tradução livre quando não há texto selecionado, dinâmica de *switch* rápido que move a frase traduzida para o campo único de entrada editável, troca temporária de idioma por sessão, redirecionamento automático quando o texto original já está no idioma mãe/base e gerenciamento seguro de credenciais no modelo BYOK (*Bring Your Own Key* com Google Cloud Translation API v2).

## Technical Context

**Language/Version**: HTML5, CSS3, JavaScript (ES2022+ Nativo / Vanilla JS)

**Primary Dependencies**: Nenhuma dependência externa de runtime ou build; uso exclusivo das APIs nativas do navegador (`browser.storage.local`, `browser.runtime`, `browser.commands`, `browser.tabs`, `browser.action`, Shadow DOM e `fetch`).

**Storage**: `browser.storage.local` (armazenamento nativo persistente da WebExtensions API para a chave BYOK, idioma mãe/base, último idioma secundário e atalho).

**Testing**: Roteiro estruturado de validação manual no Firefox (`about:debugging`) apoiado por página de testes local (`tests/manual-test-page.html`) cobrindo seleção de texto, inputs, textos longos (>2.000 caracteres) e casos de borda.

**Target Platform**: Mozilla Firefox (Desktop, versão 109+ com suporte nativo a Manifest V3 e APIs `browser.*`).

**Project Type**: Browser Extension (WebExtension Firefox-First).

**Performance Goals**: Exibição do ícone flutuante em `< 150ms` após seleção de texto; *debounce* de `500ms` para retradução automática durante edição/digitação; impacto zero no carregamento inicial do DOM das páginas visitadas.

**Constraints**: Sem ferramentas de build/transpilação; isolamento visual estrito via Shadow DOM nos *content scripts*; limite máximo de `2.000` caracteres por consulta para proteção da cota BYOK; chave da API nunca exposta ao contexto da página web.

**Scale/Scope**: Extensão client-side leve com 4 contextos principais (Shared Modules, Background Script, Content Script com Shadow DOM Widget, Popup UI e Options UI).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Princípio da Constituição | Status (Pré-Pesquisa) | Status (Pós-Design) | Evidência / Justificativa Técnica |
|---------------------------|-----------------------|---------------------|-----------------------------------|
| **I. Prioridade no Motor Firefox (Firefox-First)** | PASS | PASS | Manifesto e código desenhados sobre o namespace nativo `browser.*` (Promises), `background.scripts` do Gecko e suporte a `browser.commands.update`. |
| **II. Usabilidade, UX e Simplicidade Autoexplicativa (Zero-Manual UX)** | PASS | PASS | Fluxo de 1 clique ou 1 atalho (`Alt + T`), campo único editável com *switch* intuitivo e aviso amigável no próprio modal quando a chave BYOK não está configurada. |
| **III. Simplicidade de Código e Abstração Equilibrada (KISS & DRY Pragmático)** | PASS | PASS | HTML/CSS/JS puro sem bundlers ou frameworks; compartilhamento simples via `src/shared/` sem camadas especulativas. |
| **IV. Fluxo de Controle Defensivo e Separação de Conceitos** | PASS | PASS | *Guard Clauses* explícitas antes de qualquer chamada de tradução (validação de chave vazia, texto vazio e limite de 2.000 caracteres); isolamento entre `background` (API/Storage), `content` (Shadow DOM/Seleção), `popup` e `options`. |
| **V. Código Autoexplicativo e Regra do Escoteiro** | PASS | PASS | Centralização de todos os números e literais em `src/shared/constants.js` (`LIMITS`, `STORAGE_KEYS`, `SESSION_STATUS`, `MESSAGE_TYPES`) e nomes semânticos em todas as funções. |

## Project Structure

### Documentation (this feature)

```text
specs/001-contextual-quick-translator/
├── plan.md              # Este arquivo (plano técnico de implementação)
├── research.md          # Decisões arquiteturais e técnicas (Fase 0)
├── data-model.md        # Modelo de dados, estados e constantes (Fase 1)
├── quickstart.md        # Guia de instalação e roteiro de validação no Firefox (Fase 1)
├── contracts/           # Contratos de mensagens e integração externa (Fase 1)
│   └── messaging-and-api.md
└── tasks.md             # Lista ordenada de tarefas (/speckit-tasks - Fase 2)
```

### Source Code (repository root)

```text
manifest.json
assets/
└── icons/
    ├── icon-16.svg
    ├── icon-48.svg
    └── icon-128.svg
src/
├── shared/
│   ├── constants.js          # Enums e constantes (LIMITS, STORAGE_KEYS, MESSAGE_TYPES, SESSION_STATUS, URLS)
│   ├── languages.js          # Catálogo de idiomas suportados e funções de normalização de código de idioma
│   └── storage.js            # Acesso encapsulado ao browser.storage.local com defaults e Guard Clauses
├── background/
│   ├── api-client.js         # Cliente REST para Google Cloud Translation API v2 (BYOK)
│   └── background.js         # Listener de mensagens, atalho Alt+T (browser.commands) e redirecionamento de idioma
├── content/
│   ├── widget.css            # Estilos encapsulados dentro do Shadow DOM (ícone flutuante e mini modal)
│   ├── translator-widget.js  # Componente UI do ícone flutuante e mini modal no Shadow DOM
│   └── content.js            # Captura de seleção, cálculo de coordenadas no viewport e ponte de mensagens
├── popup/
│   ├── popup.html            # Estrutura HTML da caixa de tradução livre (barra de ferramentas)
│   ├── popup.css             # Estilos da caixa de tradução no popup
│   └── popup.js              # Controlador do popup (input focado, debounce 500ms, switch e idioma temporário)
└── options/
    ├── options.html          # Página de opções (campo senha BYOK, link Google Cloud, idioma base e atalho)
    ├── options.css           # Estilos limpos da página de opções
    └── options.js            # Controlador de salvamento de credenciais, idioma mãe/base e atalho de teclado
tests/
└── manual-test-page.html     # Página HTML para bateria de testes manuais dos fluxos e casos de borda
```

**Structure Decision**: Estrutura enxuta de projeto único de extensão WebExtensions na raiz (`manifest.json` + `src/` dividido por contexto de execução do navegador: `shared`, `background`, `content`, `popup`, `options`). Essa organização garante estrita Separação de Conceitos sem exigir ferramentas de empacotamento, permitindo carregar a pasta raiz diretamente no Firefox.

## Complexity Tracking

Nenhuma violação à Constituição identificada. Todos os princípios foram atendidos integralmente com a arquitetura nativa proposta.
