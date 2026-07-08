# Sprint 21 — Homologação Campo Real

## Objetivo

Testar o HERDON de ponta a ponta como um produtor real de gado de corte
usaria por 1 mês, com foco especial em independência entre fazendas, antes
de liberar para teste de campo.

## Método (limitação importante)

Sem credenciais de teste disponíveis nesta sessão (mesma limitação já
registrada nas Sprints 19 e 20), o "roteiro com dados reais simulados" da
Etapa 1 (Fazenda Boa Vista / Fazenda Santa Clara) não foi executado
clicando na UI. Em vez disso, a homologação foi feita por **auditoria de
código e de schema real** (via MCP Supabase, `list_tables` verbose): para
cada tela obrigatória, verificar se ela lê dados através do `db` recebido
por prop e se esse `db` é (ou não) recortado pela fazenda ativa antes de
chegar na tela. Essa auditoria é mais confiável para achar o bug de raiz
(estava na plumbing central, não em uma tela isolada) do que clicar tela
por tela — mas não substitui o teste manual em navegador/celular indicado
como pendência abaixo.

## Achado central (P0)

`useOperationalData` carrega **todas as fazendas da conta** de uma vez (só
filtra por `owner_user_id`, nunca por fazenda). O recorte por fazenda ativa
só existia para o Dashboard (`dbDashboard`, um `useMemo` em `App.jsx`) — e
mesmo esse recorte cobria só 7 das ~15 tabelas operacionais. Toda outra
página recebia o `db` inteiro, com todas as fazendas misturadas.

Confirmado por grep sistemático (menções a "fazenda" por página) que as
seguintes telas **não tinham nenhum filtro de fazenda**: Pesagens,
Estoque, Financeiro (e portanto DRE, mesma tabela), Comparativo de Lotes,
Simulador/Cenários. Sanidade e Pastagens tinham fazenda_id em formulários
específicos mas não filtravam a listagem principal. A Central de Alertas
era o caso mais grave: `rawAlerts` (a lista de alertas exibida em
Dashboard e Central) era gerada a partir do `db` completo, sempre — nunca
respeitava a fazenda ativa.

## Correção aplicada

- `src/domain/escopoFazenda.js` (novo, puro, 6 testes) —
  `filtrarDbPorFazenda(db, fazendaId)` recorta todas as tabelas
  operacionais com `fazenda_id` direto ou derivável via `lote_id`/
  `item_estoque_id`: lotes, animais, custos, pesagens, sanitário, tarefas,
  movimentações (animais/estoque/financeiras), estoque, pastagens,
  rotinas, cenários, alertas_tratativas, eventos_operacionais, consumo de
  suplementação.
- `src/App.jsx` — o `db` passado a `ActivePage` passou a ser
  `dbFazendaAtiva` (recortado) para todas as páginas operacionais, exceto
  as listadas em `FULL_DB_PAGE_KEYS` (páginas de conta: Fazendas, Equipe,
  Funcionários, Perfil, Assinatura, Configurações, Guia do Criador,
  Sincronização — e Importação, que precisa enxergar todas as fazendas
  para casar a coluna `codigo_fazenda` da planilha e evitar duplicar
  registros). `rawAlerts` (Central de Alertas + Dashboard) também passou a
  usar o `db` recortado.
- Registros sem `fazenda_id` (dados legados) continuam visíveis em
  qualquer fazenda — nunca somem silenciosamente; só passam a ficar
  "invisíveis em todo lugar" se alguém remover esse fallback no futuro
  (comentado no código).
- `src/pages/EstoquePage.jsx` — bug relacionado encontrado durante a
  auditoria: o formulário de cadastro de item **nunca gravava
  `fazenda_id`**. Com o recorte novo isso faria o item sumir de toda
  fazenda. Corrigido: a página agora recebe `fazendaSelecionada` e grava a
  fazenda ativa ao criar (edição preserva a fazenda já salva do item).

## Dados de teste

Não foi possível criar as fazendas "Boa Vista"/"Santa Clara" da Etapa 1 via
UI nesta sessão. A correção foi validada por: (1) testes unitários da
função pura de recorte com um `db` sintético equivalente ao cenário de
duas fazendas descrito na sprint; (2) leitura de schema real (Supabase MCP)
confirmando quais tabelas têm `fazenda_id`; (3) grep de cada página listada
na Etapa 2 confirmando leitura de `db.<tabela>` sem filtro próprio.

## Resultado — independência entre fazendas

