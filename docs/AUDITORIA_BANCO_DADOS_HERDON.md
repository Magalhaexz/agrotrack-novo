# Auditoria do Banco de Dados HERDON

## 1. Dados da auditoria

- **Data:** 2026-07-02
- **Ambiente auditado:** Supabase produção — projeto `ljpiszxicmmuefbiixui`
- **Método:** somente leitura (SQL via MCP, advisors e logs do Supabase). Nenhuma conta logada, nenhuma tela testada, nenhum dado criado/alterado pelo app.
- **Alterações no banco:** NENHUMA. Nenhuma migration, nenhum RLS alterado, nenhum trigger alterado, nenhum dado apagado.

## 2. Tabelas encontradas (31 tabelas públicas)

| Tabela | Registros | Situação |
|---|---|---|
| alertas_adiados | 2 | Em uso |
| alertas_resolvidos | 12 | Em uso |
| animais | 8 | Em uso |
| auditoria | 0 | Vazia (estrutura pronta) |
| billing_events | 0 | Vazia (Asaas — fora do escopo) |
| cenario_eventos | 0 | Vazia (estrutura pronta) |
| cenarios | 2 | Em uso |
| checkout_sessions | 0 | Vazia (Asaas — fora do escopo) |
| configuracoes | 0 | Vazia |
| consumo_suplementacao | 2 | Em uso — **fonte oficial de suplementação** |
| customer_subscriptions | 1 | Em uso (planos — fora do escopo) |
| custos | 2 | Semi-legada (2 registros antigos de aquisição, maio/2026) |
| estoque | 3 | Em uso |
| eventos_operacionais | 0 | Vazia (calendário — estrutura pronta) |
| fazendas | 6 | Em uso |
| funcionarios | 3 | Em uso |
| invites | 0 | Vazia |
| lote_pastagens_historico | 1 | Em uso |
| lotes | 9 | Em uso |
| movimentacoes_animais | 0 | Vazia (estrutura pronta) |
| movimentacoes_estoque | 0 | Vazia (estrutura pronta) |
| movimentacoes_financeiras | 4 | Em uso — **fonte oficial do financeiro** |
| pastagens | 7 | Em uso |
| pesagens | 11 | Em uso |
| profiles | 19 | Em uso |
| rotinas | 0 | Vazia |
| sanitario | 1 | Em uso |
| subscription_plans | 5 | Em uso (catálogo de planos) |
| suplementacao | 0 | **Legada — vazia, sem uso** |
| tarefas | 1 | Em uso |
| usuarios | 0 | Legada/redundante com profiles |

## 3. Usuários e profiles

- **auth.users:** 19
- **public.profiles:** 19
- **Usuários sem profile:** 0 ✅
- **Profiles sem auth.user:** 0 ✅
- **Profiles com owner_user_id apontando para profile inexistente:** 0 ✅
- **Subusuários:** 0 (todos os profiles são contas próprias)

⚠️ **Achado (Médio):** 7 dos 19 profiles têm `owner_user_id = NULL` (contas criadas entre 24/04 e 08/05/2026, antes da versão atual do trigger). O RLS continua funcionando para elas porque `app_current_owner_user_id()` faz `coalesce(owner_user_id, auth.uid())`, mas é inconsistente com o padrão atual (proprietário aponta para si mesmo). Uma delas (`magalhaesh617@...`) possui 2 fazendas e opera normalmente via fallback. 5 das 7 têm perfil `visualizador`.

- **Recomendação futura (com autorização):** backfill `update profiles set owner_user_id = id where owner_user_id is null`.

## 4. RLS

- **Todas as 31 tabelas têm RLS habilitado.** ✅
- **Nenhuma tabela com RLS ligado e zero policies.** ✅
- Nenhuma tabela sensível exposta. O advisor de segurança do Supabase não reportou nenhum erro de RLS.

## 5. Policies

Padrão dominante: pares de policies por comando —
- `*_owner`: `owner_user_id = auth.uid()`
- `*_same_account`: `app_is_same_account(owner_user_id)` (compara com `app_current_owner_user_id()`, que resolve o dono da conta via profile)

