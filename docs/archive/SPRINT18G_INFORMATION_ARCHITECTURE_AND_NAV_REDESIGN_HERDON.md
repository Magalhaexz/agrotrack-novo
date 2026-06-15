# SPRINT18G_INFORMATION_ARCHITECTURE_AND_NAV_REDESIGN_HERDON

## 1) Cloud chip/action button layout fix (AppHeader)
- Corrigido o layout do chip global de nuvem no header para evitar sobreposicao.
- O chip continua exibindo status e detalhe:
  - status: `Modo local` / `Nuvem ativa` / `Sincronizando...`
  - detalhe: `Nuvem nao verificada` / `Ultima sync...`
- O botao de acoes agora usa gatilho compacto e seguro (icone), em area dedicada do chip, sem invadir o texto.
- As acoes continuam no dropdown do header global (nao retornaram para FazendasPage).
- Handlers preservados:
  - `onTestCloud`
  - `onSyncNow`
  - `onReconnectCloud`
- Estados de loading/disabled preservados por acao.
- Fluxo de diagnostico manual preservado com `/api/cloud-diagnostic` como fonte de verdade.

## 2) New navigation/grouping structure
Reorganizacao de IA no menu lateral com foco em clareza para produtor:
- Dashboard
- Cadastros
  - Fazendas
  - Lotes
  - Animais
  - Funcionarios
- Nutricao / Suplementacao
  - Nutricao e Suplementacao
- Estoque
  - Estoque Geral
- Financeiro
  - Financeiro
- Operacao
  - Pesagens
  - Sanitario
  - Tarefas
  - Calendario
- Analises e Relatorios
  - Comparativo
  - Relatorios
- Configuracoes

Tambem foram adicionadas descricoes curtas por grupo na sidebar para orientar melhor o uso.

## 3) What moved under Cadastros
- `Fazendas`
- `Lotes`
- `Animais`
- `Funcionarios`

## 4) What stayed under Financeiro
- Pagina `Financeiro` mantida intacta em funcionalidade, com foco de navegacao e copy em:
  - DRE
  - Por Lote
  - Lancamentos
  - Pagamentos Diarios
  - Fluxo de pendentes/pagos
  - Resultado financeiro

## 5) How Nutricao/Suplementacao was separated from Estoque
- `SuplementacaoPage` foi reposicionada como entrada principal de `Nutricao / Suplementacao`.
- `EstoquePage` recebeu escopo visual de exibicao:
  - `Estoque geral`
  - `Nutricao / suplementacao`
  - `Todos os itens`
- Nao houve migracao de schema nem alteracao de backend.
- A separacao e feita por classificacao de UI (categoria/nome), mantendo dados e persistencia existentes.

## 6) How existing functionality was preserved
- Nenhuma feature foi removida.
- Nenhuma rota funcional foi desabilitada.
- Operacoes de entrada/saida, consumo, sincronizacao, relatorios e dashboards continuam ativas.
- Alteracoes concentradas em:
  - Estrutura de navegacao
  - Rotulos
  - Agrupamento visual
  - Subtitulos de entrada de secoes

## 7) Permission behavior preserved
- A filtragem de paginas por permissao continua aplicada na Sidebar via `permissoesPorPagina` + `hasPermission`.
- Acoes sensiveis (editar estoque/financeiro etc.) continuam respeitando os mesmos bloqueios existentes.

## 8) What was intentionally not changed
- Supabase schema
- RLS policies
- Regras de auth
- Core de sincronizacao
- Source of truth do diagnostico de nuvem
- Calculos de negocio
- Formulas de GMD/consumo por lote
- Persistencia de pagamentos
- Persistencia de IATF
- Exportacao de relatorios
- Modelo de permissoes

## 9) Testing results
Executado:
1. `git grep -n -E "^(<<<<<<<|=======|>>>>>>>)" -- .`
- Resultado: `NO_CONFLICT_MARKERS`

2. `npm run build` (via `npm.cmd run build`)
- Resultado: **OK**

3. `npm run lint` (via `npm.cmd run lint`)
- Resultado: **OK com warnings preexistentes** (`29 warnings`, `0 errors`)

## Arquivos alterados
- `src/components/AppHeader.jsx`
- `src/components/Sidebar.jsx`
- `src/navigation/navConfig.js`
- `src/pages/EstoquePage.jsx`
- `src/pages/SuplementacaoPage.jsx`
- `src/styles/app.css`
