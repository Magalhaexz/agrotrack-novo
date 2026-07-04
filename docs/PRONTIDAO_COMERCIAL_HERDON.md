# Prontidão Comercial — HERDON

> Sprint: "Preparar o HERDON para venda real com bloqueio por plano, papéis e assinatura"
> Data: 2026-07-02 · Branch `main` · Banco: Supabase `ljpiszxicmmuefbiixui`

## 0. Paywall de escrita / modo visualização (atualização 2026-07-02)

**Por que mudou.** O bloqueio global da sprint anterior era tecnicamente correto mas comercialmente agressivo: uma conta sem plano caía direto numa tela de bloqueio e não conhecia o produto. O produtor precisa ver o HERDON antes de decidir pagar.

**Regra antiga.** Sem assinatura válida → não entra no app (tela `AssinaturaBloqueadaPage` logo após o login).

**Regra nova.** Sem assinatura válida → **entra e vê o app inteiro em modo visualização**; só a **escrita** (cadastrar/salvar/editar/excluir/importar) exige plano. Ao tentar gravar, é levado à página de planos com a mensagem "Para salvar dados no HERDON, escolha um plano."

| Situação | Pode VER | Pode ESCREVER |
|---|---|---|
| Sem assinatura | ✅ | 🔴 (sem_plano) |
| `trialing` no prazo | ✅ | ✅ |
| `trialing` vencido | ✅ | 🔴 (trial_vencido) |
| `active` | ✅ | ✅ |
| `past_due` na tolerância (3 dias) | ✅ | ✅ (com aviso) |
| `past_due` fora da tolerância | ✅ | 🔴 (pagamento_vencido) |
| `canceled` / `blocked` | ✅ | 🔴 |
| `internal_test` / override / admin bootstrap | ✅ | ✅ |

**Subusuários** herdam o status do proprietário (assinatura avaliada via `owner_user_id`): dono sem escrita ⇒ subusuário sem escrita. **Visualizador** nunca escreve, mesmo com plano ativo (bloqueio de papel em `perfis.js`, independente do paywall comercial).

**Como o redirecionamento funciona (camadas centrais, sem tela-a-tela):**
1. **Serviço central** — `operationalPersistence.createOperationalRecord/update/delete` (e a limpeza de coleção) checam o paywall na primeira linha via `writeGuard`. Sem plano, retornam `{ persisted:false, code:'SUBSCRIPTION_REQUIRED' }` **antes de qualquer chamada de rede ou fila offline** (sem erro técnico, sem "salvar depois", sem sucesso falso) e disparam o redirecionamento. Como as telas persistem primeiro e só atualizam a UI no sucesso, nenhum registro fantasma aparece.
2. **Ações rápidas / FAB do Dashboard** — guardados no `App.jsx`: tocar em "Nova pesagem/lote/…" sem plano redireciona imediatamente para assinatura (Parte 7).
3. **Redirecionamento** — proprietário vai para "Planos e Assinatura" (`minhaAssinatura`) com toast; subusuário recebe "peça ao proprietário para ativar um plano".

**Aviso de topo (modo visualização):** banner discreto em azul — "Você está em modo visualização. Explore o HERDON à vontade. Para cadastrar, salvar ou editar dados da fazenda, escolha um plano." + botão "Escolher plano" (proprietário).

**Telas protegidas:** todas — o bloqueio é central no serviço de persistência, cobrindo Fazenda, Pastos, Lotes, Animais, Pesagens, Estoque, Sanidade, Suplementação, Financeiro, Tarefas, Calendário, Cenários, Configurações e importação. **Isenção documentada:** descartes pessoais de notificação (`alertas_resolvidos`, `alertas_adiados`) continuam gravando em modo visualização — não são dados da fazenda.

