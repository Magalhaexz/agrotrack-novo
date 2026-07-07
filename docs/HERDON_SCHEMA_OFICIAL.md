# HERDON — Schema Oficial (Supabase, schema `public`)

Visão resumida e confiável do banco, gerada via auditoria estrutural (Sprint 17, `mcp__supabase__list_tables`/`execute_sql` contra `information_schema`/`pg_policies`/`pg_indexes` — sem consulta a dados reais). **35 tabelas**, todas com RLS habilitado. Fonte de verdade para colunas completas: `supabase/migrations/*.sql` + inspeção direta do projeto (`mcp__supabase__list_tables`); este documento lista só o que importa para orientação, não o schema inteiro.

Convenção de RLS predominante: par de policies `_owner` (`owner_user_id = auth.uid()`) + `_same_account` (`app_is_same_account(owner_user_id)`) por comando. Tabelas mais novas usam só `_same_account` (documentado por tabela abaixo). `owner_user_id` é sempre o dono da **conta** (não necessariamente quem criou a linha) — `app_current_owner_user_id()` resolve subusuários para o dono.

## 1. Autenticação / conta

### `profiles`
Identidade ligada a `auth.users`, uma linha por usuário autenticado. Papel de acesso (`perfil`: admin/gerente/operador/visualizador) e `status` (ativo/removido, Sprint 6 — permite remover acesso sem apagar linha, já que não há policy de DELETE de propósito).
- **Chaves:** `id` = `auth.users.id`. `owner_user_id` aponta para o dono da conta (subusuário) ou para si mesmo (dono).
- **RLS:** mistura de nomes — `profiles_select_same_account`/`profiles_insert_self_or_manager`/`profiles_update_self_or_manager` (padrão do projeto) + `"Users can view own profile"`/`"Users can update own profile basics"` (nomenclatura antiga, em inglês) coexistindo. Sem DELETE.
- **Observação:** tabela mais antiga do projeto — única com nomenclatura de policy fora do padrão snake_case; funcional, registrado como limpeza P3 no plano de reconciliação.

### `invites`
Convite pendente de acesso (email + perfil sugerido), consumido ao aceitar (`used_by`/`used_at`).
- **RLS:** `invites_*_same_account_managers` — só quem já gerencia a conta (`app_can_manage_account`) cria/lê/edita convites.

### `usuarios`
Tabela tipo roster/CRM (`user_ref` opcionalmente aponta para `auth.users`), coexiste com `profiles`.
- **Observação:** BM-12 do backlog — não fica claro qual das duas é autoritativa para papel/perfil; nenhuma decisão tomada nesta sprint.

## 2. Fazendas / Lotes / Animais

### `fazendas`
Unidade operacional (propriedade rural). `owner_user_id` sempre o dono da conta.
- **Observação:** colunas duplicadas legadas convivendo com as atuais (`responsavel`/`proprietario`, `hectares`/`area`/`area_total_ha`, `capacidade_lotacao`/`capacidade_ua`) — sobra de evolução incremental, não tratado nesta sprint.

### `lotes`
Núcleo do domínio operacional — grupo de animais em manejo conjunto.
- **Chaves:** `faz_id` (bigint) → `fazendas.id`. `pastagem_id` (uuid) → `pastagens.id` (FK criada na Sprint 18.1/migration `20260618000000`).
- **Observação:** 3 colunas de peso atual (`p_at`, `peso_atual`, `peso_medio_atual` — BM-09) e uso de `faz_id` em vez de `fazenda_id` (BM-07, único lugar do schema com essa grafia para a FK principal de fazenda).

### `animais`
Registro individual ou de grupo sintético (auto-patch de `lotes`, ver `docs/SPRINT15_INTEGRIDADE_ESTOQUE_SANIDADE.md`) vinculado a um lote.
- **Chaves:** `lote_id` → `lotes.id` (indexado). `fazenda_id` (bigint) presente, ao contrário de `lotes`/`pastagens` que usam `faz_id`.

### `pastagens`
Pasto/piquete, com capacidade de suporte (UA/ha) e dados de arrendamento.
- **Chaves:** `id` é `uuid` (diferente de `lotes`/`fazendas`, que são `bigint`). Tem **as duas** colunas de fazenda: `fazenda_id` (uuid) e `faz_id` (bigint) — BM-07, achado mais crítico de naming do schema.

