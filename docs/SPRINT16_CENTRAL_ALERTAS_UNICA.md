# Sprint 16 — Central de Alertas Única e Tratativa Operacional

## Problema encontrado na Sprint 13

O painel de resolver/adiar nunca foi migrado para a Central de Alertas nova (`AlertasPage.jsx`); 3 sistemas/motores de alerta coexistiam sem clareza de qual era o oficial, com risco de uma mudança em um não refletir nos outros.

## Motores de alerta encontrados (Etapa 1)

1. **`src/utils/alerts.js`** (legado, Sprint 1-4) — `buildAlerts`/`ackKey`. Alimenta **dois** pontos ainda em produção: o sino de notificações do header (`AppHeader`, via `App.jsx`) e a aba "Todos os alertas" dentro do próprio `DashboardPage.jsx`. Persiste tratativa em `alertas_resolvidos`/`alertas_adiados` (tabelas pré-existentes, modelo binário "existe linha = resolvido/adiado", chave heurística `ack_key`/`chave`).
2. **`src/domain/alertasUnificados.js`** (`gerarAlertasUnificados`, Sprint 5/9/10/12) — motor oficial reafirmado nesta sprint. Consumido por: Dashboard ("Prioridades de hoje"), Central (`AlertasPage.jsx`, via `centralAlertas.js`), Telegram (`/alertas` e relatório diário).
3. **`src/domain/centralAlertas.js`** (Sprint 11/12) — camada de normalização/filtro/resumo/ordenação em cima do motor único, exclusiva da Central.

**Confirmado:** Dashboard e Central já usavam a mesma fonte de geração (`gerarAlertasUnificados`) — o problema real não era "motores diferentes gerando alertas diferentes", e sim a **tratativa** (resolver/adiar) só existir no sistema legado (`utils/alerts.js`), nunca na Central.

## Decisão oficial

Documentada em [DECISAO_ALERTAS_CENTRAL_UNICA.md](DECISAO_ALERTAS_CENTRAL_UNICA.md): `gerarAlertasUnificados` é o motor único de geração; `centralAlertas.js` é a camada de apresentação da Central; tratativa é uma camada nova e separada (`tratativasAlertas.js`), com persistência própria.

## Migration

**Criada e aplicada**: `supabase/migrations/20260708090000_alertas_tratativas.sql` — tabela `alertas_tratativas` (status em_analise/resolvido/adiado/ignorado, chave `alerta_id`, RLS `same_account` seguindo o padrão mais recente do projeto — sem replicar o par duplicado `_owner`+`_same_account` já apontado como dívida na Sprint 13). Auditado antes via Supabase MCP: as tabelas `alertas_resolvidos`/`alertas_adiados` já existiam mas só suportam um modelo binário (sem status, sem `em_analise`/`ignorado`), então não davam para reaproveitar sem arriscar o painel legado que já as usa — decisão detalhada no documento acima.

## Como funciona a tratativa

