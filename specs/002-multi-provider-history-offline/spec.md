# Feature Specification: Fontes de Tradução Gratuitas,Modo Offline, Histórico e Modal Arrastável

**Feature Branch**: `002-multi-provider-history-offline`

**Created**: 2026-11-07

**Status**: Draft

**Input**: User description: "Features novas: Histórico (até 20 traduções no painel lateral, modal e pop-up, copiar novamente, editar tradução no texto livre via ícone de lápis, limpar histórico); Mover modal (arrastar modal centralizado, salvar posição, resetar para o centro, respeitar área da tela); Novas fontes de API de tradução gratuitas (LibreTranslate, MyMemory Translation API, Lingva Translate, com descrição, limitações, logo com fallback para nome e seletor personalizado animado); Opções Offline (tradução local no navegador via modelo de IA em processo isolado, barra de progresso de download 'Baixando pacote de tradução: 45%...', aviso de tamanho 40-80 MB e consumo de 200-500 MB de RAM)."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Escolha de Fontes de Tradução Gratuitas com Seletor Animado (Priority: P1)

Como usuário final, quero utilizar a extensão imediatamente sem precisar criar conta, cadastrar cartão de crédito ou configurar chaves de acesso complexas, podendo escolher visualmente entre fontes de tradução gratuitas (**MyMemory**, **Lingva Translate**, **LibreTranslate**), a chave pessoal do **Google Tradutor** ou o modo **Offline**, entendendo claramente as vantagens e limitações de cada opção.

**Why this priority**: Elimina a maior barreira de entrada da extensão (a obrigatoriedade de criar uma chave de acesso paga/complexa antes da primeira tradução), permitindo que qualquer usuário instale e traduza imediatamente.

**Independent Test**: Pode ser testado abrindo a página de Opções, abrindo o seletor animado de fontes de tradução, alternando para uma fonte gratuita sem chave (ex.: Lingva ou MyMemory), visualizando sua logo, descrição e limitações, e realizando uma tradução imediata no pop-up, painel lateral ou modal sem nenhuma chave cadastrada.

**Acceptance Scenarios**:

1. **Given** que o usuário acabou de instalar a extensão ou abriu as Opções sem chave cadastrada, **When** ele seleciona uma fonte gratuita (como MyMemory ou Lingva Translate) no seletor personalizado animado, **Then** a fonte escolhida torna-se ativa com confirmação visual imediata e permite traduzir textos em qualquer interface da extensão sem exigir chave de acesso.
2. **Given** que o usuário abre o seletor personalizado de fontes nas Opções, **When** ele navega pelas opções disponíveis (MyMemory, Lingva Translate, LibreTranslate, Google Tradutor e Tradução Offline), **Then** cada opção exibe sua logo (ou um emblema estilizado com o nome caso a imagem não esteja disponível), uma descrição simples em linguagem acessível e avisos claros sobre suas limitações de uso.
3. **Given** que a fonte gratuita selecionada atinge seu limite de uso ou encontra indisponibilidade temporária, **When** o usuário tenta traduzir um trecho, **Then** a extensão exibe uma mensagem clara explicando a limitação daquela fonte e sugere trocar para outra fonte gratuita nas Opções com um clique.

---

### User Story 2 - Histórico de Traduções Integrado com Reuso e Edição Rápida (Priority: P2)

Como usuário que consulta traduções frequentemente, quero acessar um histórico das minhas últimas 20 traduções tanto no Painel Lateral quanto no Pop-up e no Modal da página, podendo copiar qualquer tradução novamente, enviá-la para a caixa de texto livre através de um ícone de lápis para editá-la, ou limpar todo o histórico quando desejar.

**Why this priority**: Evita retrabalho e consultas repetidas, além de conectar diretamente o histórico ao fluxo de escrita/edição rápida em qualquer uma das três interfaces da extensão.

**Independent Test**: Pode ser testado realizando 3 traduções diferentes, abrindo a aba/visão de Histórico no Modal, no Pop-up ou no Painel Lateral, clicando em "Copiar" em um item (verificando o aviso visual de copiado), clicando no ícone de lápis de outro item (verificando que a interface volta para a aba de tradução com o texto traduzido preenchido na caixa de entrada pronto para edição) e clicando em "Limpar histórico".

**Acceptance Scenarios**:

1. **Given** que o usuário realizou traduções bem-sucedidas em qualquer interface da extensão, **When** ele abre a seção de Histórico no Pop-up, no Painel Lateral ou no Modal da página, **Then** ele visualiza até as 20 traduções mais recentes ordenadas da mais nova para a mais antiga, exibindo o trecho original, a tradução e os idiomas utilizados.
2. **Given** que o histórico já possui 20 traduções salvas, **When** uma 21ª tradução diferente é concluída, **Then** a tradução mais antiga é removida automaticamente para manter o limite máximo de 20 itens.
3. **Given** que o usuário visualiza um item no Histórico, **When** ele clica no botão de copiar daquele item, **Then** o texto traduzido é copiado para a área de transferência e o botão exibe feedback visual imediato ("Copiado").
4. **Given** que o usuário visualiza um item no Histórico, **When** ele clica no ícone de lápis ("Editar tradução"), **Then** a interface alterna automaticamente para a visão de texto livre, insere a tradução selecionada na caixa de texto de entrada e posiciona o cursor para edição imediata.
5. **Given** que existem itens salvos no Histórico, **When** o usuário clica na opção "Limpar histórico", **Then** todos os registros são apagados imediatamente e um estado vazio amigável é exibido.

---

### User Story 3 - Modal de Página Arrastável com Posição Persistente e Retorno ao Centro (Priority: P3)

Como usuário que lê artigos e documentos em páginas web, quero poder arrastar o modal de tradução para qualquer canto da tela para que ele não cubra o parágrafo que estou lendo, mantendo essa posição salva nas próximas aberturas e contando com um botão para restaurá-lo ao centro da tela sempre que quiser.

**Why this priority**: Melhora significativamente a ergonomia de leitura na página, permitindo que o usuário posicione a janela flutuante de acordo com o layout do site sem perder o texto de vista.

**Independent Test**: Pode ser testado abrindo o modal na página (`Alt+T`), arrastando seu cabeçalho para o canto superior direito, fechando o modal, abrindo-o novamente (verificando que abre na mesma posição salva), redimensionando a janela do navegador para um tamanho menor (verificando que o modal permanece totalmente dentro da tela) e clicando no botão "Centralizar" (verificando que volta ao centro exato).

**Acceptance Scenarios**:

1. **Given** que o modal de tradução está aberto na página, **When** o usuário clica e arrasta a barra superior do modal, **Then** o modal acompanha o movimento do cursor suavemente e nunca ultrapassa os limites visíveis da janela do navegador.
2. **Given** que o usuário moveu o modal para uma posição personalizada na tela, **When** ele fecha o modal e o abre novamente na mesma aba ou em outra página, **Then** o modal abre na posição personalizada salva, ajustada automaticamente caso a janela atual seja menor.
3. **Given** que o modal está em uma posição personalizada fora do centro, **When** o usuário clica no botão de resetar posição ("Centralizar") no cabeçalho do modal, **Then** o modal retorna imediatamente ao centro da tela e volta a usar o posicionamento centralizado padrão nas aberturas seguintes.

---

### User Story 4 - Tradução Offline no Navegador com Progresso de Download em Tempo Real (Priority: P4)

Como usuário que valoriza privacidade total ou precisa traduzir textos sem depender de serviços externos, quero ativar uma opção de tradução offline que execute localmente no meu navegador, visualizando claramente o progresso de download do pacote de idioma na primeira utilização e os avisos sobre tamanho de download e uso de memória.

**Why this priority**: Oferece independência completa de servidores externos e chaves de acesso, mantendo a interface responsiva através de processamento em segundo plano e transparência total durante o download inicial dos pacotes de idioma.

**Independent Test**: Pode ser testado selecionando a fonte "Tradução Offline (No Navegador)" nas Opções (observando os avisos de 40–80 MB de download e 200–500 MB de memória), solicitando uma tradução no Pop-up ou Modal, acompanhando a barra de progresso `"Baixando pacote de tradução: XX%..."` sem travamento da interface, e recebendo a tradução concluída localmente.

**Acceptance Scenarios**:

1. **Given** que o usuário seleciona a opção "Tradução Offline" no seletor de fontes, **When** os detalhes da opção são exibidos, **Then** a interface apresenta de forma destacada e compreensível que o primeiro uso de cada idioma fará um download de cerca de 40 MB a 80 MB e que o recurso consome entre 200 MB e 500 MB de memória durante o uso.
2. **Given** que a fonte "Tradução Offline" está ativa e o pacote do par de idiomas ainda não foi baixado no navegador, **When** o usuário solicita uma tradução no Pop-up, Painel Lateral ou Modal, **Then** uma barra visual de carregamento com a mensagem `"Baixando pacote de tradução: X%..."` é atualizada em tempo real até atingir 100%, sem congelar a página ou a interface da extensão.
3. **Given** que o pacote de tradução do par de idiomas já foi baixado anteriormente, **When** o usuário solicita novas traduções naquele mesmo par de idiomas, **Then** a tradução é realizada localmente sem necessidade de novo download.