Tabelas de billing (`billing_events`, `checkout_sessions`, `customer_subscriptions`, `invites`) usam `app_can_manage_account()` (exige papel proprietario/gerente/admin) para escrita — correto.
`subscription_plans`: SELECT liberado para authenticated (catálogo) e sem policy de escrita (escrita bloqueada) — correto.
`profiles`: INSERT/UPDATE/SELECT com regras self-or-manager coerentes; sem policy de DELETE (bloqueado) — correto.
`auditoria`: apenas SELECT/INSERT (sem UPDATE/DELETE) — correto para trilha de auditoria.

Observações (não críticas):
1. **(Médio)** `eventos_operacionais` tem SOMENTE policies `_owner` (sem `_same_account`), diferente de todas as outras tabelas operacionais. Hoje não há subusuários, então não há impacto real; quando houver subusuário, ele não verá/gravará eventos do calendário da conta (INSERT seria negado se o app enviar `owner_user_id` do dono). Alinhar ao padrão `same_account` antes de ativar subusuários.
2. **(Baixo)** As policies `_owner` são redundantes onde existe `_same_account` (a segunda cobre a primeira, pois sem subusuários `app_current_owner_user_id() = auth.uid()`).
3. **(Baixo)** `suplementacao_update_same_account` e `cenario_eventos_update_same_account` não têm `WITH CHECK` explícito (o Postgres aplica o `USING` como fallback — comportamento seguro, apenas inconsistente com as demais).
4. **(Baixo)** O papel `visualizador` não é diferenciado nas policies operacionais (pode escrever via `same_account`); o controle de papel é feito no app. Registrado para endurecimento futuro.

## 6. Triggers e funções

- **Trigger de criação de profile:** `on_auth_user_created` em `auth.users` → `public.handle_new_user_profile()`. Ativo (`tgenabled = O`). ✅
  - Cria profile para qualquer método de signup (e-mail e Google — resolve nome de `raw_user_meta_data`: `nome`/`name`/`full_name`/prefixo do e-mail).
  - Usa `perfil = 'admin'` (dentro da constraint `profiles_perfil_check`) e `owner_user_id = new.id`. ✅
  - `on conflict (id) do update` — não duplica. ✅
  - Tem `exception when others → raise warning + return new`: não bloqueia o signup, mas **engole o erro** (fica só warning no log do Postgres). Registrado como risco médio de diagnóstico (não de perda de dados imediata — hoje 19/19 usuários têm profile).
- ⚠️ **Achado (Alto — latente, sem impacto atual):** existe uma função órfã `public.handle_new_user()` (não ligada a nenhum trigger) que insere `perfil = 'PROPRIETARIO'` — **valor fora da constraint** `profiles_perfil_check ('admin','gerente','operador','visualizador')`. Se essa função for religada a um trigger no futuro, o INSERT de profile falhará silenciosamente (exception engolida) e voltaria o problema de "usuário sem profile". Recomendação: remover ou corrigir a função em sprint autorizado.
- **Triggers de updated_at:** presentes em todas as tabelas. **(Médio/Baixo)** a maioria das tabelas tem DOIS triggers redundantes (`set_*_updated_at` → `set_current_timestamp_updated_at()` e `trg_*_updated_at` → `set_updated_at()`). Ambos fazem a mesma coisa; não causa bug, só trabalho duplicado. Limpeza futura.
- **Triggers de owner:** `set_cenarios_owner`, `set_cenario_eventos_owner`, `set_pastagens_owner` preenchem `owner_user_id`/`created_by` com `auth.uid()` quando nulos — corretos.
- **Não existem triggers financeiros automáticos no banco** (espelhamento custo→movimentação é feito pelo app). Nenhum risco de duplicação automática por trigger.

## 7. Constraints, PKs e FKs

