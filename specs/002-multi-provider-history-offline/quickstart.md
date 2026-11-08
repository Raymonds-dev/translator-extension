# Quickstart Validation Guide: Fontes de Tradução Gratuitas, Modo Offline, Histórico e Modal Arrastável

**Feature**: `002-multi-provider-history-offline`
**Date**: 2026-11-08

## Pré-requisitos
- Navegador Firefox ou Zen Browser instalado.
- Extensão carregada em `about:debugging#/runtime/this-firefox` apontando para o arquivo `manifest.json` na raiz do repositório.

---

## Cenário 1: Tradução Imediata com Fonte Gratuita e Seletor Animado
1. Abra a página de **Opções** da extensão.
2. Na seção **1. Fonte de Tradução**, observe o seletor personalizado animado:
   - Confira que **Lingva Translate** está selecionado por padrão (caso não haja chave pessoal do Google salva).
   - Clique para expandir/navegar entre as 5 opções (**Lingva Translate**, **MyMemory**, **LibreTranslate**, **Google Tradutor** e **Tradução Offline**).
   - Verifique que cada opção exibe seu logotipo (ou emblema com iniciais em caso de fallback), uma descrição simples e etiquetas visuais com suas limitações.
3. Selecione **MyMemory** ou **Lingva Translate** e realize uma tradução no Pop-up ou com `Alt+T` na página `tests/manual-test-page.html` sem nenhuma chave cadastrada.

---

## Cenário 2: Histórico de Traduções (Até 20 Itens, Copiar, Editar com Lápis e Limpar)
1. Realize 3 traduções diferentes (por exemplo, no Modal centralizado, no Pop-up e no Painel Lateral).
2. Clique no botão **Histórico** no cabeçalho de qualquer uma das três interfaces:
   - Verifique que as 3 traduções aparecem ordenadas da mais recente para a mais antiga.
3. Clique no botão **Copiar** de um item do histórico:
   - Verifique o feedback visual imediato **"Copiado"**.
4. Clique no **ícone de lápis (Editar)** de um item do histórico:
   - Verifique que a interface volta para a visão de tradução livre, insere a tradução na caixa de texto de entrada, inverte os idiomas (o idioma da tradução passa a ser a origem e o idioma original do item passa a ser o destino) e posiciona o cursor para edição.
5. Abra novamente o **Histórico** e clique em **Limpar histórico**:
   - Verifique que a lista fica vazia imediatamente.

---

## Cenário 3: Modal da Página Arrastável, Limites da Tela e Botão Centralizar
1. Abra o modal na página pressionando `Alt+T`.
2. Clique e segure na barra superior do modal (`.brand-bar`) e arraste-o para o canto superior direito da janela:
   - Tente arrastá-lo para fora da tela e verifique que ele respeita os limites visíveis da janela (*viewport*).
3. Pressione `Alt+T` para fechar o modal e pressione `Alt+T` novamente para reabri-lo:
   - Verifique que o modal reabre exatamente na posição personalizada salva.
4. Clique no botão **Centralizar** no cabeçalho do modal:
   - Verifique que o modal retorna suavemente ao centro da tela e limpa a posição personalizada.

---

## Cenário 4: Tradução Offline no Navegador e Barra de Progresso de Download
1. Nas **Opções**, selecione a fonte **Tradução Offline (No Navegador)**:
   - Confira os avisos visíveis sobre o download inicial de **40 MB a 80 MB** por idioma e o uso de memória RAM de **200 MB a 500 MB**.
2. Abra o Pop-up, Painel Lateral ou Modal e digite uma frase em inglês para traduzir para português:
   - No primeiro uso, acompanhe a barra de progresso animada `"Baixando pacote de tradução: X%..."` até concluir.
   - Verifique que a interface não trava durante o download e exibe a tradução ao finalizar.
3. Digite uma segunda frase no mesmo par de idiomas:
   - Verifique que a tradução ocorre rapidamente sem novo download.