---

### Edge Cases

- **Janela redimensionada após salvar posição do modal**: Se o usuário posicionar o modal próximo à borda direita/inferior em um monitor grande e depois abrir a extensão em uma janela menor, o modal deve calcular os limites da área visível atual e se reposicionar dentro da tela (com margem mínima de segurança) para nunca ficar inacessível.
- **Traduções idênticas consecutivas no histórico**: Se o usuário traduzir exatamente o mesmo texto para o mesmo idioma repetidas vezes seguidas (ou enquanto digita pausadamente), o sistema deve atualizar/mover o item existente para o topo em vez de preencher as 20 posições com duplicatas idênticas.
- **Falha no carregamento de logo da fonte de tradução**: Caso um ícone gráfico não carregue ou uma fonte não possua logotipo oficial, o seletor deve exibir automaticamente um emblema visual estilizado com as iniciais/nome da fonte, mantendo o alinhamento do layout.
- **Interrupção de conexão durante o download do pacote offline**: Se a internet cair durante o download inicial do pacote de idioma (40–80 MB), a barra de progresso deve ser substituída por um aviso amigável informando a falha no download e oferecendo um botão "Tentar novamente" ou a troca rápida para outra fonte.
- **Par de idiomas não suportado pelo modo Offline ou LibreTranslate**: Caso o usuário selecione um idioma que não possua pacote offline disponível, a interface deve informar claramente quais idiomas estão disponíveis nesse modo ou sugerir alternar para uma das fontes online gratuitas.

## Requirements *(mandatory)*

### Functional Requirements

#### Histórico de Traduções
- **FR-001**: A extensão DEVE manter um histórico local compartilhado das últimas **20 traduções** concluídas com sucesso, acessível tanto no Pop-up quanto no Painel Lateral e no Modal centralizado da página.
- **FR-002**: Cada item do histórico DEVE exibir o texto de origem, o texto traduzido, o par de idiomas utilizado, um botão para copiar a tradução novamente (com confirmação visual `"Copiado"`) e um botão com ícone de lápis para editar a tradução.
- **FR-003**: Ao clicar no ícone de lápis de um item do histórico, a interface ativa (Pop-up, Painel Lateral ou Modal) DEVE retornar para a visão principal de tradução livre, preencher a caixa de texto com a tradução daquele item e focar o campo para edição imediata.
- **FR-004**: O histórico DEVE permitir que o usuário apague todos os itens salvos através de uma ação "Limpar histórico" com atualização visual imediata.
- **FR-005**: Quando uma nova tradução for registrada e o histórico já contiver 20 itens, o item mais antigo DEVE ser removido automaticamente; caso a nova tradução tenha o mesmo texto de origem e idioma de destino do item mais recente, o registro existente DEVE apenas ser atualizado no topo sem duplicação.

#### Mover e Posicionar o Modal da Página
- **FR-006**: O Modal da página DEVE permitir que o usuário o arraste pela tela através de sua barra de cabeçalho (excluindo cliques nos botões de ação do cabeçalho).
- **FR-007**: Durante o arraste e ao abrir o modal, o sistema DEVE restringir as coordenadas horizontal e vertical para que o modal permaneça 100% dentro da área visível da janela do navegador (*viewport*).
- **FR-008**: A posição escolhida pelo usuário ao soltar o modal DEVE ser salva nas preferências locais e restaurada automaticamente nas próximas aberturas do modal.
- **FR-009**: O cabeçalho do modal DEVE exibir um botão "Centralizar" (visível ou ativo quando o modal tiver sido movido do centro) que reposiciona o modal imediatamente no centro da tela e limpa a posição personalizada salva.

#### Fontes de Tradução Gratuitas e Seletor Animado
- **FR-010**: A extensão DEVE suportar cinco fontes de tradução selecionáveis pelo usuário:
  1. **Lingva Translate** (gratuita, sem necessidade de chave de acesso)
  2. **MyMemory** (gratuita, sem necessidade de chave de acesso)
  3. **LibreTranslate** (código aberto, com suporte a servidor público configurável e chave opcional)
  4. **Google Tradutor (Chave Pessoal)** (uso com chave pessoal do Google Cloud)
  5. **Tradução Offline (IA no Navegador)** (processamento local no navegador)
