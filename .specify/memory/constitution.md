# Translator Extension Constitution

## Core Principles

### I. Prioridade no Motor Firefox (Firefox-First)
A extensão DEVE ser projetada, desenvolvida e validada com prioridade primária para o motor do
Firefox (Gecko e APIs `browser.*` do padrão WebExtensions). A compatibilidade com outros motores
de navegador é secundária e NÃO DEVE comprometer a experiência, a performance, a segurança ou a
integração nativa no Firefox.

**Racional**: Focar no ecossistema do Firefox garante excelência técnica e aderência nativa à
plataforma principal do projeto, evitando concessões arquiteturais prematuras.

### II. Usabilidade, UX e Simplicidade Autoexplicativa (Zero-Manual UX)
A experiência do usuário (UX) e a usabilidade DEVEM guiar todas as decisões de produto e
interface. Toda funcionalidade DEVE ser simples, direta e imediatamente compreensível sem a
necessidade de manual, tutorial ou documentação externa. Elementos visuais, configurações e
fluxos desnecessários NÃO DEVEM ser incluídos.

**Racional**: Uma extensão de tradução é uma ferramenta utilitária de contexto rápido; qualquer
fricção cognitiva ou excesso de opções degrada diretamente seu valor para o usuário.

### III. Simplicidade de Código e Abstração Equilibrada (KISS & DRY Pragmático)
A implementação DEVE seguir o princípio KISS (*Keep It Simple, Stupid*), priorizando soluções
diretas, legíveis e de baixa complexidade. A duplicação de conhecimento DEVE ser evitada (DRY -
*Don't Repeat Yourself*), porém abstrações precoces NÃO DEVEM ser criadas. Duplicar um trecho de
código pontualmente DEVE ser preferido a introduzir uma abstração prematura, acoplada ou
excessivamente complexa.

**Racional**: Abstrações erradas impõem alto custo cognitivo e de manutenção; a consolidação só
deve ocorrer quando o padrão de reuso for real e comprovado.

### IV. Fluxo de Controle Defensivo e Separação de Conceitos
Funções e métodos DEVEM aplicar *Guard Clauses*, *Return Early* e *Fail Fast*, validando
pré-condições, casos de borda e erros logo no início da execução para evitar aninhamentos
profundos. A arquitetura DEVE manter estrita Separação de Conceitos (*Separation of Concerns*),
isolando claramente lógica de negócio/tradução, manipulação de DOM (*content scripts*),
gerenciamento de estado/background e componentes de interface.

**Racional**: A validação antecipada achata a estrutura condicional do código, enquanto a
separação de responsabilidades garante modularidade, testabilidade e facilidade de manutenção.

### V. Código Autoexplicativo e Regra do Escoteiro
Todo identificador (variáveis, funções, classes, módulos) DEVE possuir nome intencional que
expresse claramente seu propósito e comportamento, reduzindo a necessidade de comentários
explicativos. Valores literais arbitrários (números ou strings "chapados" / *magic values*) NÃO
DEVEM ser utilizados diretamente na lógica; eles DEVEM ser extraídos para Constantes ou Enums
semânticos. A Regra do Escoteiro (*Boy Scout Rule*) DEVE ser praticada em toda alteração: o
código tocado DEVE ser deixado mais limpo e claro do que estava antes.

**Racional**: Nomes semânticos, constantes explícitas e refatoração incremental contínua tornam o
código autodocumentado e previnem o acúmulo de dívida técnica.

## Restrições de Plataforma e Arquitetura

- **Alvo Principal**: Firefox (WebExtensions API via namespace `browser.*`).
- **Isolamento de Contextos**: A comunicação entre *Background Scripts*, *Content Scripts* e
  *Popup/Options UI* DEVE ocorrer por contratos de mensagens explícitos, com constantes ou enums
  nomeados para tipos de eventos e ações.
- **Leveza e Performance**: Scripts injetados em páginas (*content scripts*) DEVEM ter impacto
  mínimo no carregamento e renderização do DOM hospedeiro.

## Padrões de Qualidade e Revisão de Código

Toda entrega, especificação, plano técnico e *Pull Request* DEVE validar a conformidade com os
seguintes critérios de qualidade:

1. **Verificação de UX**: O fluxo proposto pode ser utilizado intuitivamente na primeira
   tentativa sem instruções externas?
2. **Legibilidade e Fluxo**: Condicionais aninhadas foram substituídas por *Guard Clauses* /
   *Return Early*?
3. **Semântica Explícita**: Todos os números e literais mágicos foram convertidos em Constantes
   ou Enums, e os nomes revelam a intenção sem depender de comentários?
4. **Controle de Complexidade**: A solução evita abstrações especulativas (KISS/DRY equilibrado)
   e respeita a Separação de Conceitos?
5. **Regra do Escoteiro**: Oportunidades locais de limpeza e melhoria de legibilidade nos
   arquivos modificados foram aplicadas?

## Governance

Esta Constituição governa todas as decisões arquiteturais, de design e de implementação do
projeto **Translator Extension**, prevalecendo sobre práticas informais.

- **Procedimento de Emenda**: Qualquer alteração aos princípios ou seções desta Constituição DEVE
  ser documentada com justificativa clara, revisão de impacto nos artefatos do projeto e
  atualização da data de emenda (`Last Amended`).
- **Política de Versionamento**: A versão da Constituição segue o Versionamento Semântico
  (`MAJOR.MINOR.PATCH`):
  - **MAJOR**: Remoção ou redefinição incompatível de princípios ou regras de governança.
  - **MINOR**: Adição de novo princípio/seção ou expansão substancial das diretrizes existentes.
  - **PATCH**: Clarificações textuais, correções de digitação ou refinamentos não-semânticos.
- **Revisão de Conformidade**: Todos os planos de implementação (`plan.md`), especificações
  (`spec.md`), tarefas (`tasks.md`) e revisões de código DEVEM verificar explicitamente a
  aderência aos princípios aqui estabelecidos.

**Version**: 1.0.0 | **Ratified**: 2026-11-07 | **Last Amended**: 2026-11-07