**Arquivos:** `src/services/accessControl.js` (`canViewApp`/`canWriteData`/`requiresSubscriptionForWrite`/`getWriteBlockedReason`/`SubscriptionRequiredError`), `src/services/writeGuard.js` (novo, ponte de runtime), `src/services/operationalPersistence.js` (guarda central), `src/App.jsx` (remove o bloqueio de entrada, banner de modo visualização, redirect de ações rápidas), `src/pages/AssinaturaBloqueadaPage.jsx` (não mais usado no fluxo — redirecionamos para `minhaAssinatura`).

**Testes (Parte 11):** `tests/writePaywall.test.js` (14 casos) cobre a matriz view/write dos 8 status, herança de subusuário, visualizador sem escrita mesmo com plano, `SubscriptionRequiredError`, o default permissivo do guard e a **integração real**: `createOperationalRecord/update/delete` chamados com `canWrite:false` retornam `SUBSCRIPTION_REQUIRED` e disparam o redirect, e as tabelas isentas não são bloqueadas. Suite total: 666 testes, 0 falhas.

**Limitação / próximos passos (Parte 14 — segurança):** o paywall protege o **fluxo normal do app** (UI + serviço central), mas **não há bloqueio no nível de RLS/RPC** — um usuário sem plano ainda conseguiria gravar na própria conta chamando o Supabase diretamente (o RLS isola contas por `owner_user_id`, mas não valida assinatura; nenhum dado de terceiros é exposto em hipótese alguma). Endurecer via RLS/RPC com validação de assinatura ativa nos INSERT/UPDATE/DELETE operacionais fica como etapa futura, **fora desta sprint** por exigir diagnóstico dedicado (risco de quebrar o app inteiro). Nesta sprint **nenhum RLS foi alterado**.

**Validação manual (Parte 12):** o dev server local não tem chaves Supabase (`.env` sem `VITE_SUPABASE_URL`), então o login logado não roda localmente — a verificação clicável (conta sem plano navega tudo e é redirecionada ao tentar cadastrar; conta paga salva normal) deve ser feita na URL publicada após o deploy deste commit. Lógica coberta integralmente pelos testes; app sobe limpo na tela de login com todos os módulos novos servidos sem erro de console.

---


## 1. Diagnóstico do estado comercial (antes desta sprint)

O HERDON já tinha **quase toda a infraestrutura comercial construída** em sprints anteriores (12, 22–28):

| Peça | Situação encontrada |
|---|---|
| Catálogo de planos | ✅ `src/services/subscriptions.js` (5 planos) + tabela `subscription_plans` (5 linhas, espelhadas) |
| Tabelas de assinatura | ✅ `customer_subscriptions`, `billing_events`, `checkout_sessions`, `subscription_plans`, `invites` — todas com RLS |
| Checkout Asaas | ✅ `api/asaas-create-customer.js`, `api/asaas-create-subscription.js`, `src/services/asaasBilling.js`, fluxo completo em `MinhaAssinaturaPage` (sandbox) |
| Webhook Asaas | ✅ `api/asaas-webhook.js` → `api/_asaas.js`: valida token oficial, idempotente por `provider_event_id` (unique index no banco), mapeia eventos de pagamento → status local, guarda eventos desconhecidos sem quebrar. Coberto por testes (`tests/asaas.test.js`) |
| Papéis | ✅ `src/auth/perfis.js`: proprietário(admin)/gerente/operador/visualizador com mapa de permissões completo |
| Permissões aplicadas | ✅ Sidebar/menu, `RotaProtegida`, `navigateWithPermission`, botões das páginas via `hasPermission` |
| Limites por plano | ✅ `canCreateFarm`/`canCreateAnimal`/`canInviteUser` já aplicados em FazendasPage, AnimaisPage e ConfiguracoesPage (convites) |
| Módulos por plano | ✅ `canAccessModule` aplicado na navegação (cenários/indicadores/dashboard premium só nos planos maiores) |
| Tela de bloqueio | ⚠️ `AssinaturaBloqueadaPage` existia, mas com botão "Regularizar" **desabilitado** (sem saída para pagar) |
| Trial | ⚠️ Status `trialing` existia, mas **sem verificação de vencimento** (`trial_ends_at` ignorado) |
| Tolerância de atraso | ⚠️ `past_due` só gerava aviso, **para sempre** (nunca bloqueava) |
| Conta sem assinatura | 🔴 **Acesso liberado por padrão** (`allowMissing`) — decisão da Sprint 28 para o beta, incompatível com venda |
| **Carregamento da assinatura** | 🔴 **`customer_subscriptions` nunca era carregada pelo app** — não estava em `OPERACIONAL_TABLES`, então `getCurrentSubscription()` devolvia `null` para todo mundo e o gate **nunca bloqueava ninguém**, nem contas `canceled`/`blocked` no banco |

