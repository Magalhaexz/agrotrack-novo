# Sprint 11 — Central de Alertas Inteligente

## Objetivo

Transformar os alertas unificados do HERDON (Sprint 5/9/10) numa tela de
decisão operacional — com filtros por origem, prioridade, lote, prazo e
ação recomendada — sem alterar `gerarAlertasUnificados` nem duplicar
nenhuma regra de alerta já existente.

## Etapa 0 — Auditoria (antes de editar)

Pré-checks: lint/testes/build limpos, working tree limpa (823 testes
passando antes de começar).

**Formato atual de um alerta** (`gerarAlertasUnificados`, inalterado):
```
{ id, tipo, prioridade, origem, titulo, descricao, acaoSugerida, pageId, dataReferencia }
```
`prioridade` ∈ `{critico, atencao, decisao, informativo}`; `origem` ∈
`{financeiro, estoque, rebanho, sanidade, tarefas, decisao}`.

**Onde a Central já aparecia:** não existia uma tela dedicada. O Dashboard
(`DashboardPage.jsx`) já monta sua própria "Central de Alertas Internos"
chamando `gerarAlertasUnificados` diretamente e agrupando por prioridade —
sem filtros, sem lote, sem ação recomendada destacada. O sino de
notificações (`App.jsx`/`AppHeader.jsx`) usa uma fonte **diferente**
(`utils/alerts.js`, legado, ver Sprint 9) — não mexemos nisso.

**Achados críticos da auditoria, antes de implementar:**
- `dataReferencia` é **sempre `null`** em todo alerta unificado hoje —
  nenhuma das 9 funções `agrupar*` em `alertasUnificados.js` preenche esse
  campo (os alertas são agregados por categoria, não por item/data única).
- **Nenhum alerta carrega `lote_id` estruturado** — grupos combinam vários
  lotes numa única `descricao` textual (ex. "Lote A · Lote B").
- 22 valores distintos de `tipo` em uso (inventariados via grep), cada um
  com uma janela de prazo implícita conhecida pela regra que o gerou.

Essas duas lacunas (`dataReferencia` sempre nulo, sem `loteId`) moldaram
todo o desenho do domínio abaixo — a decisão foi **não inventar dado que
não existe**, e sim derivar o que dá para derivar com honestidade.

## Etapa 1 — `src/domain/centralAlertas.js` (domínio puro)

Recebe a lista já pronta de `gerarAlertasUnificados()` — não busca dados,
não recalcula nada.

