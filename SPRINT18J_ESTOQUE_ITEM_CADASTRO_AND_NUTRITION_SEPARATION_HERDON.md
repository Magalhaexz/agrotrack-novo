# SPRINT18J_ESTOQUE_ITEM_CADASTRO_AND_NUTRITION_SEPARATION_HERDON

## Como novos itens de estoque são cadastrados
- Foi criado um fluxo explícito de **Cadastro de item** no módulo Estoque:
  - botão `Cadastrar item` no cabeçalho do Estoque.
  - modal `Cadastrar item de estoque` com campos:
    - nome do item
    - categoria/tipo
    - unidade de medida
    - quantidade inicial
    - quantidade mínima
    - custo unitário
    - validade
    - fornecedor
    - observações
- Categorias sugeridas para Estoque Geral implementadas no seletor:
  - Medicamento
  - Vacina
  - Material
  - Produto veterinário
  - Insumo geral
  - Outro

## Como entrada/saída usa itens existentes
- **Entrada de estoque** foi mantida como fluxo de aumento de quantidade em item já existente.
- No modal de entrada, quando não há nenhum item cadastrado, foi adicionado estado seguro:
  - `Cadastre um item antes de registrar entrada.`
  - botão `+ Cadastrar novo item` para abrir o cadastro.
- **Saída de estoque** foi preservada com seleção de item existente e manutenção do comportamento de baixa de saldo/movimentação.

## Diferença entre Estoque Geral e Nutrição/Suplementação
- A separação foi reforçada por classificação visual/UI:
  - Estoque usa escopo `geral`, `nutricao` e `todos`.
  - Itens nutricionais/suplementação são identificados por categoria/nome (sal, núcleo, suplemento, dieta, etc.).
- Não houve migração de schema nem remoção de itens antigos.
- Se itens de suplementação já existem no estoque geral, continuam no banco e a separação é feita por filtro/classificação de interface.

## Registro em Nutrição/Suplementação
- Foi adicionado bloco orientativo em `SuplementacaoPage` esclarecendo:
  - onde cadastrar dieta/suplemento
  - onde registrar consumo diário
  - limitação atual para modelo `% do peso vivo` sem schema dedicado

## O que foi intencionalmente não alterado
- Supabase schema
- RLS policies
- auth rules
- sync core behavior
- cloud diagnostic flow
- business calculations
- fórmulas de GMD/consumo de lote
- dashboard e relatórios

## Estratégia de persistência
- Cadastro de item usa `createOperationalRecord('estoque', payload, session)`.
- Entrada usa:
  - `updateOperationalRecord('estoque', ...)` para saldo/custo
  - `createOperationalRecord('movimentacoes_estoque', ...)` para histórico
- Saída usa:
  - `updateOperationalRecord('estoque', ...)`
  - `createOperationalRecord('movimentacoes_estoque', ...)`
  - `createOperationalRecord('movimentacoes_financeiras', ...)` quando aplicável
- Em falha de persistência remota, mantém fallback local e feedback de aviso ao usuário.

## Comportamento de permissões
- Mantida a proteção por permissão `estoque:editar` para:
  - cadastrar item
  - registrar entrada
  - registrar saída
- Usuário sem permissão recebe mensagem:
  - `Você não tem permissão para executar esta ação.`

## Arquivos alterados
- `src/pages/EstoquePage.jsx`
- `src/pages/SuplementacaoPage.jsx`

## Resultados de teste
- `git grep -n -E "^(<<<<<<<|=======|>>>>>>>)" -- .`
  - sem conflitos.
- `npm run build`
  - sucesso.
- `npm run lint`
  - sem erros (apenas warnings preexistentes de `react-hooks/exhaustive-deps`).