**Resumo do que faltava para vender:** o app não lia a assinatura do banco, não bloqueava quem não paga, não expirava trial, não tinha tolerância de atraso com bloqueio, e a tela de bloqueio não tinha caminho de pagamento.

## 2. O que foi implementado nesta sprint

### 2.1 Serviço central de acesso — `src/services/accessControl.js` (novo)
Única fonte de decisão comercial. Exporta:
- `buildAccountAccessGate(subscription, { user, now, subscriptionLoadError })` — núcleo;
- `canAccessApp(user, profile, subscription)` · `isAccountBlocked(...)` · `getBlockedReason(...)` · `getAccountStatus(...)` · `canUseFeature(featureKey, profile, subscription)`;
- `fetchAccountSubscription(session)` — busca a assinatura da conta na nuvem.

### 2.2 Carregamento real da assinatura — `src/hooks/useAccountSubscription.js` (novo)
- Busca `customer_subscriptions` direto do Supabase no boot (fora do sync operacional — a tabela é escrita só pelo checkout/webhook/admin);
- RLS `same_account` garante que **subusuário lê a assinatura do proprietário** → herda o status da conta;
- Recarrega quando a aba recupera o foco (volta do checkout Asaas) e via botão "Já paguei — atualizar";
- O boot do app espera essa resposta antes de decidir (sem flash de bloqueio).

### 2.3 Gate global — `src/App.jsx`
Fluxo após o login: sem sessão → LoginPage · sessão sem assinatura válida → `AssinaturaBloqueadaPage` (sem acesso a Dashboard, Lotes, Pesagens, Financeiro, Estoque, Sanidade, Calendário, Cenários, Relatórios — o gate roda antes de qualquer página operacional) · assinatura válida → app conforme papel/plano.

### 2.4 Tela de conta bloqueada — `src/pages/AssinaturaBloqueadaPage.jsx` (reformulada)
- Título e motivo claros por razão: sem plano · trial vencido · pagamento vencido · cancelada · bloqueada;
- **Proprietário**: botão "Escolher plano"/"Regularizar assinatura" abre o catálogo com **checkout Asaas funcional embutido** (mesma `MinhaAssinaturaPage`);
- **Subusuário**: orientação "peça ao proprietário da conta para regularizar" (sem checkout);
- Botões "Já regularizei — atualizar", "Falar com o suporte" (página pública `/suporte`) e "Sair da conta";
- Nenhuma mensagem técnica exposta.

### 2.5 Papéis e permissões
- Nova permissão `assinatura:gerenciar` — **exclusiva do proprietário** (admin `'*'`);
- Página "Planos e Assinatura" passou de `perfil:ver` (todos) para `assinatura:gerenciar`: gerente/operador/visualizador não veem nem acessam plano/cobrança;
- `canUseFeature` combina as 3 camadas: assinatura da conta → módulo do plano → permissão do papel.

### 2.6 Correção de bug pré-existente
`minhaAssinatura` não constava nos módulos de nenhum plano — cliente pagante em Essencial/Pro/Premium não conseguia navegar até a própria página de assinatura. Adicionado a `MODULES_BASIC` (todos os planos).

