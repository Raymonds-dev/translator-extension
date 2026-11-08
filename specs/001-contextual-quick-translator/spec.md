# Feature Specification: Tradutor Contextual Rápido e Dinâmico

**Feature Branch**: `001-contextual-quick-translator`

**Created**: 2026-11-07

**Status**: Draft

**Input**: User description: "A minha ideia é fazer funcionar que nem a extensão oficial do google tradutor, só que com a dinâmica que não oferece para complementar a usabilidade.

O que aconteceria:
- Ao selecionar uma frase, palavra ou texto ele abriria um ícone pop-up que ao clicar ele aparece um mini modal com a palavra selecionada e a tradução.
- Ao selecionar uma frase, palavra ou texto com o atalho configurado (padrão alt + t) ele abriria uma caixa de tradução na tela com a tradução do texto selecionado
- Ao aperta o ícone da extensão ou o atalho sem texto selecionado ele abrirá uma caixa de input permitindo escrever algo em qualquer língua e exibir a tradução para seu idioma mão/base.

Usabilidade:
- Você poderá fazer o switch rápido de tradução entre idioma base e idioma a ser traduzido e editar facilmente a frase traduzida
- Você poderá facilmente alterar a língua base temporariamente nos modais"

## Clarifications

### Session 2026-11-07

- Q: Como deve funcionar a interação entre o botão de *switch* de idiomas e a edição da frase traduzida dentro do modal? → A: Campo único de entrada editável + painel de resultado; ao clicar em *switch*, os idiomas se invertem e a frase traduzida sobe para o campo de entrada editável para permitir sua edição.
- Q: O que deve acontecer quando o texto selecionado ou digitado já estiver no próprio idioma mãe/base do usuário? → A: Redirecionamento inteligente automático: quando o idioma detectado na origem for igual ao idioma base, traduzir automaticamente para o último idioma secundário utilizado (com Inglês como fallback padrão).
- Q: Como deve funcionar o disparo da tradução ao digitar/editar texto e o controle de tamanho para proteger a cota da chave de API do usuário (BYOK)? → A: Atualização automática após pausa na digitação (~500ms) combinada com limite máximo de 2.000 caracteres por consulta para proteger a cota da chave BYOK.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Tradução Contextual via Seleção de Texto e Ícone Flutuante (Priority: P1)

Ao ler um conteúdo em uma página web, o usuário seleciona uma palavra, frase ou trecho de texto com o cursor. Imediatamente próximo à seleção, um discreto ícone flutuante é exibido. Ao clicar nesse ícone, ele se expande em um mini modal na própria página contendo o texto original selecionado e sua tradução para o idioma base do usuário.

**Why this priority**: É o fluxo central inspirado na extensão clássica do Google Tradutor, entregando valor imediato de leitura sem tirar o usuário do contexto da página e sem exigir memorização de comandos (Zero-Manual UX).

**Independent Test**: Pode ser testado selecionando qualquer texto em uma página web com o mouse, clicando no ícone flutuante exibido e verificando se o mini modal apresenta o texto original e a tradução correspondente, fechando-se ao clicar fora ou pressionar `Esc`.

**Acceptance Scenarios**:

1. **Given** que o usuário está em uma página web com texto visível, **When** ele seleciona uma palavra ou frase com o mouse, **Then** um ícone flutuante discreto aparece próximo à seleção sem obstruir a leitura do texto selecionado.
2. **Given** que o ícone flutuante está visível após uma seleção de texto, **When** o usuário clica no ícone, **Then** o ícone é substituído por um mini modal exibindo o texto selecionado, o idioma de origem identificado e a tradução no idioma base do usuário.
3. **Given** que o ícone flutuante ou o mini modal está aberto na página, **When** o usuário clica fora dele, desmarca a seleção ou pressiona a tecla `Esc`, **Then** o elemento flutuante é fechado imediatamente.

---

### User Story 2 - Tradução Direta por Atalho de Teclado com Texto Selecionado (Priority: P1)