### `lote_pastagens_historico`
Histórico de movimentação de lote entre pastos (Sprint 21/migration `20260619113446`), escrito via função `mover_lote_para_pasto` (SECURITY INVOKER).
- **Chaves:** `lote_id` → `lotes.id`, `faz_id` → `fazendas.id`, `pastagem_origem_id`/`pastagem_destino_id` → `pastagens.id` (agora indexadas, Sprint 17).
- **RLS:** par `_own`/`_same_account` completo.

## 3. Pesagens / Desempenho

### `pesagens`
Peso registrado por lote (e opcionalmente por `animal_id`), fonte do cálculo de GMD.
- **Chaves:** `lote_id` → `lotes.id` (índice composto `lote_id, data DESC` para consulta de série temporal).

## 4. Financeiro / Custos

### `movimentacoes_financeiras`
Lançamento financeiro (entrada/saída), com campos de status/vencimento/competência adicionados na Sprint 10 (`status`, `data_competencia`, `data_vencimento`, `data_pagamento` — todos opcionais, NULL = comportamento legado "realizado").
- **Chaves:** `lote_id` → `lotes.id`, `fazenda_id` (bigint) direto (não via `faz_id`). Padrão genérico `origem`/`origem_tipo`/`origem_id` para rastrear a origem do lançamento (ex.: baixa automática de Sanidade→Financeiro).

### `custos`
Tabela legada de custo por lote, coexiste com `movimentacoes_financeiras` (reconciliação parcial via `origem`/`origem_id`, ver `docs/SPRINT14_CONSOLIDACAO_ARROBA.md`).
- **Observação:** nomes abreviados (`cat`, `desc`, `val`) em vez de `categoria`/`descricao`/`valor` — único ponto do schema com essa abreviação, ao lado do equivalente completo em `movimentacoes_financeiras`.

## 5. Estoque

### `estoque`
Item de estoque (insumo/produto), saldo em `quantidade_atual` (coluna oficial) + `quantidade` (legada, mantida em paralelo por compatibilidade).
- **Observação:** `alerta_dias_antes` existe na tabela (usado pelo alerta de "vencendo em breve", BM-04, já resolvido em sprint anterior).

### `movimentacoes_estoque`
Entrada/saída/consumo/ajuste de item de estoque. Padrão genérico `origem`/`origem_tipo`/`origem_id` — usado pela integração Sanidade→Estoque (Sprint 15) e demais módulos.
- **Chaves:** `item_estoque_id` → `estoque.id`, `lote_id` → `lotes.id`.
- **Índice novo (Sprint 17):** `(origem_tipo, origem_id)`, antes ausente apesar de ser a consulta mais comum desse padrão.

### `suplementacao` / `consumo_suplementacao`
Dieta/plano de suplementação por lote e consumo diário calculado.
- **Chaves:** `suplementacao.produto_id` → `estoque.id`; `consumo_suplementacao.item_estoque_id` → `estoque.id`, `dieta_id` referencia `suplementacao.id` (sem FK declarada — `ref_id`/`dieta_id` genéricos).

## 6. Sanidade

### `sanitario`
Registro de manejo sanitário (vacina, vermífugo, etc.) por lote, com produto/quantidade guardados em `metadata` (jsonb) — sem coluna própria por decisão da Sprint 15 (reaproveitar padrão já existente).
- **Chaves:** `lote_id` → `lotes.id`, `funcionario_responsavel_id` → `funcionarios.id`, `rotina_automatica_id` → `rotinas.id` (agora indexada, Sprint 17).
- **Coluna notável:** `data_fim_carencia` (Sprint 10) — usada pelo Motor Único de Alertas para carência ativa.

### `rotinas`
Tarefa/rotina operacional recorrente, pode ter sido gerada automaticamente por um registro sanitário (`origem_sanitario_id`).

## 7. Alertas

Três sistemas coexistem — ver `docs/SPRINT16_CENTRAL_ALERTAS_UNICA.md` para o histórico completo da decisão.

### `alertas_resolvidos` / `alertas_adiados`
Modelo legado binário ("existe linha = resolvido/adiado"), keyed por `ack_key`/`chave` heurístico. Usado só pelo painel do header e pela aba "Todos os alertas" do Dashboard (`utils/alerts.js`) — documentado como depreciado, não removido.

