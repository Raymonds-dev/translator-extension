# Quickstart & Validation Guide: Tradutor Contextual Rápido e Dinâmico

**Feature**: `001-contextual-quick-translator`
**Date**: 2026-11-07

## 1. Pré-requisitos

- Navegador **Mozilla Firefox** (versão 109 ou superior).
- Uma chave de API do **Google Cloud Translation API** (opcional para testar o fluxo de bloqueio BYOK, necessária para testar traduções reais).
- Nenhum *bundler*, Node.js ou etapa de compilação é necessária (arquitetura HTML/CSS/JS nativa).

## 2. Como Carregar a Extensão no Firefox

1. Abra o Firefox e digite `about:debugging#/runtime/this-firefox` na barra de endereços.
2. Clique no botão **"Carregar extensão temporária..."** (*Load Temporary Add-on...*).
3. Selecione o arquivo `manifest.json` na raiz do repositório.
4. Verifique se a extensão aparece ativa na lista e se o ícone foi adicionado à barra de ferramentas.

## 3. Roteiro de Validação Ponta a Ponta (End-to-End)

### Cenário 1: Validação BYOK Sem Chave Configurada (US5 - Fail Fast)
1. Com a extensão recém-carregada (sem chave salva), abra qualquer página web (ou `tests/manual-test-page.html`).
2. Selecione uma palavra ou frase e clique no ícone flutuante que aparece (ou pressione `Alt + T`).
3. **Resultado esperado**: O modal abre imediatamente sem fazer chamada externa e exibe a mensagem *"Para traduzir, insira sua chave da API nas configurações da extensão"* com um botão de ação.
4. Clique no botão do aviso.
5. **Resultado esperado**: A página de opções da extensão abre em uma nova aba apresentando o campo de chave do tipo senha (`type="password"`) e o link direto para o console do Google Cloud.

### Cenário 2: Configuração e Persistência da Chave (US5)
1. Na página de opções, insira sua chave da API no campo tipo senha, escolha seu idioma mãe/base (ex.: Português) e clique em Salvar.
2. Verifique a confirmação visual de salvamento.

### Cenário 3: Tradução por Seleção + Ícone Flutuante (US1)
1. Em uma página de teste, selecione uma frase em Inglês com o mouse.
2. **Resultado esperado**: O ícone flutuante surge em menos de 150ms próximo à seleção.
3. Clique no ícone flutuante.
4. **Resultado esperado**: O mini modal abre isolado visualmente (Shadow DOM), exibindo o texto selecionado no campo editável e sua tradução em Português logo abaixo.
5. Pressione `Esc` ou clique fora do modal e confirme que ele fecha imediatamente.

### Cenário 4: Tradução Direta via Atalho `Alt + T` (US2)
1. Selecione um parágrafo curto na página e pressione `Alt + T`.
2. **Resultado esperado**: O mini modal abre diretamente com a tradução do trecho selecionado, sem precisar clicar no ícone flutuante.

### Cenário 5: Inversão Rápida (*Switch*), Edição e Troca Temporária de Idioma (US3 + Clarifications)
1. Com o modal aberto exibindo uma tradução (ex.: Inglês → Português), clique no botão de inversão (*Switch*).
2. **Resultado esperado**: Os idiomas se invertem (Português → Inglês) e a frase traduzida sobe para o campo único de entrada editável.
3. Edite uma palavra no campo de entrada e aguarde ~500ms sem digitar.
4. **Resultado esperado**: A tradução abaixo é atualizada automaticamente.
5. Altere o seletor de idioma de destino do modal para Espanhol (`es`).
6. **Resultado esperado**: O texto é retraduzido para Espanhol na sessão atual; ao fechar o modal e traduzir um novo trecho, o idioma de destino volta a ser Português (idioma mãe/base).

### Cenário 6: Caixa de Tradução Livre Sem Seleção e Redirecionamento Inteligente (US4 + Clarifications)
1. Desmarque qualquer seleção de texto na página e pressione `Alt + T` (ou clique no ícone da extensão na barra de ferramentas).
2. **Resultado esperado**: A caixa de tradução abre vazia com o cursor focado no campo de entrada.
3. Digite uma frase no seu próprio idioma base (ex.: *"Bom dia, como vai?"* em Português) e aguarde ~500ms.
4. **Resultado esperado**: A extensão detecta que o texto já está no idioma base e traduz automaticamente para o último idioma secundário utilizado (ou Inglês por padrão).