Para usuários que buscam agilidade sem precisar clicar no ícone flutuante, ao selecionar um texto na página e acionar o atalho de teclado configurado (padrão `Alt + T`), o mini modal de tradução abre diretamente na tela já exibindo a tradução do trecho selecionado.

**Why this priority**: Complementa o fluxo principal oferecendo tradução instantânea de um único passo para usuários recorrentes, eliminando o clique adicional no ícone flutuante.

**Independent Test**: Pode ser testado selecionando um trecho de texto na página e pressionando `Alt + T` (ou o atalho personalizado), verificando que a caixa de tradução abre diretamente com o texto traduzido sem exigir clique no ícone.

**Acceptance Scenarios**:

1. **Given** que o usuário selecionou uma palavra ou frase na página, **When** ele pressiona o atalho configurado (padrão `Alt + T`), **Then** a caixa de tradução abre imediatamente na tela apresentando o texto selecionado e sua tradução para o idioma base.
2. **Given** que o usuário altera o atalho de teclado nas preferências da extensão, **When** ele seleciona um texto e pressiona o novo atalho configurado, **Then** a caixa de tradução responde ao novo atalho exibindo a tradução.

---

### User Story 3 - Manipulação Dinâmica: Inversão Rápida, Edição e Troca Temporária de Idioma (Priority: P2)

Dentro de qualquer modal ou caixa de tradução aberta, o usuário possui um único campo de entrada editável (origem) e a área de exibição do resultado traduzido. Quando precisa refinar o texto, testar variações ou traduzir no sentido inverso, ele pode editar o texto no campo de origem ou clicar no botão de inversão rápida (*switch*), que inverte os idiomas de origem e destino e move a frase traduzida para o campo de entrada editável. Além disso, pode alterar temporariamente o idioma de destino apenas para aquela consulta sem perder sua configuração padrão de idioma mãe/base.

**Why this priority**: É o grande diferencial de usabilidade em relação à extensão oficial do Google Tradutor, transformando um visualizador estático em uma ferramenta dinâmica de compreensão e escrita.

**Independent Test**: Pode ser testado abrindo qualquer modal de tradução, acionando o botão de inversão de idiomas, editando o texto na caixa e alterando o seletor de idioma base temporário, confirmando que a próxima abertura do modal volta ao idioma base padrão do usuário.

**Acceptance Scenarios**:

1. **Given** que um modal de tradução está aberto exibindo uma tradução do Idioma A para o Idioma Base B, **When** o usuário aciona o botão de inversão rápida (*switch*), **Then** os idiomas de origem e destino são invertidos (Idioma Base B para Idioma A) e o texto traduzido passa a ser a entrada editável para nova tradução.
2. **Given** que um modal de tradução está aberto, **When** o usuário edita o texto diretamente no modal, **Then** a tradução é atualizada automaticamente para refletir o texto modificado.
3. **Given** que o idioma base padrão do usuário é Português, **When** ele altera o idioma de destino no modal para Espanhol durante uma consulta, **Then** a tradução atual é exibida em Espanhol, mas ao fechar e abrir uma nova tradução posteriormente, o idioma de destino padrão volta a ser Português.

---

### User Story 4 - Caixa de Tradução Livre Sem Texto Selecionado (Priority: P2)

Quando o usuário deseja escrever uma palavra ou frase do zero (em qualquer idioma) para descobrir sua tradução ou redigir uma mensagem, ele clica no ícone da extensão na barra do navegador ou pressiona o atalho (`Alt + T`) sem ter nenhum texto selecionado na página. Uma caixa de tradução com foco automático no campo de entrada é aberta, traduzindo o que for digitado para o seu idioma mãe/base (com suporte às mesmas funções de inversão e troca temporária de idioma).

**Why this priority**: Permite usar a extensão ativamente para escrita e consulta avulsa a qualquer momento, sem depender de texto pré-existente na página.

