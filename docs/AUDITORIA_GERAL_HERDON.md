# Auditoria Geral 360º — HERDON

> Sprint de auditoria funcional, técnica, visual, de usabilidade, segurança e integridade de dados.
> Data: 2026-07-17 · Branch `main` · Hash inicial `2f323b3` (idêntico a `origin/main`) · Banco Supabase `ljpiszxicmmuefbiixui`.
>
> **Atualização (Onda 0, mesmo dia)**: retomado a partir de `43b47d5` para fechar o P0 de Estoque
> que ficou aberto na primeira rodada (§3.1 abaixo). Baseline desta rodada: 1550/1550 testes, lint e
> build limpos, `HEAD == origin/main == 43b47d5`.
>
> **Atualização (Teste de Campo, mesmo dia)**: retomado a partir de `fd72af4` para incorporar 5
> problemas observados em uso real do app (não achados de auditoria de código, mas relatos de
> campo) — ver §8 abaixo. Baseline: 1556/1556 testes, lint e build limpos.
>
> **Atualização (Auditoria UX Completa, mesmo dia)**: retomado a partir de `bf81189`, por pedido
> explícito de auditar toda a experiência do pecuarista (cliques, telas confusas, inconsistências,
> operações repetidas) em todos os módulos ANTES de iniciar a persistência de Dietas (Sprint C).
> ~35 achados novos, 4 corrigidos (P0/P1 evidentes), o restante consolidado em
> [MATRIZ_TESTES_FUNCIONAIS_HERDON.md](MATRIZ_TESTES_FUNCIONAIS_HERDON.md) §Auditoria UX Completa e
> priorizado em [PLANO_ACAO_CORRECOES_HERDON.md](PLANO_ACAO_CORRECOES_HERDON.md) (Sprints E-H antes
> do Sprint C). Baseline: 1559/1559 testes, lint e build limpos.

## Escopo

Auditoria de todo o aplicativo HERDON (React/Vite + Supabase + Vercel functions + Bot Telegram),
pensando em como um pecuarista usaria o sistema no dia a dia: o que não funciona, o que parece
funcionar mas não persiste, o que fica incorreto após refresh, o que é difícil de usar, e riscos de
segurança/integridade de dados.

## Método

1. **Baseline**: `git status`/`log`, lint, testes, build antes de qualquer alteração.
2. **Correção imediata do P0 relatado** (venda de animais) — investigação de causa raiz primeiro,
   correção depois, com testes de regressão.
3. **Auditoria código-grounded**: leitura direta de `src/`, `api/`, `supabase/migrations/` por três
   frentes paralelas (Rebanho e Campo; Estoque/Suplementação/Financeiro; Rotina/Alertas/Equipe/
   Segurança/Telegram), cruzada com a documentação de auditorias anteriores já existente no repo
   (11 documentos em `docs/`) e com a memória de sessões anteriores deste mesmo agente.
4. **Introspecção direta do banco de produção** via MCP do Supabase: `pg_policies`, `pg_trigger`,
   `pg_proc`, `list_migrations`, `get_advisors` — para separar o que é uma suposição de código do
   que é um fato confirmado no banco real.
5. **Tentativa de verificação visual ao vivo**: bloqueada (ver Limitações). Todo achado é
   rastreável a um `arquivo:linha`; nenhum foi declarado "funciona" sem essa evidência.

Detalhe operação-a-operação: [MATRIZ_TESTES_FUNCIONAIS_HERDON.md](MATRIZ_TESTES_FUNCIONAIS_HERDON.md).
Plano de correção por ondas/sprints: [PLANO_ACAO_CORRECOES_HERDON.md](PLANO_ACAO_CORRECOES_HERDON.md).
Diagnóstico dedicado de Estoque/Suplementação: [AUDITORIA_UX_ESTOQUE_SUPLEMENTACAO.md](AUDITORIA_UX_ESTOQUE_SUPLEMENTACAO.md).

## 0. Estado preservado antes de iniciar

`git status --short` mostrava só arquivos do vault Obsidian (não tocados) e dois documentos de
auditoria de sprints anteriores que existiam no disco mas nunca tinham sido commitados
(`docs/AUDITORIA_COMPLETA_HERDON.md` do sprint de 2026-07-05, `docs/FASE0_NAVEGACAO_SIDEBAR_HERDON.md`)
— foram commitados separadamente antes de iniciar esta auditoria, conforme instruído.