- **Em análise**: aplica imediatamente, sem confirmação (ação reversível, não esconde o alerta).
- **Resolver**/**Ignorar**: pedem confirmação simples (`onConfirmAction`, mesmo padrão usado em Sanidade/Lotes) — depois de confirmado, o alerta some da lista de **ativos**, mas continua existindo e aparece no filtro **Histórico**.
- **Adiar**: abre um campo de data inline no próprio card; ao confirmar, o alerta some da lista de ativos até a data informada e volta a aparecer sozinho (comparação de data, sem job/cron).
- Nada é apagado: `aplicarTratativasAosAlertas` sempre anota `statusTratativa`/`visivel` em cada alerta, nunca remove da lista — quem quiser ver resolvidos/ignorados usa o filtro "Histórico".
- Edição não duplica: `salvarTratativaAlerta` procura uma tratativa existente para o mesmo `alerta_id` antes de decidir entre `createOperationalRecord`/`updateOperationalRecord`.

## Status disponíveis

`em_analise`, `resolvido`, `adiado`, `ignorado` — validados por `validarStatusTratativa` (domínio puro, nunca aceita status fora do enum).

## Impacto no Dashboard

Nenhuma mudança na fonte de dados — "Prioridades de hoje" continua lendo `gerarAlertasUnificados` sem tratativa (fora de escopo desta sprint, ver limitações). A aba "Todos os alertas" (painel legado com resolver/adiar simples) ganhou um atalho **"Ver Central de Alertas"** ao lado de "Voltar ao geral", para quem quiser a tratativa completa (em análise/ignorar/histórico) — o painel legado em si não foi alterado nem removido.

## Impacto no Telegram

`/alertas` e o relatório diário (`api/telegram-relatorio-diario.js`) agora filtram por `aplicarTratativasAosAlertas(...).filter(a => a.visivel)` antes de formatar a resposta — um alerta resolvido/ignorado/adiado-para-o-futuro não aparece mais como prioridade no bot. `alertas_tratativas` foi adicionada à lista de tabelas que o bot carrega (`api/_herdonDb.js`). Nenhum comando novo foi criado.

## O que foi aposentado/depreciado

Nada foi removido. O sistema legado (`utils/alerts.js` + `alertas_resolvidos`/`alertas_adiados`, usado pelo sino do header e pela aba "Todos os alertas" do Dashboard) está **documentado como depreciado em favor da Central**, mas continua funcionando sem alteração — migrá-lo de fato exigiria trocar sua base de identidade (de `ackKey` heurístico para o `id` estável de `gerarAlertasUnificados`), risco maior do que o escopo desta sprint permite.

## Janelas de prazo

`src/domain/janelasAlertas.js` (novo) documenta e nomeia as janelas já existentes; `alertasUnificados.js` passou a importar `PROXIMOS_7_DIAS`/`CARENCIA_CRITICA_DIAS` de lá em vez de constantes locais — **mesmos valores (7 e 3), nenhuma regra alterada**. A divergência é documentada como intencional (carência = segurança alimentar, janela mais curta de propósito), não como bug a corrigir.

## Testes executados

- `src/domain/tratativasAlertas.test.js` (novo, 21 casos): alerta sem tratativa aparece; em análise aparece; resolvido/ignorado não aparecem; adiado futuro oculto, vencido volta; criação de tratativa válida/inválida; resumo de contadores; compatibilidade com alertas legados sem `id`.
- `alertasUnificados.test.js`, `centralAlertas.test.js`, `telegramComandos.test.js` — rodados isoladamente, sem regressão (a extração de `janelasAlertas.js` e o filtro de tratativa no Telegram não alteraram nenhum caso existente).
- Suíte completa: **922/922** (901 da Sprint 15 + 21 novos).

## Validação visual (Etapa 13)

Mesma limitação das sprints 13-15: sem credencial de teste nesta sessão, só a tela de login pôde ser verificada ao vivo (sem erro de console, sem requisição de rede falha). Central de Alertas, Dashboard e Telegram não puderam ser exercitados no navegador — a garantia desta sprint vem dos 21 testes novos do domínio de tratativas + build/lint limpos + auditoria de código dos consumidores (App.jsx, telegram-webhook.js, telegram-relatorio-diario.js).

## Limitações restantes

- Dashboard "Prioridades de hoje" não tem tratativa nesta sprint — só a Central tem o fluxo completo. Adicionar lá exigiria decidir se usa a mesma tratativa da Central ou expõe uma segunda UI de tratativa — fora do escopo mínimo pedido.
- O painel legado (header + aba "Todos os alertas" do Dashboard) segue com resolver/adiar simples, sem os status "em análise"/"ignorado" — documentado como depreciado, não migrado (ver decisão acima).
- `alertas_resolvidos`/`alertas_adiados` continuam existindo e sendo usadas pelo legado — nenhuma tentativa de unificação ou remoção foi feita nesta sprint.
- Editar um manejo/alerta que já tem tratativa "adiado" e trocar para "resolver" funciona (upsert), mas não há um histórico de transições de status (ex.: "estava adiado, depois foi resolvido") — só o estado atual é guardado.