- **Todas as 31 tabelas têm PRIMARY KEY.** ✅
- **Todas as FKs estão validadas** (`convalidated = true`, zero `NOT VALID`). ✅
- Padrão de FKs correto e consistente:
  - `owner_user_id → auth.users(id) ON DELETE CASCADE` em todas as tabelas operacionais;
  - FKs operacionais (`lote_id`, `faz_id`/`fazenda_id`, `pastagem_id`, `funcionario_id`, `item_estoque_id`, etc.) com `ON DELETE SET NULL` — evita perda em cascata de registros históricos;
  - `profiles.id → auth.users(id) ON DELETE CASCADE`;
  - billing: `plan_code → subscription_plans ON UPDATE CASCADE`.
- CHECK constraints coerentes: `profiles.perfil`, `invites.perfil`, `movimentacoes_financeiras.status`, `customer_subscriptions.status`, `checkout_sessions.status`, `subscription_plans.status`, `lote_pastagens_historico.quantidade_cabecas > 0`.
- `metadata jsonb` tem default `'{}'` em todas as tabelas que o possuem. ✅
- **(Médio)** `sanitario.rotina_automatica_id` tem **duas FKs idênticas** (`sanitario_rotina_automatica_fk` e `sanitario_rotina_automatica_id_fkey`). Inofensivo, mas deve ser deduplicado em limpeza futura.
- **(Médio)** Tipos duplicados/incompatíveis por legado:
  - `pastagens.fazenda_id` é **uuid** (legado, sem FK) enquanto `pastagens.faz_id` é **bigint** com FK para `fazendas.id` — a coluna oficial é `faz_id`;
  - `cenarios.fazenda_id` e `cenario_eventos.fazenda_id` são uuid (sem FK para `fazendas`, que usa bigint) — hoje sem dados inconsistentes;
  - `estoque` tem pares de colunas duplicadas (`produto`/`nome`, `quantidade_atual`/`quantidade`, `unidade`/`unidade_medida`, `valor_unitario`/`custo_unitario`/`preco_unitario`, `data_validade`/`validade`, `observacoes`/`obs`) — nos 3 registros atuais os pares estão sincronizados;
  - `fazendas` idem (`area_total_ha`/`hectares`/`area`, `capacidade_ua`/`capacidade_lotacao`, etc.).

## 8. Registros órfãos — ZERO ✅

Verificado (todas as contagens = 0):
- pesagens sem lote válido; sanitário sem lote; consumo_suplementacao sem lote; eventos sem lote/fazenda; custos sem lote; movimentações financeiras sem lote; animais sem lote válido; lotes com fazenda inválida; pastagens com fazenda inválida; lotes com pastagem inválida; cenários com lote inválido.

## 9. owner_user_id — ZERO problemas ✅

Em 18 tabelas operacionais verificadas: **0 registros** com `owner_user_id` nulo e **0 registros** com `owner_user_id` apontando para profile inexistente. Isolamento por proprietário íntegro nos dados.

## 10. Tabelas legadas e duplicadas

| Tabela | Status | Veredito |
|---|---|---|
| `suplementacao` | 0 registros, nenhum insert | **Confirmada legada.** `consumo_suplementacao` é a fonte oficial. |
| `custos` | 2 registros (aquisição de lotes, maio/2026) | Semi-legada. `movimentacoes_financeiras` é a fonte oficial. Os 2 registros **não** têm espelho em movimentações (verificado: zero matches por owner+lote+valor) — **não há duplicidade financeira**. O app já trata custo legado sem espelho (testes M3 passando). |
| `usuarios` | 0 registros | Legada/redundante com `profiles`. |
| `configuracoes`, `auditoria`, `rotinas`, `invites`, `movimentacoes_animais`, `movimentacoes_estoque`, `cenario_eventos`, `eventos_operacionais` | 0 registros | Estruturas prontas, ainda sem uso — não são problema. |

## 11. Financeiro (`movimentacoes_financeiras`)

- 4 movimentações, todas `despesa`, valores positivos. ✅
- **0 valores nulos/negativos/zero.** ✅
- **0 tipos inválidos.** ✅
- **0 duplicidades** (group by owner+lote+tipo+categoria+valor+data). ✅
- Integração com suplementação funcionando: movimentações 2 e 4 têm `origem_tipo='consumo_suplementacao'` + `origem_id` apontando para os consumos 1 e 2. ✅
- `movimentacoes_financeiras` confirmada como fonte oficial.