**Independent Test**: Pode ser testado garantindo que nenhum texto está selecionado na página, pressionando `Alt + T` ou clicando no ícone da extensão na barra de ferramentas, digitando uma frase em outro idioma e verificando a exibição da tradução para o idioma base.

**Acceptance Scenarios**:

1. **Given** que nenhum texto está selecionado na página ativa, **When** o usuário pressiona o atalho configurado (`Alt + T`) ou clica no ícone da extensão na barra do navegador, **Then** uma caixa de tradução abre com o cursor posicionado automaticamente no campo de texto para digitação imediata.
2. **Given** que a caixa de tradução livre está aberta, **When** o usuário digita ou cola um texto em qualquer idioma, **Then** o idioma do texto é identificado automaticamente e a tradução para o idioma mãe/base é exibida dinamicamente.

---

### User Story 5 - Configuração e Validação de Chave Própria no Modelo BYOK (Priority: P1)

Seguindo o modelo *BYOK (Bring Your Own Key)* adotado por extensões de produtividade e IA, cada usuário utiliza sua própria chave de tradução. O usuário acessa a página de opções da extensão, onde encontra um campo protegido (tipo senha) para inserir sua chave e um link direto para o console do Google Cloud para obtê-la. A chave fica salva de forma persistente no armazenamento nativo do navegador. Caso o usuário tente traduzir qualquer texto sem ter uma chave configurada, o modal exibe imediatamente o aviso amigável *"Para traduzir, insira sua chave da API nas configurações da extensão"* acompanhado de um botão que abre a página de opções na hora.

**Why this priority**: É pré-requisito estrutural para que o serviço de tradução funcione de forma independente, sustentável e segura para cada usuário, mantendo uma experiência guiada e sem fricção no primeiro uso (Zero-Manual UX).

**Independent Test**: Pode ser testado tentando acionar uma tradução sem chave salva (verificando o aviso amigável e o redirecionamento imediato do botão para a página de opções) e, em seguida, salvando uma chave no campo tipo senha, reiniciando o navegador e confirmando que a chave persiste e libera as traduções.

**Acceptance Scenarios**:

1. **Given** que o usuário ainda não configurou sua chave de tradução, **When** ele aciona uma tradução (via clique no ícone flutuante, atalho `Alt + T` ou caixa de tradução livre), **Then** o modal abre sem disparar requisição externa e exibe o aviso amigável *"Para traduzir, insira sua chave da API nas configurações da extensão"* com um botão de ação imediata.
2. **Given** que o aviso de chave ausente está visível no modal, **When** o usuário clica no botão para configurar a chave, **Then** a página de opções da extensão é aberta imediatamente.
3. **Given** que o usuário está na página de opções da extensão, **When** ele visualiza o formulário de configuração da chave, **Then** ele encontra um campo de texto mascarado (tipo senha) para inserir a chave e um link direto para o Google Cloud para criação/obtenção da credencial.
4. **Given** que o usuário insere e salva sua chave na página de opções, **When** ele fecha e abre novamente o navegador, **Then** a chave permanece armazenada com segurança no navegador e as traduções funcionam imediatamente sem solicitar a chave novamente.

---

### Edge Cases