- **`classificarPrazo(alerta, hoje)`** — usa `dataReferencia` quando
  presente (compatível com um futuro em que o motor passe a preenchê-la);
  senão usa um mapa `PRAZO_POR_TIPO` (as mesmas janelas já hardcoded em
  `alertasUnificados.js`: 7 dias para saída de lote/contas, 3 dias para
  carência); tipos "de estado" sem data (gmd, estoque baixo, sem-pesagem
  etc.) caem em `sem_prazo`, exceto quando `prioridade === 'critico'`
  (tratado como `vencido`, já que crítico normalmente significa "já
  deveria ter sido resolvido").
- **`sugerirAcao(alerta)`** — **prefere `alerta.acaoSugerida`** (o motor já
  calcula uma boa ação por categoria — não duplica essa regra) e só
  sintetiza um texto genérico por `origem`/`tipo` quando ausente (alerta
  incompleto/legado/de teste). Os textos de exemplo do enunciado
  (carência, manejo vencido, estoque baixo, financeiro vencido, GMD baixo,
  genérico) são usados exatamente como fallback.
- **`normalizarAlertaCentral(alerta, opcoes)`** — devolve
  `{ id, titulo, descricao, origem, prioridade, loteId, loteNome,
  dataReferencia, prazoCategoria, acaoRecomendada, pesoDecisao, pageId,
  alertaOriginal }`. `loteId`/`loteNome` só são preenchidos quando
  `opcoes.lotes` é passado **e** exatamente um nome de lote conhecido
  aparece no título/descrição do alerta — heurística de texto, documentada
  e testada como tal (ambíguo = não vincula, nunca inventa).
- **`filtrarAlertasCentral(lista, filtros)`** — origem, prioridade,
  prazoCategoria, loteId/loteNome, busca textual, somenteCriticos.
- **`ordenarAlertasCentral(lista)`** — prioridade → prazo → `pesoDecisao`
  (peso combinado prioridade+prazo) como desempate final.
- **`resumirCentralAlertas(lista)`** — total, críticos, vencidos,
  vencendoHoje, próximos7Dias, contagem por origem e por prioridade.
  Recebe a lista **completa** (antes do filtro de UI), para os cards de
  resumo sempre refletirem o total real.

## Etapa 2 — Testes (`centralAlertas.test.js`)

10 testes, data fixa (`2026-07-10`): classificação de prazo (com e sem
`dataReferencia`, todas as 5 categorias), normalização de alerta vazio/nulo
(não quebra), vínculo de lote (1 nome bate / 2 nomes ambíguo / nenhum),
`sugerirAcao` para cada origem do enunciado + fallback genérico, filtros
(origem/prioridade/lote/busca/somenteCríticos), resumo e ordenação por
urgência.

## Etapa 3-4 — Tela e navegação

`src/pages/AlertasPage.jsx` (nova) — cabeçalho, 5 cards de resumo
(total/críticos/vencidos/vencendo hoje/próximos 7 dias), card de filtros
(origem, prioridade, prazo, lote, busca + chip "somente críticos"), lista
de cards decisórios (badge de prioridade + origem com ícone + badge de
prazo, título, descrição, lote se identificado, bloco "Ação recomendada"
destacado, botão "Abrir X" para a página de origem). Dois estados vazios
distintos: sem nenhum alerta (mensagem positiva) vs. sem resultado após
filtro (com botão "Limpar filtros").

O select de "Lote" só lista lotes que a heurística de texto **já
conseguiu vincular** a algum alerta atual — evita oferecer opções que
sempre dariam zero resultado.

Navegação: `src/navigation/navConfig.js` — item "Central de Alertas"
(`BellRing`) adicionado ao grupo Painel, substituindo o comentário que
desde o Sprint 5 dizia "fica para uma Central de Alertas própria".
`src/App.jsx` — lazy import + entrada no `pageMap` (`alertas: AlertasPage`).
`src/auth/perfis.js` — `permissoesPorPagina.alertas = 'dashboard:ver'`
(mesma permissão do Dashboard, já que a Central cruza todos os módulos).

## Etapa 5 — Integração com dados reais

`AlertasPage` chama `gerarAlertasUnificados({ ...db, pastagens:
pastagensFazendaAtiva })` — **mesma chamada, mesmo filtro por fazenda
selecionada**, que `DashboardPage.jsx` já faz para sua própria "Central de
Alertas Internos". Isso garante que os totais entre Dashboard e a nova
tela fiquem consistentes (mesma fonte, mesmo filtro de fazenda). Nenhum
dado fake — só o estado vazio ("Nenhum alerta crítico no momento.") cobre
a ausência de alertas.

## Etapa 6 — Estilo

`src/styles/alertas.css` (novo arquivo, mesmo padrão de
`styles/dashboard.css`/`styles/alertas.css` já usado por outras páginas):
cards escuros com borda esquerda colorida por prioridade (vermelho
crítico, âmbar atenção, azul decisão, verde-primário informativo), bloco
"Ação recomendada" com fundo verde suave (`color-mix` com
`--color-primary`), badges reaproveitando as classes já existentes
(`badge-r/a/n/info`). Responsivo: grid `auto-fit`/`auto-fill` que colapsa
para 1 coluna abaixo de 900px (mesmo breakpoint usado em
`styles/app.css`/`SanitarioPage`).

### Bug pego na verificação visual (corrigido antes do commit)

Ao testar a tela isoladamente (harness descartável fora do repo, com dados
fixos), descobri que a classe `summary-cards-grid` — que eu assumia ser um
utilitário global de grid, por aparecer em `SanitarioPage` — **não tem
nenhuma definição base de `display: grid`** em lugar nenhum do CSS; só
existe um override responsivo escopado a `.page--sanitario`. A grid real do
Sanitário vem inteiramente da segunda classe (`sanitario-summary-grid`).
Corrigido adicionando `display: grid` + `grid-template-columns` diretamente
em `.alertas-summary-grid`. Também renomeei o botão "Abrir <origem>" de
`chip-toggle` para uma classe própria (`alertas-card-abrir`) — reaproveitar
o mesmo nome de classe para dois elementos com propósitos diferentes
(filtro vs. navegação) causava ambiguidade de seletor nos meus próprios
testes de interação.

## Validação executada

- `npm run lint` — 0 erros
- `npm test -- --run` — **833 testes passando** (10 novos)
- `npm run build` — ok; `alertasUnificados.js` virou chunk compartilhado
  entre `DashboardPage` e `AlertasPage` (Vite hoisting automático, esperado)
- Verificação visual (harness descartável, não commitado): desktop (5 cards
  de resumo em linha, filtros numa grade, cards de alerta com cor por
  prioridade) e mobile (tudo empilha em 1 coluna, sem overflow) — screenshots
  conferidos, nenhum erro no console
- Interação testada: filtro por origem (select), toggle "somente críticos"
  (chip) — ambos atualizam a lista corretamente, contagem de resumo não muda
  (reflete sempre o total, não o filtrado)
- `alertasUnificados.js` **não foi alterado** — confirmado via `git status`
- `DashboardPage.jsx`, `api/telegram-webhook.js`,
  `api/telegram-relatorio-diario.js` **não foram tocados**

## Riscos / pendências para sprint futuro

- Vínculo de lote é uma heurística de texto (substring match no
  título/descrição) — não um relacionamento real. Funciona bem para
  alertas que já mencionam exatamente um nome de lote na descrição
  (GMD, sem-pesagem, saída de lote, carência), mas não cobre alertas
  puramente agregados sem nome de lote na descrição (financeiro, estoque
  geral, pastos).
- `classificarPrazo` para tipos "de estado" (gmd, estoque baixo,
  sem-pesagem, custo-alto-arroba etc.) não tem um prazo real — caem em
  `sem_prazo` (ou `vencido` se críticos). Isso é honesto, mas significa que
  o filtro "Próximos 7 dias" nunca vai mostrar esses tipos, mesmo que sejam
  urgentes — o filtro de prazo é complementar ao de prioridade, não um
  substituto.
- Se o motor único algum dia passar a preencher `dataReferencia` por
  alerta, `classificarPrazo` já está pronto para usar isso automaticamente
  (sem precisar de nenhuma mudança) — é o caminho natural de evolução
  citado no Sprint 9/10 para reduzir ainda mais a dependência de heurística.
