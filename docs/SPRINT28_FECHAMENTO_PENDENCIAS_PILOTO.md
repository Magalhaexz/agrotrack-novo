# Sprint 28 — Fechamento de pendências antes do piloto

**Data:** 2026-07-09
**Método:** app rodando local (`herdon-dev`), logado na conta real
(proprietário), navegação e inspeção DOM/CSS + testes unitários. Correções
verificadas com dado real onde disponível.

## Pendências levantadas (Sprints 21-27) e desfecho

| # | Pendência (origem) | Prioridade | Desfecho |
|---|---|---|---|
| 1 | "Todas as fazendas" existe no domínio mas não no seletor | P2 | **Implementado** |
| 2 | Lote órfão sem `faz_id` (invisível por fazenda) | P2/P3 | **Detector + aviso admin + visível no consolidado** |
| 3 | Empty state de Pastos sem CTA inline | P3 | **Corrigido** |
| 4 | Botões sem estilo em Acompanhamento de Peso | P2 | **Corrigido** |
| 5 | Telegram server-side pode misturar fazendas | P1 | **Corrigido (recorte + identificação)** |
| 6 | Consolidado precisa identificar fazenda de origem | P2 | **Implementado (páginas-chave)** |

## Etapa 2/3 — "Todas as fazendas" (visão consolidada)

**Núcleo (plumbing):**
- `src/domain/escopoFazenda.js`: sentinela `TODAS_FAZENDAS` (`id: null,
  todas: true`), `isModoConsolidado()`, `construirMapaFazendas()`,
  `nomeFazendaDoLote()`. Com `id: null`, `filtrarDbPorFazenda` já devolvia o
  db inteiro — a sentinela reaproveita isso sem tocar no filtro.
- `src/App.jsx`: o efeito de auto-seleção agora **preserva** a escolha
  explícita de "Todas as fazendas" (`prev?.todas`) em vez de forçar
  `fazendas[0]`.
- `src/components/AppHeader.jsx`: opção "Todas as fazendas — Visão
  consolidada" no topo do seletor (desktop + mobile), **só aparece quando há
  mais de uma fazenda** (não polui contas de fazenda única).