### 2.7 Testes — `tests/accessControl.test.js` (novo, 15 testes)
Cobrem os 10 cenários obrigatórios: sem assinatura bloqueia · trial ativo acessa · trial vencido bloqueia · pago acessa · atraso na tolerância acessa com aviso · atraso fora da tolerância bloqueia · cancelada/bloqueada bloqueiam · `internal_test`/override nunca bloqueiam · falha de consulta falha aberto com aviso · subusuário herda status · visualizador não edita · operador lança dados mas não acessa cobrança · módulo fora do plano negado · conta bloqueada nega tudo.

## 3. Modelo comercial oficial

### Status da assinatura (constraint real do banco — 6 valores)
| Status | Significado | Acesso |
|---|---|---|
| `trialing` | Teste ativo | ✅ até `trial_ends_at` (ou `current_period_end`); vencido → 🔴 bloqueia |
| `active` | Paga e ativa | ✅ |
| `past_due` | Pagamento atrasado | ⚠️ acessa com aviso por **3 dias** após `current_period_end`; depois → 🔴 bloqueia |
| `canceled` | Cancelada | 🔴 bloqueia |
| `blocked` | Bloqueada manualmente | 🔴 bloqueia |
| `internal_test` | Piloto/beta interno | ✅ sempre (exceção controlada, concedida via `supabase/sql/grant_pilot_access.sql`) |
| *(sem registro)* | Conta sem plano | 🔴 bloqueia — tela "Escolha um plano" |

Overrides controlados (nunca bloqueiam): campo `override`/`internal_override` na assinatura e e-mails de admin bootstrap (`VITE_HERDON_BOOTSTRAP_ADMIN_EMAILS`).
**Trial padrão: 14 dias** (`TRIAL_PADRAO_DIAS`) · **Tolerância de atraso: 3 dias** (`TOLERANCIA_ATRASO_DIAS`). O status `expired`/`admin_override` não existem como valores no banco (decisão da Sprint 28 mantida): trial vencido é derivado de `trialing` + data, e override é dimensão separada do status.

### Papéis (já existentes, confirmados)
| Papel | Pode |
|---|---|
| Proprietário (`admin`) | Tudo (`*`): fazendas, usuários, financeiro, **plano/assinatura** |
| Gerente | Operação completa + financeiro + funcionários; **não** altera plano |
| Operador | Lança dados de campo (lotes, pesagens, sanidade, estoque, tarefas); **sem** financeiro e **sem** cobrança |
| Visualizador | Só consulta (nenhuma permissão `:editar`/`:excluir`) |

Subusuários herdam o status da assinatura do proprietário via `owner_user_id` (RLS `same_account`). Proprietário bloqueado ⇒ todos os subusuários bloqueados.

### Planos (catálogo real, preços já definidos em sprint anterior)
| Plano | Preço | Fazendas | Animais | Usuários | Módulos |
|---|---|---|---|---|---|
| FUNDADOR | R$ 297/mês | 50 | 10.000 | 50 | todos (`*`) — oferta de lançamento |
| ESSENCIAL | R$ 197/mês | 1 | 300 | 2 | básico (sem financeiro/estoque/sanitário/cenários) |
| PRO | R$ 397/mês | 3 | 1.000 | 5 | básico + financeiro, estoque, sanitário, rel. gerenciais |
| PREMIUM | R$ 697/mês | 10 | 3.000 | 10 | tudo do PRO + pastagens, indicadores, cenários, dash premium |
| ENTERPRISE | Sob consulta | custom | custom | custom | todos |

Limites aplicados: criação de fazenda (FazendasPage), cabeças ativas (AnimaisPage), convites de usuário (ConfiguracoesPage) — com mensagem de upgrade e sem sucesso falso. Módulo fora do plano: navegação bloqueada com mensagem de upgrade (`canAccessModule`).

## 4. Integração Asaas / Webhook — status

