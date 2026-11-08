# Research & Architectural Decisions: Tradutor Contextual Rápido e Dinâmico

**Feature**: `001-contextual-quick-translator`
**Date**: 2026-11-07

## 1. Formato do Manifesto e API de Extensão (Firefox-First)

- **Decision**: Utilizar **WebExtensions Manifest V3** focado no motor Gecko (Firefox 109+) com uso nativo do namespace `browser.*` (baseado em Promises).
- **Rationale**: O Firefox suporta nativamente Manifest V3 mantendo suporte a *Background Event Pages* (`background.scripts`), `browser.storage.local`, `browser.commands` (incluindo `browser.commands.update` para personalização de atalhos no Firefox) e `browser.runtime.openOptionsPage()`. A API `browser.*` evita callbacks aninhados e favorece o uso de `async/await` com *Guard Clauses* e *Return Early*.
- **Alternatives considered**:
  - *Manifest V2*: Em processo de descontinuação gradual no ecossistema de extensões; MV3 no Firefox já é estável e suporta *Event Pages*.
  - *Polyfills externos (`webextension-polyfill`)*: Desnecessário pois o foco primário da Constituição é o motor do Firefox, onde `browser.*` já é nativo.

## 2. Stack de Frontend e Processo de Build

- **Decision**: **HTML5, CSS3 e JavaScript (ES2022+) 100% nativos (Vanilla)**, sem *bundlers* (Webpack/Vite/Rollup) e sem frameworks de UI (React/Vue).
- **Rationale**: Alinha-se diretamente ao princípio **KISS** da Constituição e ao pedido explícito do usuário. A extensão pode ser carregada diretamente no Firefox via `about:debugging` sem etapa de compilação, facilitando inspeção, depuração e manutenção. O compartilhamento de constantes e utilitários entre scripts é feito pela ordem declarativa de carregamento no `manifest.json` e em tags `<script>` sob um namespace único (`globalThis.TranslatorExt`).
- **Alternatives considered**:
  - *Vite/Webpack + TypeScript/React*: Introduz complexidade de configuração, dependências `node_modules` e etapa obrigatória de build para um escopo enxuto que o DOM nativo resolve com alta performance.

## 3. Isolamento Visual na Página Hospedeira (FR-010)

- **Decision**: Utilizar **Shadow DOM (`attachShadow({ mode: 'open' })`)** em um único elemento container injetado na página (`#translator-ext-root`) com folha de estilo dedicada (`src/content/widget.css`).
- **Rationale**: Páginas web possuem resets agressivos de CSS, fontes variadas e regras `!important`. O Shadow DOM garante isolamento de estilo bidirecional: o CSS da página não deforma o ícone flutuante nem o mini modal, e o CSS da extensão não afeta a página do usuário.
- **Alternatives considered**:
  - *`<iframe>` injetado*: Dificulta o dimensionamento dinâmico conforme o texto cresce, complica o posicionamento relativo à seleção e adiciona latência de carregamento (>150ms).
  - *Classes CSS com prefixo sem Shadow DOM*: Vulnerável a herança de estilos globais (`box-sizing`, `font-family`, `line-height`, `color`, `button` styles) da página hospedeira.

## 4. Integração Google Cloud Translation no Modelo BYOK (US5)

- **Decision**: Utilizar a **Google Cloud Translation API v2 (Basic REST)** via endpoint `POST https://translation.googleapis.com/language/translate/v2?key={API_KEY}`, executada exclusivamente a partir do **Background Script**.
- **Rationale**:
  1. **Compatibilidade BYOK**: A versão v2 aceita autenticação direta via *API Key* gerada no painel do Google Cloud Console (`https://console.cloud.google.com/apis/credentials`), enquanto a v3 exige OAuth2/Service Account impraticável para usuários finais em modelo BYOK.
  2. **Detecção Automática Integrada**: Quando o parâmetro `source` é omitido, a própria resposta de tradução já retorna `detectedSourceLanguage` junto com `translatedText` em uma única requisição HTTP.
  3. **Segurança da Chave**: Executar a chamada no *Background Script* evita que a chave da API do usuário transite pelo *Content Script* ou fique acessível a scripts da página visitada, além de contornar bloqueios de CORS/CSP da página hospedeira.
- **Alternatives considered**:
  - *Google Cloud Translation v3*: Exige token OAuth2 / conta de serviço JSON, inviabilizando a UX simples de colar apenas uma chave de API no campo de senha.
  - *Chamada `fetch` direta no Content Script*: Expõe a chave no contexto da aba e pode ser bloqueada pela *Content Security Policy (CSP)* de sites restritivos (ex.: GitHub, bancos).

## 5. Acionamento Sem Seleção via `Alt + T` vs Ícone da Barra de Ferramentas (US2 / US4)

- **Decision**:
  - Clicar no ícone da extensão na barra de ferramentas abre o `popup.html` nativo do navegador com o campo de entrada focado.
  - Pressionar o atalho `Alt + T` (evento `browser.commands.onCommand`) verifica na aba ativa se há texto selecionado:
    - **Com seleção**: abre o mini modal no local do texto selecionado já traduzindo-o.
    - **Sem seleção**: abre o mesmo mini modal no canto superior direito da página ativa com o campo de entrada vazio e focado para digitação imediata (e caso a aba seja uma página restrita do navegador onde *content scripts* não rodam, faz fallback abrindo o popup da extensão via `browser.action.openPopup()`).
- **Rationale**: Oferece uma experiência contínua e consistente em qualquer cenário, mantendo a mesma estrutura de controles (campo único editável, botão *switch*, seletor de idioma temporário e aviso BYOK).