**Identificação da fazenda de origem** (só no modo consolidado; sem poluir a
visão de fazenda única):
- **Lotes**: cada `LoteCard` já exibia a fazenda no subtítulo → identificação
  automática. Corrigido também o filtro interno (`filterLotesByActiveFarm`)
  que devolvia lista vazia sem fazenda ativa — agora mostra todos os lotes no
  consolidado. Criar lote no consolidado é bloqueado com aviso ("Selecione
  uma fazenda ativa").
- **Custos**: coluna "Fazenda" (via lote → `faz_id`). Órfão aparece como
  "Sem fazenda".
- **Financeiro › Por Lote**: coluna "Fazenda" (header, linhas e rodapé de
  total alinhados; colSpan do estado vazio ajustado).
- **Estoque**: linha "Fazenda" no card do item (via `fazenda_id`).
- **Pastagens** e **Resultado dos Lotes**: já traziam coluna "Fazenda"
  (inclusive na exportação) — validado no consolidado.

**Validação:** alternar fazenda 1 / fazenda 2 / Todas funciona; nenhum dado
some; no consolidado aparecem os dados das duas fazendas identificados;
varredura de 13 telas no consolidado sem tela vazia, overflow, NaN ou erro de
console (mobile e desktop).

## Etapa 4 — Dados órfãos

- `src/domain/integridadeDados.js` (novo, puro, testado — 8 testes):
  `detectarLotesOrfaos`, `detectarRegistrosSemFazenda`,
  `resumirProblemasIntegridade`. **Não corrige nada automaticamente** (não
  apaga, não atribui fazenda) — só diagnostica.
- `src/pages/ConfiguracoesPage.jsx`: aviso administrativo seguro quando há
  problemas — "Existem registros sem fazenda vinculada. Revise para garantir
  filtros corretos." + contagem por tabela + orientação de usar "Todas as
  fazendas" para localizar. Confirmado ao vivo: detectou "1 em lotes · 1 em
  custos" (o lote órfão "recria" e o custo ancorado nele).
- Além do aviso, a própria **visão consolidada** já revela os órfãos
  (aparecem rotulados como "Sem fazenda"/"—" em Lotes, Custos e no CSV de
  Resultado). Órfãos deixaram de ser silenciosos, sem apagar dado real.

## Etapa 5 — Telegram multi-fazenda

Concern confirmado: `montarDbDaConta` monta o db da conta inteira (todas as
fazendas). Isolamento **entre contas** sempre existiu (`owner_user_id`) — o
problema era misturar fazendas **dentro** da conta, sem rótulo.

- `src/domain/telegramFazenda.js` (novo, puro, testado — 6 testes):
  - `prepararAlertasEscopados(dbConta, fazendaId)`: se a conexão tem
    `fazenda_id`, recorta o db para essa fazenda (reusa
    `filtrarDbPorFazenda`); senão, numa conta com >1 fazenda, sinaliza para
    identificar a fazenda em cada alerta.
  - `enriquecerAlertasComFazenda`: marca `fazendaNome` em cada alerta que se
    ancora num lote.
- `api/telegram-webhook.js` e `api/telegram-relatorio-diario.js`: passaram a
  ler `fazenda_id` da conexão (o `SELECT` não trazia esse campo) e a aplicar
  o recorte/identificação em `/alertas`, no assistente por intenção e no
  relatório diário.
- `formatarResumoAlertas` (`telegramComandos.js`): mostra `— <Fazenda>` na
  linha do alerta quando há `fazendaNome`.
- **Sem migration:** a coluna `telegram_connections.fazenda_id` já existe
  (migration `20260706120000_telegram_multiuser_connections.sql`).
- Testes cobrem: recorte por fazenda (single-farm, sem rótulo), conta
  multi-fazenda (com rótulo), conta de fazenda única (sem rótulo), não-vazamento
  entre fazendas, e o sufixo de fazenda na resposta do `/alertas`.

## Etapa 6 — Pastos

`src/pages/PastagensPage.jsx`: os dois estados vazios ganharam CTA
"Cadastrar pasto" (rola até o formulário, já presente no topo, e foca o
primeiro campo) e o texto pedido ("Cadastre pastos para acompanhar lotação,
capacidade e movimentação dos lotes."). Validado no mobile e desktop.

## Etapa 7 — Acompanhamento de Peso

Dois botões usavam a classe `primary-btn`, que **não tinha estilo base** (só
um override de largura no mobile) → renderizavam como botão nativo sem
estilo. Trocados para `ui-button ui-button--primary` (mesmo padrão do resto
do app: altura 44px, fundo, foco/hover). A regra CSS morta de `.primary-btn`
foi removida.

## Etapa 9 — Exportações no consolidado

`Resultado dos Lotes` (exportação principal por lote) já inclui coluna
"Fazenda" sempre; validado no consolidado: CSV traz os lotes das duas
fazendas identificados, órfão com "-", **sem NaN/undefined/Infinity**. As
demais exportações (DRE) são agregados de conta/fazenda, sem alteração de
geração.

## Validação técnica

- `npm run lint`: limpo.
- `npm test -- --run`: **987 testes, 0 falhas** (era 972; +15 novos: 8
  integridade + 6 telegramFazenda + 1 telegramComandos).
- `npm run build`: OK.
- Multi-fazenda, mobile 375 / desktop 1280: sem overflow, sem erro de
  console, sem tela vazia.

## Pendências que seguem para o futuro (não bloqueiam o piloto)

- **Identificação por linha no consolidado** ainda não foi adicionada a
  Pesagens, Sanidade, Nutrição, Tarefas e à Central de Alertas **na tela**
  (renderizam o consolidado corretamente, mas sem rótulo de fazenda por
  registro). São telas ancoradas em lote (onde o lote já dá o contexto) ou
  sem dado no piloto atual. No **Telegram**, os alertas já vêm identificados.
- Reatribuir a fazenda de um registro órfão direto pela UI (hoje: diagnóstico
  + reimportação/edição). O aviso administrativo orienta o caminho.
- Ativação de cobrança Asaas em produção (decisão comercial).

## Decisão final

**Liberado para teste com produtor por 1 mês.** As pendências conhecidas de
multi-fazenda, dados órfãos, Telegram, Pastos e Acompanhamento de Peso foram
fechadas; o que resta é P3/futuro e não impede o uso real.