## 1. Baseline

| Comando | Resultado |
|---|---|
| `git status --short` | Limpo (após recuperar os 2 docs órfãos) |
| `npm run lint` | ✅ 0 erros/warnings |
| `npm test` | ✅ 1544/1544 testes passando, 19 suítes |
| `npm run build` | ✅ ok (Vite, ~1s) |

Nenhuma falha de baseline para registrar.

## 2. Correção imediata — venda de animais (P0)

### Causa raiz
Venda, morte e transferência de saída **sempre atualizaram `lote.qtd` corretamente** (fonte
canônica de saldo, usada por `calcLote`/`LotesPage`) — mas nunca sincronizavam a linha "grupo" da
tabela `animais`, que a página **Animais** lê **diretamente** para o resumo "Total de cabeças" e a
aba "Grupos" (`AnimaisPage.jsx:187,447`). Resultado: animais vendidos continuavam aparecendo ali com
a quantidade antiga — **inclusive após reload**, porque o valor desatualizado estava persistido no
banco, não apenas em memória.

O mesmo bug existia em **três lugares independentes**, todos com a mesma causa raiz:
1. `src/services/movimentacoes.js` (`registrarSaidaAnimal`/`registrarEntradaAnimal`) — usado pelo app web.
2. RPC `public.registrar_saida_lote` — usado pelo Bot do Telegram para venda/morte/abate/descarte/transferência.
3. "Ajuste de lotação" em `LotesPage.jsx` — correção administrativa de contagem.

### Correção
Nova função pura `sincronizarAnimaisGrupoDoLote` (JS) e sua réplica em SQL, aplicadas nos três
pontos. Registros `tipo_registro: 'individual'` (rastreio cabeça a cabeça, com ciclo de vida próprio
em `AnimaisPage`/`AnimalMovementModal`) nunca são tocados por essa sincronização — só a(s) linha(s)
"grupo".

### Testes
6 testes novos em `src/services/movimentacoes.test.js` cobrindo venda parcial/total, morte,
transferência (origem e destino), registro individual intocado, e entrada (compra). Suíte completa:
1550/1550 passando.

### Validação real
**Não realizada no Telegram nem no navegador** — não há credenciais funcionais de teste nesta sessão
(ver Limitações). A correção da RPC (`registrar_saida_lote`) foi aplicada diretamente no banco de
produção via `apply_migration` e revalidada por leitura da definição da função no próprio banco após
aplicar, mas **não foi exercida com uma venda real pelo Telegram**.

## 2.1 Onda 0 (retomada, mesmo dia) — Estoque: falha silenciosa corrigida (P0)

**Causa raiz confirmada**: o formulário de saída de estoque (`EstoquePage.jsx::SaidaModal`) oferecia
os tipos "Tratamento" e "Saída", mas `registrarSaidaEstoque` (`src/services/movimentacoes.js`) só
reconhecia `['consumo', 'ajuste', 'perda', 'venda']`. Para um tipo fora dessa lista, a função fazia
`console.warn(...)` e devolvia o `db` **inalterado** — e o modal, que nunca checava sucesso/falha,
fechava incondicionalmente logo em seguida. O produtor via "sucesso" e nada era gravado. O mesmo
padrão de falha silenciosa existia em `registrarEntradaEstoque` (item não encontrado, quantidade ou
custo inválidos).

**Enum canônico definido** (escopado a Estoque — não foi um refactor de todo o app): `tiposValidos =
['consumo', 'tratamento', 'ajuste', 'perda', 'venda']`.
- **"Tratamento"** virou um tipo real: gera despesa `tratamento_sanitario` quando vinculado a um
  lote (mesma regra de `consumo` → `consumo_estoque`, categoria distinta para o financeiro).