- Checkout: cria cliente + assinatura no Asaas (sandbox), grava `customer_subscriptions` (upsert por `provider_subscription_id` — não duplica) e `checkout_sessions`; redireciona para URL de pagamento segura.
- Webhook: valida `asaas-access-token` oficial; idempotente por `provider_event_id`; mapeia pagamento confirmado→`active`, vencido→`past_due`, cancelado→`canceled`; eventos desconhecidos são armazenados e ignorados com segurança; não falha silenciosamente (registra em `billing_events`).
- Secrets só no servidor (`ASAAS_API_KEY`, `ASAAS_WEBHOOK_TOKEN` em env do Vercel; teste automatizado garante que nomes privados não aparecem no bundle do frontend).
- **Ambiente atual: sandbox** (`ASAAS_ENV=sandbox`). Produção exige configurar a chave de produção e o webhook no painel Asaas (checklist §7).

## 5. Segurança real (frontend × banco)

Nível implementado nesta sprint = **opção mínima para venda inicial** (documentada):
- Bloqueio global forte no frontend (gate antes de qualquer página operacional);
- RLS continua isolando contas por `owner_user_id` (auditada em 2026-07-02 — 31/31 tabelas);
- Limites de plano validados nos fluxos de criação do app.

⚠️ **Limitação conhecida (risco aceito e documentado):** um usuário bloqueado tecnicamente ainda consegue escrever nas tabelas da própria conta via Supabase client (o RLS isola contas, mas não valida assinatura). Não vaza dados de terceiros em nenhuma hipótese. Evolução recomendada (sprint futura, com diagnóstico): função `app_has_active_subscription()` incorporada às policies de INSERT/UPDATE/DELETE das tabelas operacionais. **Nenhum RLS foi alterado nesta sprint** (regra do escopo).

## 6. Riscos antes de vender

1. **Asaas em sandbox** — nenhuma cobrança real acontece até configurar produção (chave, webhook e URL no painel Asaas). É o principal pendente.
2. Escrita direta via API por conta bloqueada (ver §5) — baixo impacto (dados da própria conta), mitigar com RLS de assinatura em sprint futura.
3. Trial de 14 dias só passa a valer para assinaturas com `trial_ends_at`/`current_period_end` preenchidos — trial legado sem data não expira (documentado; hoje não há nenhum no banco).
4. Falha de rede na consulta da assinatura falha aberto com aviso (para não travar o produtor no campo) — janela pequena e registrada.
5. Contas de teste existentes **sem** assinatura serão bloqueadas no próximo login — comportamento correto para venda; para manter acesso de teste, conceder `internal_test` via `supabase/sql/grant_pilot_access.sql` (exceção controlada). O e-mail bootstrap do admin interno nunca bloqueia.
6. Downgrade/cancelamento continuam manuais (via suporte) — documentado desde a Sprint 26/28.

## 7. Checklist para vender

- [x] Conta sem plano é bloqueada com tela clara e caminho de pagamento
- [x] Trial controlado (14 dias) e trial vencido bloqueia
- [x] Tolerância de atraso (3 dias) e bloqueio após
- [x] Papéis e permissões (proprietário/gerente/operador/visualizador)
- [x] Subusuário herda status do proprietário
- [x] Limites por plano (fazendas/animais/usuários) e módulos por plano
- [x] Tela de planos com preços reais e checkout
- [x] Login profissional, Termos, Privacidade, Cobrança, Suporte (páginas públicas)
- [x] Secrets Asaas fora do frontend
- [ ] **Trocar Asaas para produção** (chave + webhook production no painel)
- [ ] Teste de pagamento real ponta a ponta (checklist §8)
- [ ] (Recomendado) RLS de assinatura para escrita operacional

## 8. Checklist de testes de pagamento (manual, antes do primeiro cliente)

1. Cadastro novo → cai na tela "Escolha um plano" (não vê Dashboard).
2. Escolher plano → completar dados → redireciona para checkout Asaas.
3. Pagar (sandbox: cartão de teste) → webhook confirma → "Já paguei — atualizar" → app libera.
4. No painel Asaas, vencer/cancelar a cobrança → webhook → app avisa (`past_due`) e bloqueia após 3 dias / bloqueia (`canceled`).
5. Convidar subusuário (operador) → acessa conforme papel; bloquear o dono → subusuário bloqueado.
6. Visualizador: nenhum botão de criar/editar responde.
7. Conferir `billing_events` sem eventos com `event_status` de erro recorrente.