- **FR-011**: A página de Opções DEVE apresentar um seletor personalizado e animado para escolha da fonte de tradução, exibindo para cada opção: logotipo visual (com fallback automático para emblema com o nome), descrição curta em linguagem simples e etiquetas claras com as limitações de cada serviço.
- **FR-012**: O campo de Chave de Acesso do Google só DEVE ser exigido quando a fonte selecionada for "Google Tradutor (Chave Pessoal)"; ao selecionar fontes gratuitas sem chave (como Lingva ou MyMemory), o usuário DEVE conseguir traduzir imediatamente sem configurar credenciais.

#### Tradução Offline no Navegador
- **FR-013**: A opção de Tradução Offline DEVE ser executada em um processo isolado em segundo plano para garantir que a interface do navegador e as páginas visitadas nunca travem durante o carregamento ou execução do modelo de tradução.
- **FR-014**: Durante o download inicial de um pacote de idioma no modo Offline (cerca de 40 MB a 80 MB), a interface ativa (Pop-up, Painel Lateral ou Modal) DEVE exibir uma barra de carregamento animada com a porcentagem atualizada em tempo real no formato `"Baixando pacote de tradução: X%..."`.
- **FR-015**: A política de segurança da extensão DEVE permitir a execução segura do motor local de tradução dentro do ambiente isolado da extensão, e a interface DEVE informar claramente as limitações de tamanho de download (40–80 MB por idioma) e consumo de memória RAM (~200 MB a 500 MB).

### Key Entities

- **TranslationProvider (Fonte de Tradução)**: Representa o motor escolhido pelo usuário (`lingva`, `mymemory`, `libretranslate`, `google`, `offline`), contendo identificador, nome amigável, ícone/logo com fallback textual, descrição simples, lista de limitações, requisito de chave e configurações específicas (como URL de servidor para LibreTranslate).
- **TranslationHistoryEntry (Item do Histórico)**: Registro de uma tradução concluída contendo identificador único, texto original, texto traduzido, idioma de origem detectado/escolhido, idioma de destino, fonte utilizada e data/hora, limitado a uma fila máxima de 20 itens.
- **ModalPositionPreference (Posição do Modal)**: Estado de posicionamento do modal na página contendo flag indicando se usa posição personalizada e coordenadas relativas/ajustáveis à janela visível, permitindo restaurar ou resetar para o centro.
- **OfflineModelStatus (Estado do Pacote Offline)**: Representa o estado de carregamento do pacote de tradução local para um par de idiomas (não baixado, baixando com percentual `0–100%`, pronto em memória ou erro), transmitido em tempo real para a interface aberta.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% dos novos usuários conseguem realizar sua primeira tradução em menos de 10 segundos após instalar a extensão usando uma fonte gratuita sem precisar cadastrar chave de acesso ou cartão de crédito.
- **SC-002**: O histórico armazena com precisão até 20 traduções e permite copiar ou enviar qualquer tradução de volta para edição na caixa de texto livre em apenas 1 clique em todas as 3 interfaces (Pop-up, Painel Lateral e Modal).
- **SC-003**: O modal da página pode ser arrastado e solto em qualquer região visível da janela a 60 quadros por segundo sem sair dos limites da tela, preservando sua posição em 100% das aberturas subsequentes até que o usuário acione o retorno ao centro.
- **SC-004**: No modo Offline, o progresso de download do pacote de idioma é atualizado visualmente na tela (`"Baixando pacote de tradução: X%..."`) sem bloquear a digitação ou a navegação na página, e traduções subsequentes no mesmo idioma ocorrem localmente sem novo download.
- **SC-005**: Todas as 5 fontes de tradução exibem claramente sua identidade visual (logo ou fallback de nome), descrição simples e limitações reais no seletor animado das Opções.

## Assumptions

- **Fonte padrão para uso imediato**: Caso o usuário ainda não tenha configurado uma chave pessoal do Google, a extensão pode oferecer uma fonte gratuita sem chave (como Lingva Translate ou MyMemory) pronta para uso imediato ou selecionável com um clique, preservando a chave do Google caso o usuário já a tenha salvo anteriormente.
- **Persistência local do histórico**: O histórico das 20 traduções é salvo localmente apenas no navegador do usuário, respeitando a privacidade e funcionando mesmo sem conexão com a internet.
- **Instâncias públicas das APIs gratuitas**: Para Lingva Translate e LibreTranslate, a extensão utilizará endpoints públicos confiáveis por padrão com fallback automático ou possibilidade de personalização simples caso uma instância comunitária esteja ocupada.
- **Escopo de idiomas no Modo Offline**: O modo Offline utilizará modelos compactos quantizados compatíveis com execução no navegador para os pares de idiomas principais suportados pela extensão, exibindo aviso amigável caso um par específico não possua modelo local compacto disponível.