- **"Saída"** foi removida do formulário — era redundante com o próprio título da tela ("Saída /
  Consumo") e não representava nenhum caso de uso não coberto por Consumo/Tratamento/Ajuste/Perda.

**Nunca mais falha silenciosamente**: `registrarSaidaEstoque`/`registrarEntradaEstoque` agora
**lançam erro** (tipo inválido, item não encontrado, quantidade/custo inválidos) em vez de
`console.warn` + retorno mudo. `EstoquePage.jsx` (`SaidaModal`/`EntradaModal`) captura o erro, mostra
um toast com a mensagem, e **não fecha o modal nem limpa o formulário** em caso de falha — só fecha
e confirma sucesso quando a operação realmente persistiu.

**EST-02 corrigido junto** (mesma área de código, mesma causa raiz de fundo — duplicação de lógica
de persistência): `EntradaModal` tinha sua própria implementação de gravação que nunca chamava
`registrarEntradaEstoque`, então uma compra de estoque nunca gerava a despesa financeira
correspondente, mesmo com `App.jsx` já passando o handler correto (`onRegistrarEntradaEstoque`) —
a página simplesmente não usava essa prop. Removida a lógica duplicada; agora só existe **um**
caminho de persistência para entrada de estoque.

**Testes**: 6 testes novos em `movimentacoes.test.js` (tipo "tratamento" válido e com despesa
própria; tipo inválido lança erro; item inexistente lança erro em entrada e saída; quantidade/custo
inválidos lançam erro). Suíte completa: 1556/1556 passando.

**Validação real**: não realizada — mesmo bloqueio de credenciais desta sessão (ver Limitações). A
correção foi verificada por leitura de código e pelos testes automatizados citados acima, não por
clique real na tela.

**Não fiz nesta rodada** (fora do escopo do que foi pedido, ou dependente de navegador ao vivo):
- Redesenho completo das telas de Estoque/Suplementação (wizard "Registrar Uso" em etapas, empty
  states novos, unidade como dropdown) — ver `AUDITORIA_UX_ESTOQUE_SUPLEMENTACAO.md` §Proposta.
  Implementar UI nova sem poder verificar visualmente é arriscado; recomendo fazer isso só quando
  houver navegador autenticado disponível.
- Testes em 8 viewports/4 perfis — mesma limitação de navegador.
- Validação real da correção de venda no Telegram/app, e da correção de segurança de RLS — mesma
  limitação.
- Endurecer o RLS granular por módulo (S-02) — mudança de schema que toca várias tabelas; alto risco
  de regressão de permissão sem poder testar ao vivo.

## 3. Achado adicional crítico de segurança (P0) — corrigido nesta auditoria

Durante a auditoria de permissões, foi encontrada e **confirmada por consulta direta ao banco de
produção** (não apenas leitura de código) uma vulnerabilidade de escalada de privilégio em
`public.profiles`: uma policy RLS legada (`"Users can update own profile basics"`, `UPDATE`,
`qual`/`with_check` = `auth.uid() = id`, **sem nenhuma restrição de coluna**) permitia que qualquer
usuário autenticado — inclusive um `visualizador` convidado — alterasse o próprio `perfil` para
`proprietario` com uma única chamada `PATCH /rest/v1/profiles?id=eq.<próprio_id>`. Como policies
permissivas do Postgres se combinam por `OR`, essa policy antiga convivia com a policy mais nova e
aparentemente correta (`profiles_update_self_or_manager`) e **anulava sua proteção** — e, mais grave
ainda, a policy nova **também** não restringe qual coluna muda em um self-update (RLS valida linhas,
não colunas), então nem ela sozinha impediria a escalada. Nenhum trigger cobria essa lacuna.

Com `perfil='proprietario'`, o próprio atacante passa a satisfazer `app_can_manage_account()` para a
conta e pode então rebaixar ou expulsar o dono real — **tomada de conta completa em uma única
chamada de API**, sem precisar de nenhuma tela do aplicativo.

**Corrigido diretamente no banco de produção** (`apply_migration`, dado a gravidade): a policy legada
foi removida e um trigger `BEFORE UPDATE` (`profiles_bloquear_autoescalada`) agora bloqueia qualquer
auto-atualização (`auth.uid() = id` da linha) que mude `perfil` ou `owner_user_id`. Verificado
antes/depois via `pg_policies`/`pg_trigger`. O fluxo legítimo de gerente/proprietário alterando o
perfil de **outro** membro da equipe não foi afetado (nesse caso `auth.uid() ≠ id` da linha alterada).

## 4. Inventário e demais achados

Ver a matriz completa em [MATRIZ_TESTES_FUNCIONAIS_HERDON.md](MATRIZ_TESTES_FUNCIONAIS_HERDON.md).
Resumo por severidade (48 linhas registradas, contando as já corrigidas):

- **P0**: 4 encontrados — **todos os 4 corrigidos**: venda no app, RPC do Telegram, escalada de
  privilégio (auditoria anterior), e Estoque "Tratamento"/"Saída" falhando silenciosamente (esta
  rodada, Onda 0 §2.1).
- **P1**: 5 encontrados — 2 corrigidos nesta rodada (Ajuste de Lotação reabria o bug de venda;
  entrada de estoque nunca gerava despesa financeira); 3 abertos: RLS não reflete a matriz granular
  de permissões por módulo (`operador` pode gravar em Financeiro/Funcionários via API direta mesmo
  sem acesso na UI), planejamento de suplementação não persiste na nuvem, pesagem lançada pelo modal
  do detalhe do lote pode corromper o peso atual se for retroativa.
- **P2**: ~14 encontrados — inconsistências de UX e de fonte de dado (cálculo de capacidade de
  pasto usando `animais` cru, categorização de "item nutricional" com 3 heurísticas divergentes,
  regra de saldo negativo diferente entre Estoque e Suplementação, filtro de categoria do Financeiro
  não bate com as categorias reais geradas automaticamente, botões sem `disabled` por permissão em
  Fazendas/Pastagens/Funcionários).
- **P3**: ~15 encontrados — código morto (~380 linhas em `FazendasPage.jsx`), advisors de segurança
  de baixo risco (funções `SECURITY DEFINER` expostas, proteção de senha vazada desligada no
  Supabase Auth), dívida já conhecida do painel de alertas legado.

Nenhum achado de vazamento de dado cross-account ou cross-fazenda foi confirmado além do já corrigido
(S-01) — o bot Telegram e as tabelas operacionais principais (`lotes`, `animais`, `estoque`,
`movimentacoes_*`) usam consistentemente `owner_user_id`/`same_account` nas policies e nos filtros de
serviço.

## 5. O que este relatório NÃO afirma

Esta auditoria não afirma "todas as falhas do HERDON foram encontradas". Afirma: **todos os módulos e
fluxos inventariados foram auditados por leitura de código e introspecção direta do banco de
produção, e as falhas encontradas — reproduzíveis a partir da evidência citada — estão registradas**.
Não houve validação visual/manual em navegador nesta sessão (ver Limitações), então problemas
puramente de interação (ex.: um botão sobreposto em um viewport específico, um toast que não
aparece) podem existir sem terem sido detectados.

## 6. Limitações desta auditoria

- **Sem navegador autenticado**, confirmado em duas rodadas: as credenciais em `.env.e2e` (conta
  `magalhaesh617@gmail.com`) retornaram `AuthApiError: Invalid login credentials` do Supabase ao
  tentar logar no app local (`npm run dev` + Browser pane), tanto na auditoria original quanto
  nesta retomada (mesmo par de credenciais, mesmo erro). Não tentei senhas alternativas nem criei
  uma conta nova — nenhuma das duas é uma ação apropriada de tomar sem autorização explícita.
  Recomendo ao usuário confirmar/rotacionar essa credencial antes da próxima sessão de QA visual —
  sem ela, nenhuma tela foi clicada em nenhuma das duas rodadas, incluindo os 8 viewports e 4 perfis
  pedidos no escopo original, a validação real da venda/Telegram/segurança, e o redesenho de
  Estoque/Suplementação (que exigiria iteração visual para não arriscar quebrar a UI às cegas).
- Achados de UX (Estoque/Suplementação) vêm de leitura da estrutura real dos formulários no código
  (campos, labels, condicionais), não de um cronômetro real em mãos de um produtor.
- Segurança: auditei RLS/policies/triggers das tabelas centrais e da tabela `profiles` (onde achei o
  P0); não fiz uma varredura linha-a-linha de **todas** as ~40 tabelas do schema.
- `RetiradaAnimaisModal.jsx`, `FechamentoLoteModal.jsx`, `MoverPastoModal.jsx`: auditados via seus
  pontos de entrada em `LotesPage.jsx`, não linha a linha.

## 8. Teste de Campo — 5 problemas do uso real (CAMPO-01 a CAMPO-05)

Detalhe completo na matriz (§Teste de Campo). Resumo:

- **CAMPO-01 (Fazendas, P1, corrigido)**: um lote **encerrado** — sem nenhuma operação ativa — ainda
  bloqueava a exclusão da fazenda para sempre, sem nenhum caminho oferecido. Achado interessante: o
  campo `fazendas.status` (`'ativa'`/`'inativa'`) e a tela de edição (`FazendaModal.jsx`) **já
  suportavam inativação** — a lacuna era só a mensagem de bloqueio nunca mencionar essa saída.
  Corrigido ajustando a mensagem para orientar `Editar fazenda → Status → Inativa`, e ampliando a
  checagem de vínculos para também considerar `pastagens`/`tarefas` (que podem existir sem nenhum
  lote, e antes não bloqueavam a exclusão).
- **CAMPO-02 (Pastagens, P2, corrigido)**: os indicadores de capacidade/lotação por UA (Unidade
  Animal) tinham a MESMA causa raiz do bug de venda já corrigido nesta auditoria (VND-01) — somavam
  `animais[]` cru em vez de `lote.qtd` canônico, e não filtravam lotes finalizados/vendidos.
  `calcularUaPorLote`/`calcularUaTotalFazenda` (`src/domain/unidadeAnimal.js`) ganharam um argumento
  opcional para usar a contagem canônica quando disponível, preservando 100% de compatibilidade com
  quem ainda não o passa.
- **CAMPO-03 (Pastagens, cadastro de pasto)**: retestado — sem regressão das mudanças acima (só os
  cálculos de indicador foram tocados, não o formulário de cadastro). Mobile e multi-fazenda **ainda
  não verificados ao vivo**.
- **CAMPO-04 (Lotes, P1, corrigido)**: o cadastro de lote em conta com múltiplas fazendas mostrava só
  a fazenda ativa — como **texto fixo**, sem nenhum `<select>`. Confirmei que o dado em si já estava
  correto (`db.fazendas` sempre traz todas as fazendas da conta, mesmo em telas com recorte por
  fazenda ativa — `escopoFazenda.js::filtrarDbPorFazenda` nunca filtra essa chave); o bug era 100% de
  apresentação. Corrigido: vira um `<select>` real com todas as fazendas ATIVAS quando o lote é novo
  e há mais de uma; a escolha manual do produtor não é mais sobrescrita pela sincronização automática
  com a fazenda ativa da conta.
- **CAMPO-05 (Suplementação, cadastro de dieta)**: **não implementado nesta rodada.** Investigação
  confirmou que "Dieta" hoje só suporta 1 produto na prática (`itens[0]`) e — mais importante — **não
  existe uma tabela `dietas` no banco** (confirmado via `information_schema.tables`): é uma feature
  100% local, nunca persiste na nuvem (mesmo achado de SUP-01 da rodada anterior). Implementar o
  fluxo pedido (múltiplos itens, ações rápidas de copiar/repetir/pausar/finalizar, wizard em etapas)
  exigiria criar uma tabela nova + migration + camada de serviço + reescrita de UI — uma feature
  nova, não uma correção, e arriscada de fazer sem navegador para verificar visualmente. Proposta
  detalhada registrada em `AUDITORIA_UX_ESTOQUE_SUPLEMENTACAO.md` para quando houver QA visual
  disponível.

Nenhum dos 5 itens foi validado ao vivo em navegador — mesma limitação das rodadas anteriores desta
auditoria (ver §9).

## 9. Custo de IA

`grep -R` por `ANTHROPIC_API_KEY`, `@anthropic-ai/sdk`, chamadas a OpenAI/Gemini em todo o código da
aplicação (excluindo `node_modules`/plugins do Obsidian, que não fazem parte do HERDON): **zero
ocorrências**. O bot do Telegram é 100% determinístico (regex/sinônimos/tolerância a erro de
digitação — `src/domain/telegram/interpretadorTelegram.js`), sem chamada a nenhum provedor de LLM.

**Custo de IA: zero.**