## 9. Conclusão — pode vender?

**Quase.** O produto está comercialmente completo no app: bloqueio por assinatura funciona de ponta a ponta (era o item crítico — o app sequer lia a assinatura antes desta sprint), trial e tolerância controlados, papéis e limites aplicados, tela de bloqueio com checkout, e nenhuma mensagem técnica para o cliente.

O único bloqueador real para cobrar dinheiro de verdade é **virar a chave do Asaas para produção e rodar o teste de pagamento ponta a ponta** (§7/§8). Com isso feito, o HERDON está pronto para venda controlada (primeiros clientes acompanhados de perto).

## 10. Go-Live Comercial / Asaas (validação de 2026-07-02)

Sprint de go-live executada sem conta logada e sem tocar no login — validou tudo que é automatizável; o clique real de checkout/pagamento ficou como roteiro manual (§10.4).

### 10.1 Deploy em produção — ✅ validado
- Deploy do commit `e9c8917` (gate comercial): **READY** em produção no Vercel (`dpl_3pEPtAZtjRhyjBuWQHEMtuYMUTk7`), domínio **herdonapp.com.br**.
- Login abre normalmente (HTTP 200, título e página corretos).
- **Nenhum secret Asaas no bundle do frontend** — varridos ~496 KB de JS de produção: `ASAAS_API_KEY`, `ASAAS_WEBHOOK_TOKEN` e prefixo de chave `aact_` ausentes. Supabase URL correta (`ljpiszxicmmuefbiixui`); checkout chama a rota server-side `/api/asaas-create-subscription`.
- Funções serverless vivas em produção: `asaas-webhook`, `asaas-create-subscription`, `asaas-create-customer` respondem **405** a GET (só aceitam POST).
- **Webhook valida token em produção**: POST sem `asaas-access-token` → **401** (prova que a validação e o secret estão ativos no ambiente).

### 10.2 Ciclo de status validado com o código real do gate — ✅
Simulação executada com o `accessControl.js` real, usando a assinatura real do banco e variantes (não mocks de lógica):

| Cenário | Resultado |
|---|---|
| Conta sem assinatura | 🔴 BLOQUEIA (`sem_plano`) |
| Assinatura real do banco (`internal_test`/fundador) | ✅ LIBERA |
| Trial ativo (vence em 10 dias) | ✅ LIBERA |
| Trial vencido (há 1 dia) | 🔴 BLOQUEIA (`trial_vencido`) |
| `active` (como o webhook grava após pagamento) | ✅ LIBERA |
| `past_due` há 1 dia (tolerância 3) | ⚠️ LIBERA com aviso |
| `past_due` há 5 dias | 🔴 BLOQUEIA (`pagamento_vencido`) |
| `canceled` / `blocked` | 🔴 BLOQUEIAM (motivos corretos) |
| Subusuário (gerente/operador/visualizador) com dono ativo | ✅ acessa conforme papel |
| Subusuário com dono bloqueado | 🔴 bloqueado (herda status) |
| Papéis: só admin tem `assinatura:gerenciar`; operador edita pesagens mas não vê financeiro; visualizador não edita nada | ✅ |
| Limites: essencial não cria 2ª fazenda nem 3º usuário; cenários negado no essencial e liberado no premium; upgrade p/ pro libera 2ª fazenda | ✅ |

O mesmo comportamento está travado pelos testes automatizados (652 passando, 15 deles do gate).

### 10.3 O que o banco de produção mostra
- 19 usuários / 19 profiles (trigger de profile OK), 1 assinatura (`internal_test`).
- **`billing_events` = 0 e `checkout_sessions` = 0** — nenhum checkout foi completado e nenhum webhook Asaas real foi recebido até hoje. O ciclo ponta a ponta com o Asaas ainda não aconteceu em nenhum ambiente.
- **Ambiente Asaas: sandbox** (`ASAAS_ENV` padrão; produção nunca configurada — decisão registrada na Sprint 28). A troca para produção exige autorização do proprietário e ação no painel Asaas + Vercel.