### `alertas_tratativas`
Modelo novo (Sprint 16), 4 status (`em_analise`/`resolvido`/`adiado`/`ignorado`), keyed por `alerta_id` (id estável de `gerarAlertasUnificados`). É a persistência oficial da Central de Alertas (`AlertasPage.jsx`).
- **RLS:** só `_same_account` (sem par `_owner` duplicado — padrão mais novo, deliberado).
- **Índice novo (Sprint 17):** `fazenda_id` (FK sem índice líder até esta sprint).

## 8. Telegram / Notificações

### `telegram_connections`
Uma conexão ativa por usuário HERDON (`user_id UNIQUE`), com preferências de notificação por tipo.
- **RLS:** só `_own` (por `user_id`, não `owner_user_id`) — modelo intencionalmente diferente do resto do schema: conexão é pessoal, não compartilhada com a conta. Sem policy de INSERT/DELETE para `authenticated` (só service role, via webhook).

### `telegram_connection_codes`
Código temporário de pareamento (expira, usado uma vez). RLS habilitado, **sem nenhuma policy** — só service role acessa (INFO no advisor, intencional).

### `telegram_notification_logs`
Trilha de envio de notificação (sucesso/falha), somente server-side. Mesmo padrão de RLS sem policy de `telegram_connection_codes`.

## 9. SaaS / Assinatura

### `subscription_plans`
Catálogo público de planos (Essencial/Pro/Premium/Enterprise). Única tabela do schema com policy `SELECT USING (true)` — correto, não é dado de conta.

### `customer_subscriptions`
Assinatura ativa por conta, integrada com Asaas (ainda em sandbox — BM-29).
- **Observação:** tem **as duas** colunas de fazenda (`farm_id` bigint + `fazenda_id` bigint, mesmo tipo desta vez — BM-08), ambas agora indexadas (Sprint 17).

### `billing_events` / `checkout_sessions`
Eventos de webhook e sessões de checkout do provedor de pagamento.
- **Observação:** essas 4 tabelas de billing são as únicas do schema nomeadas em inglês — reflexo da integração Asaas "colada por fora" de um schema majoritariamente em português.

## 10. Outros módulos operacionais

- **`funcionarios`** — cadastro de equipe (ver duplicação de conceito com `equipeAcessos` no frontend, BM-25 — não é duplicação de tabela, é de tela).
- **`tarefas`** — lista de tarefas/pendências, com `responsavel_id` → `funcionarios.id`.
- **`configuracoes`** — 1 linha por conta (`owner_user_id UNIQUE`), preferências gerais/notificações em jsonb.
- **`auditoria`** — trilha de ações sensíveis (quem fez o quê, quando).
- **`eventos_operacionais`** — linha do tempo unificada de eventos (agenda/calendário operacional), com padrão genérico `origem`/`origem_id`. Todas as 3 FKs (`fazenda_id`, `lote_id`, `funcionario_id`) e o par `origem`/`origem_id` agora indexados (Sprint 17 — não tinha nenhum índice de FK antes).
- **`cenarios`** / **`cenario_eventos`** — Simulador de cenários (projeção de resultado), `id` em `uuid`. Trigger `set_cenarios_owner`/`set_cenario_eventos_owner` preenche `owner_user_id`/`created_by`/`updated_by` automaticamente (search_path corrigido nesta sprint).
- **`movimentacoes_animais`** — compra/venda/transferência de animais entre lotes, com `destino_lote_id` para transferência interna.

## Índices e RLS — resumo pós-Sprint 17

- FKs sem índice líder: **0** (13 corrigidas nesta sprint; confirmar novas conforme o schema evoluir).
- Funções com `search_path` mutável: **0** (5 corrigidas nesta sprint).
- Tabelas com RLS habilitado sem `FORCE`: **0** (4 corrigidas nesta sprint: `telegram_connections`, `telegram_connection_codes`, `telegram_notification_logs`, `alertas_tratativas`).
- Índices duplicados (mesma coluna, nomes diferentes): **~40**, não removidos — ver plano de reconciliação.
- Policies `_owner`+`_same_account` duplicadas: **31 de 35 tabelas**, aceito como padrão do projeto (dívida de performance documentada, não de segurança) — ver BM-10.