- **Chave ausente, inválida ou revogada**: Se não houver chave cadastrada, o disparo da tradução é interrompido preventivamente (*Fail Fast*) exibindo o aviso amigável com botão para abrir as opções; se a chave cadastrada for rejeitada pelo serviço (inválida ou sem cota), o modal deve informar claramente que a chave foi recusada e oferecer o mesmo botão direto para revisá-la na página de opções.
- **Seleção dentro de campos de formulário editáveis (`input` / `textarea`)**: O ícone flutuante não deve atrapalhar a digitação ou edição nativa do usuário; o posicionamento deve evitar cobrir o cursor de texto ou o acionamento deve priorizar o atalho de teclado quando em edição ativa.
- **Seleção vazia ou apenas espaços em branco**: Selecionar apenas espaços, quebras de linha ou limpar a seleção não deve exibir o ícone flutuante; se o atalho for acionado nessas condições, deve comportar-se como "sem texto selecionado" (abrindo a caixa de tradução vazia para digitação).
- **Texto selecionado no mesmo idioma base do usuário**: Quando o idioma detectado no texto selecionado ou digitado já for igual ao idioma mãe/base do usuário, a extensão deve redirecionar automaticamente o idioma de destino daquela sessão para o último idioma estrangeiro/secundário utilizado pelo usuário (usando Inglês como fallback inicial caso ainda não haja histórico).
- **Textos muito longos ou próximo às bordas da janela**: O texto de entrada/seleção possui um limite máximo de segurança de 2.000 caracteres por consulta (protegendo a cota BYOK do usuário contra seleções acidentais de páginas inteiras, exibindo um aviso claro caso excedido); dentro desse limite, o mini modal deve ajustar sua posição para permanecer sempre visível dentro da área útil da tela (*viewport*) e apresentar rolagem interna limpa.
- **Falha de conexão ou indisponibilidade do serviço de tradução**: O modal deve exibir uma mensagem curta, clara e amigável informando a falha de conexão com opção de tentar novamente, sem travar a página.
- **Páginas restritas do navegador**: Quando o usuário estiver em páginas internas do navegador onde scripts de página não podem ser injetados, o acionamento pelo ícone da barra de ferramentas ainda deve abrir o popup/caixa de entrada livre funcional.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: A extensão DEVE detectar quando o usuário seleciona um texto válido (não vazio) na página e exibir um ícone flutuante discreto próximo à seleção.
- **FR-002**: Ao clicar no ícone flutuante, a extensão DEVE abrir um mini modal contextual exibindo o texto selecionado, o idioma de origem detectado e a tradução para o idioma base do usuário.
- **FR-003**: A extensão DEVE disponibilizar um atalho de teclado configurável (com padrão inicial `Alt + T`) que:
  - Com texto selecionado na página: abre imediatamente o mini modal na tela com a tradução do texto selecionado;
  - Sem texto selecionado na página: abre a caixa de tradução com campo de entrada focado para digitação livre.
- **FR-004**: Ao clicar no ícone da extensão na barra de ferramentas do navegador, a extensão DEVE abrir a caixa de tradução permitindo digitar texto em qualquer idioma (ou traduzir seleção ativa) para o idioma base.
- **FR-005**: Todos os modais/caixas de tradução DEVEM apresentar um único campo de texto editável (origem) e uma área de resultado (tradução), atualizando a tradução automaticamente após uma breve pausa na digitação (~500ms) e respeitando o limite máximo de 2.000 caracteres por consulta (exibindo aviso amigável sem disparar requisição caso o texto selecionado/digitado ultrapasse esse limite).
- **FR-006**: Todos os modais/caixas de tradução DEVEM conter uma ação de inversão rápida (*switch*) entre o idioma de origem e o idioma de destino que, ao ser acionada, inverte o par de idiomas e move a frase traduzida para o campo de entrada editável para permitir sua edição imediata.
- **FR-007**: Todos os modais/caixas de tradução DEVEM permitir alterar temporariamente o idioma base/destino durante a sessão atual do modal, sem sobrescrever a preferência permanente de idioma mãe/base do usuário. Quando o idioma detectado na origem for igual ao idioma mãe/base, o idioma de destino da sessão DEVE ser alterado automaticamente para o último idioma secundário utilizado (com Inglês como fallback inicial).
- **FR-008**: A extensão DEVE permitir que o usuário configure permanentemente seu idioma mãe/base padrão (inicializado automaticamente a partir do idioma do navegador no primeiro uso) e personalize o atalho de teclado.
- **FR-009**: O ícone flutuante e o mini modal na página DEVEM ser fechados automaticamente ao clicar fora de sua área ou ao pressionar a tecla `Esc`.
- **FR-010**: A interface do mini modal e da caixa de tradução DEVE ser autoexplicativa (Zero-Manual UX) e isolada visualmente da página hospedeira para que estilos do site não quebrem o layout da extensão nem vice-versa.
- **FR-011**: O usuário DEVE poder copiar o texto traduzido com um único clique através de um botão de cópia rápida com confirmação visual imediata.
- **FR-012**: A extensão DEVE fornecer uma página de opções contendo um campo de texto do tipo senha para inserção da chave de tradução do usuário (modelo *BYOK*) e um link direto para o Google Cloud para obtenção da chave.
- **FR-013**: A extensão DEVE armazenar a chave do usuário de forma segura utilizando o armazenamento nativo do navegador, garantindo que ela persista entre sessões e fechamentos do navegador.
- **FR-014**: Antes de disparar qualquer tradução, a extensão DEVE verificar a existência da chave configurada (*Guard Clause* / *Fail Fast*); caso a chave não exista, DEVE exibir no modal o aviso amigável *"Para traduzir, insira sua chave da API nas configurações da extensão"* com um botão que abre a página de opções imediatamente.