### 10.4 Roteiro manual obrigatório antes do primeiro cliente (humano, ~30 min)
1. **Sandbox ponta a ponta:** criar conta nova em herdonapp.com.br → confirmar tela "Escolha um plano" (sem Dashboard) → escolher plano → completar dados → pagar no checkout sandbox (cartão de teste Asaas) → conferir webhook recebido (`billing_events` ganha linha; `customer_subscriptions.status = 'active'`) → "Já paguei — atualizar" → Dashboard liberado.
2. No painel Asaas sandbox: vencer a cobrança → app avisa (`past_due`) e bloqueia após 3 dias; cancelar → app bloqueia com motivo.
3. **Produção:** trocar `ASAAS_API_KEY`/`ASAAS_ENV=production` no Vercel, cadastrar webhook de produção com token no painel Asaas, repetir o passo 1 com pagamento real de baixo valor, estornar/cancelar em seguida.
4. Não usar `grant_pilot_access.sql` para cliente real — somente conta interna/piloto autorizado.

### 10.5 Conclusão do go-live
- **App comercial: validado.** Bloqueio, trial, tolerância, cancelamento, herança de subusuário, papéis e limites — tudo confirmado com código real + produção no ar sem secrets expostos e webhook autenticando.
- **Pode vender?** Somente após o roteiro §10.4 (checkout sandbox ponta a ponta e depois a virada para produção Asaas). Esses passos exigem conta real e painel Asaas — não são automatizáveis por esta sessão. Até lá: **pronto para piloto controlado; venda real pendente apenas do teste de pagamento ponta a ponta.**

## 11. Validação desta sprint

- Lint: ✅ · Build: ✅ · Testes: ✅ (suíte completa incluindo os 15 novos de `accessControl`)
- RLS alterado: **não** · Migration criada: **não** · Dados alterados/apagados: **não**
- Arquivos: `src/services/accessControl.js` (novo), `src/hooks/useAccountSubscription.js` (novo), `src/App.jsx`, `src/pages/AssinaturaBloqueadaPage.jsx`, `src/auth/perfis.js`, `src/services/subscriptions.js` (1 linha), `src/services/userAccess.js` (export da exceção), `tests/accessControl.test.js` (novo), `tests/subscription-surface.test.js` (asserção atualizada).

## 12. Sprint 6 — Gestão de equipe (2026-07-04)

**Gestão de equipe implementada**: nova página dedicada `src/pages/EquipePage.jsx` ("Equipe e Acessos" no menu) substitui a antiga aba "Usuários e Acessos" de Configurações — proprietário agora convida (gerente/operador/visualizador), altera papel e remove acesso de membros, com salvaguardas para nunca deixar a conta sem nenhum administrador. Detalhamento completo em [`docs/EQUIPE_PERMISSOES_HERDON.md`](EQUIPE_PERMISSOES_HERDON.md).

**Por que importa para venda real**: os planos já vendem "N usuários" (`canInviteUser`, limite por plano — §3 acima), mas até esta sprint não havia uma forma real de o proprietário adicionar/remover pessoas da conta fora de um fallback local. Equipe é um recurso que aparece na tela de planos e precisa funcionar de ponta a ponta para justificar o preço dos planos com mais de 1 usuário (Pro/Premium/Fundador).

**Subusuários continuam herdando o status comercial do proprietário** (`owner_user_id` / RLS `same_account`, sem mudança nesta sprint) — dono bloqueado ⇒ toda a equipe bloqueada para escrita, independente do papel. A única mudança de permissão desta sprint foi restringir `'acessos:gerenciar'` a proprietário/admin (gerente perdeu essa permissão, tanto na matriz do app quanto na função `app_can_manage_account` do banco) — reforça, não afrouxa, o modelo comercial já descrito acima.