Ver `docs/HERDON_MATRIZ_HOMOLOGACAO_PRODUTOR.md` para o detalhe por tela.
Resumo: 9 telas tinham o bug de mistura de fazendas (P0), todas corrigidas
nesta sprint pelo fix central. Uma lacuna **não corrigida**: o Telegram
(`api/_herdonDb.js#montarDbDaConta`) não recorta por fazenda no servidor —
uma conta com 2+ fazendas recebe alertas/relatório diário misturados no
bot. Classificado como P1 (não bloqueia o piloto se o produtor testar com
uma fazenda só primeiro, mas deve ser corrigido antes de multi-fazenda via
Telegram).

## Resultado — cadastros

Auditoria de código não encontrou outro caso de campo obrigatório ausente
como o do Estoque. Lotes, Pastagens (fazenda_id já era obrigatório no
formulário), Custos, Sanidade, Tarefas gravam `lote_id`/`fazenda_id`
corretamente nos pontos verificados. Teste manual completo (criar, editar,
excluir/inativar em cada cadastro) continua pendente — precisa de sessão
autenticada.

## Resultado — importação de planilhas

Já madura: exige coluna `codigo_fazenda` para pastos e lotes (satisfaz a
regra "nunca pode misturar sem avisar" da Etapa 4), valida campo a campo
com mensagem por linha, deduplica fazendas/lotes/animais/pesagens contra o
banco (reimportar o mesmo arquivo não duplica), tem modelo de planilha
para baixar (`gerarTemplateArrayBuffer`) e etapa de revisão antes de
confirmar. Nenhum bug P0/P1 encontrado na leitura de código. Teste manual
com arquivo real (grande, com erro proposital, etc.) não executado.

## Resultado — fluxos do produtor (Etapa 5)

Não executado interativamente. As perguntas 1–25 dependem de dados reais
lançados na UI; sem eles, qualquer resposta seria especulativa. Fica como
pendência explícita para a primeira semana real do piloto.

## Bugs encontrados

| # | Descrição | Prioridade | Status |
|---|---|---|---|
| 1 | `db` operacional nunca era recortado por fazenda fora do Dashboard (9 telas afetadas, incl. Central de Alertas) | P0 | Corrigido |
| 2 | Novo item de Estoque não gravava `fazenda_id` (ficaria invisível após o fix #1) | P0 | Corrigido |
| 3 | Telegram (`montarDbDaConta`) não recorta por fazenda — alertas/relatório diário misturam fazendas em contas multi-fazenda | P1 | Pendente |
| 4 | Formulário de Pastagens não pré-seleciona a fazenda ativa (usuário sempre escolhe manualmente, mesmo com só uma fazenda) | P2 | Pendente |
| 5 | "Fazendas cadastradas" em Relatórios Gerenciais mostra o total da conta mesmo dentro do relatório de uma fazenda específica | P2 | Pendente |

## Riscos antes do teste com produtor

- Se o produtor cadastrar mais de uma fazenda e usar o Telegram, alertas de
  uma fazenda podem aparecer misturados com os da outra (bug #3, P1).
- Nenhuma tela foi testada interativamente em navegador real ou celular
  nesta sessão — a homologação funcional (Etapas 5, 6, 8, 9, 10) segue
  pendente e deve ser feita antes ou durante a primeira semana do piloto.
- O fix de recorte por fazenda é uma mudança ampla (afeta o `db` de ~20
  páginas). Mitigado por: função pura testada isoladamente, uso do mesmo
  padrão já validado no Dashboard, `FULL_DB_PAGE_KEYS` protegendo backup e
  importação, e suíte completa (956 testes) + build passando após a
  mudança — mas o teste definitivo é uso real com duas fazendas.

## Recomendação

**Liberar para teste de 1 mês com uma ressalva**: orientar o produtor a
começar com **uma única fazenda** na primeira semana (evita o gap conhecido
do Telegram, bug #3) e, se for usar duas fazendas, acompanhar de perto a
Central de Alertas e o bot nos primeiros dias. O bug mais grave possível
(mistura de dados entre fazendas na UI) está corrigido e coberto por teste
automatizado; o que resta é validação manual de UX/mobile/fluxo completo,
que deve acontecer em paralelo ao uso real do produtor, não como
bloqueador antes de começar.

## Validações executadas

- `npm run lint` — sem erros.
- `npm test -- --run` — 956 testes, 0 falhas (950 anteriores + 6 novos de
  `escopoFazenda.test.js`).
- `npm run build` — build ok.
- `git status --short` — sem `.env`, tokens ou arquivos fora de escopo
  além dos já presentes do vault Obsidian (não commitados).