## 12. Suplementação

- `consumo_suplementacao`: 2 registros, ambos com `lote_id` válido (20), `item_estoque_id` válidos (1 e 2), quantidades coerentes (colunas `quantidade`/`qtd_total`/`quantidade_total` sincronizadas), com espelho financeiro correto. ✅
- `suplementacao`: 0 registros — permanece legada, sem receber dados. ✅

## 13. Manejo sanitário composto

- 1 registro em `sanitario` (tipo `manejo`, lote 20, data 25/06/2026, origem `modo_campo_offline` com `idempotency_key` no metadata).
- Nenhum registro com `grupo_manejo_id` ainda (a feature de múltiplos procedimentos é recente; registro existente é legado válido — critério atendido). ✅
- **0 registros com `item_estoque_id` inválido no metadata.** ✅
- Nenhum metadata quebrado. ✅

## 14. Calendário operacional (`eventos_operacionais`)

- 0 registros — nada a validar em dados. Estrutura correta (titulo NOT NULL, FKs para lotes/fazendas/funcionarios com SET NULL, índices em owner e data).
- Ressalva de policy descrita na seção 5 (sem `same_account`).

## 15. Cenários

- 2 cenários, ambos com owner válido, metadata não nulo, timestamps corretos. ✅
- `cenario_eventos` vazio, com trigger de owner e FK `ON DELETE CASCADE` para o cenário. ✅

## 16. Pesagens / GMD

- 11 pesagens: **0 sem lote, 0 com peso ≤ 0, 0 sem data.** ✅
- Distribuição por lote: lote 17 (5 pesagens, mar–mai/2024), lote 18 (3, mar/2024), lote 20 (2, mai–jun/2026), lote 21 (1, jun/2026). Dados permitem cálculo de GMD (múltiplas pesagens por lote com datas distintas). ✅
- **(Baixo)** Lotes 17/18 têm pesagens datadas de 2024 — aparentam dados de teste antigos; inofensivo.

## 17. Estoque

- 3 itens, todos categoria "Nutrição / Alimentação", unidade kg. **0 quantidades negativas, 0 nomes vazios**, pares `nome`/`produto` e `quantidade`/`quantidade_atual` sincronizados. ✅
- Baixa de estoque por consumo consistente (item 1: 250→200 após consumo de 50; item 2: 250→245 após consumo de 5).

## 18. Logs recentes (últimas 24h)

- **Postgres:** apenas `LOG` de conexões e checkpoints. **Nenhum ERROR/FATAL, nenhuma FK violation (23503), cast inválido (22P02), not null (23502), unique (23505), permission denied (42501) ou erro de trigger/função.** ✅
- **API (PostgREST):** sem registros de erro no período. ✅
- Os erros de salvamento diagnosticados em sprints anteriores (FK/cast mascarados como "erro de conexão") **não estão mais ocorrendo**.

## 19. Índices

- Todas as tabelas operacionais têm índice em `owner_user_id`, `lote_id`, `fazenda_id`/`faz_id`, `data` e `created_at` onde aplicável. `movimentacoes_financeiras` tem índices compostos (`lote+data`, `data_competencia`, `status`). **Nenhuma ausência preocupante.** ✅
- **(Baixo)** Vários índices duplicados (ex.: `idx_lotes_owner` + `lotes_owner_user_id_idx` + `idx_lotes_owner_user_id`; padrão se repete em várias tabelas) — desperdício pequeno de escrita/armazenamento; limpeza futura, sem urgência.

## 20. Advisors de segurança do Supabase (todos nível WARN, nenhum ERROR)