### Key Entities *(include if feature involves data)*

- **Preferências e Credenciais do Usuário (`UserPreferences`)**: Armazena de forma persistente no navegador a chave de tradução do usuário (modelo *BYOK*), o idioma mãe/base padrão, o último idioma secundário utilizado (para facilitar o *switch* quando o texto original já está no idioma base) e a configuração do atalho de teclado (padrão `Alt + T`).
- **Sessão de Tradução (`TranslationSession`)**: Representa o estado efêmero de um modal aberto, contendo o texto de entrada atual (editável), o idioma de origem (detectado ou selecionado), o idioma de destino ativo (inicializado com o idioma base, mas alterável temporariamente na sessão) e o texto traduzido resultante (ou estado de aviso quando a chave *BYOK* não está configurada).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: O ícone flutuante aparece em menos de 150ms após o usuário concluir a seleção de um texto na página.
- **SC-002**: O usuário consegue visualizar a tradução de um trecho selecionado com no máximo 1 clique (via ícone flutuante) ou 1 comando de teclado (`Alt + T`).
- **SC-003**: A inversão entre idioma base e idioma traduzido (*switch*) ou a troca temporária de idioma dentro do modal é realizada em até 2 interações (cliques/teclas), sem necessidade de abrir telas de configuração.
- **SC-004**: 95% dos usuários conseguem realizar os três fluxos principais (seleção + ícone, seleção + atalho `Alt + T`, e tradução livre sem seleção + edição/switch) na primeira tentativa sem consultar instruções ou manuais.
- **SC-005**: O fechamento ou alteração temporária do idioma em um modal preserva 100% das vezes o idioma mãe/base padrão configurado para as próximas traduções.
- **SC-006**: Usuários sem chave configurada são orientados em 100% das tentativas de tradução pelo aviso amigável no próprio modal e conseguem chegar à página de opções com apenas 1 clique no botão do aviso.

## Assumptions

- **Detecção automática de idioma**: Assim como na extensão oficial do Google Tradutor, o idioma do texto selecionado ou digitado é detectado automaticamente por padrão, sem exigir que o usuário informe em qual língua o texto original está escrito.
- **Inicialização do idioma mãe/base**: Na instalação da extensão, o idioma mãe/base padrão é definido automaticamente com base no idioma configurado no navegador do usuário (ex.: Português do Brasil), podendo ser alterado a qualquer momento nas configurações da extensão.
- **Atualização de tradução ao editar**: Ao editar o texto dentro do modal, a nova tradução é disparada automaticamente após uma pausa de ~500ms na digitação (*debounce*), respeitando o teto de 2.000 caracteres por consulta para proteger a cota da chave do usuário.
- **Escopo da alteração temporária de idioma**: A alteração temporária do idioma base dentro do modal dura apenas enquanto aquele modal estiver aberto; ao fechá-lo e iniciar uma nova tradução, o idioma de destino retorna ao idioma mãe/base padrão do usuário.