1. `handle_new_user`, `handle_new_user_profile`, `app_*`, `set_*_owner` são SECURITY DEFINER executáveis via RPC por `anon`/`authenticated` (funções de trigger falham se chamadas via RPC, e as `app_*` só retornam dados do próprio uid — baixo risco real, mas recomenda-se `REVOKE EXECUTE FROM anon`).
2. 5 funções sem `search_path` fixo (`set_updated_at`, `set_current_timestamp_updated_at`, `set_cenarios_owner`, `set_cenario_eventos_owner`, `set_pastagens_owner`).
3. Extensão `citext` no schema public.
4. **Proteção contra senhas vazadas (HaveIBeenPwned) desabilitada no Auth** — recomendação: habilitar no painel antes do piloto.

## 21. Classificação dos achados

**Crítico:** NENHUM. ✅ (zero órfãos, zero FK quebrada, zero exposição RLS, trigger de profile funcionando, zero duplicidade financeira, zero erro recorrente nos logs)

**Alto:**
- A1. Função órfã `handle_new_user()` com `perfil='PROPRIETARIO'` fora da CHECK constraint — risco latente de voltar "usuário sem profile" se for religada. Hoje inativa; remover/corrigir em sprint autorizado.

**Médio:**
- M1. 7 profiles antigos com `owner_user_id NULL` (funciona via fallback; backfill recomendado).
- M2. `eventos_operacionais` sem policies `same_account` (impacto só quando existirem subusuários).
- M3. Trigger de profile engole exceção com apenas `raise warning` (dificulta diagnóstico).
- M4. FK duplicada em `sanitario.rotina_automatica_id`.
- M5. Triggers de `updated_at` duplicados na maioria das tabelas.
- M6. Colunas duplicadas/legadas (`estoque`, `fazendas`, `lotes`) e colunas uuid legadas sem FK (`pastagens.fazenda_id`, `cenarios.fazenda_id`).
- M7. Tabelas legadas não removidas (`suplementacao`, `usuarios`, `custos` semi-legada).

**Baixo:**
- B1. Policies `_owner` redundantes com `_same_account`.
- B2. Índices duplicados em várias tabelas.
- B3. Papel `visualizador` sem restrição de escrita no RLS (controle no app).
- B4. Pesagens de teste com datas de 2024 (lotes 17/18).
- B5. Coluna `desc` (palavra reservada) em `custos`/`sanitario`.
- B6. Warnings dos advisors (search_path, citext, RPC exposto, leaked password protection off).

## 22. Recomendações (para sprints futuros, com autorização)

1. Dropar ou corrigir `handle_new_user()` (A1).
2. Backfill `profiles.owner_user_id = id` onde nulo (M1).
3. Adicionar policies `same_account` a `eventos_operacionais` antes de ativar subusuários (M2).
4. Deduplicar triggers de updated_at, FK duplicada do sanitário e índices duplicados (M4/M5/B2).
5. Planejar migração/remoção das colunas e tabelas legadas (M6/M7) — sem urgência para o piloto.
6. Habilitar leaked password protection no Auth e revogar EXECUTE de `anon` nas funções SECURITY DEFINER (B6).

## 23. O que NÃO foi alterado

- Nenhum dado apagado ou modificado; nenhuma tabela/coluna dropada; nenhuma migration criada; nenhum RLS/policy alterado; nenhum trigger/função alterado; nenhum código do app alterado; login, Asaas e planos intocados. Somente este relatório foi criado.

## 24. Validação do projeto

- `npm run lint`: ✅ exit 0
- `npm run build`: ✅ exit 0 (vite, 244 módulos)
- `npm test`: ✅ 637 testes, 0 falhas

## 25. Conclusão

**O banco está PRONTO para o piloto.** Todos os critérios obrigatórios foram atendidos: nenhum usuário sem profile, zero órfãos, RLS coerente em 100% das tabelas, `owner_user_id` correto em todos os dados, fontes oficiais definidas (`movimentacoes_financeiras` e `consumo_suplementacao`), financeiro sem duplicidade, suplementação sem usar tabela legada, manejo sanitário consistente, calendário e cenários consistentes, e logs recentes sem nenhum erro crítico.

Os achados A1 e M1–M3 são riscos latentes/de manutenção que não bloqueiam o piloto, mas devem entrar no backlog técnico.
