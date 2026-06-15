# SUPABASE Schema Contract - HERDON

## Scope
Canonical frontend contract for critical tables used by HERDON app.

## fazendas
- Required: id (uuid/int), nome (text), owner_user_id (uuid)
- Optional: cidade (text), estado (text), area_total (numeric), area_pasto (numeric), capacidade (int), cloud_id (text), metadata (jsonb), created_at (timestamptz), updated_at (timestamptz)
- Used by: src/services/operationalPersistence.js, src/pages/FazendasPage.jsx, src/hooks/useOperationalData.js
- owner_user_id: required
- metadata: optional

## lotes
- Required: id, nome, faz_id, owner_user_id
- Optional: status, entrada, saida, heads, peso_inicial, peso_atual, gmd_meta, cloud_id, metadata, created_at, updated_at
- Used by: src/pages/LotesPage.jsx, src/services/operationalPersistence.js, src/hooks/useOperationalData.js
- owner_user_id: required
- metadata: optional

## animais
- Required: id, owner_user_id
- Optional: lote_id, identificacao, sexo, raca, nascimento, peso, status, cloud_id, metadata, created_at, updated_at
- Used by: src/pages/AnimaisPage.jsx, src/services/operationalPersistence.js
- owner_user_id: required
- metadata: optional

## pesagens
- Required: id, owner_user_id
- Optional: lote_id, animal_id, data, peso, observacao, cloud_id, metadata, created_at
- Used by: src/pages/PesagensPage.jsx, src/pages/LotesPage.jsx, src/pages/ResultadosPage.jsx
- owner_user_id: required
- metadata: optional

## movimentacoes_animais
- Required: id, owner_user_id, tipo, data
- Optional: lote_id, animal_id, quantidade, peso_medio, valor_total, observacao, destino, cloud_id, metadata
- Used by: src/services/movimentacoes.js, src/services/operationalPersistence.js, src/pages/LotesPage.jsx
- owner_user_id: required
- metadata: optional

## movimentacoes_financeiras
- Required: id, owner_user_id, tipo, categoria, data, valor
- Optional: lote_id, descricao, origem, cloud_id, metadata
- Used by: src/pages/FinanceiroPage.jsx, src/pages/CustosPage.jsx, src/pages/ResultadosPage.jsx
- owner_user_id: required
- metadata: optional

## estoque
- Required: id, owner_user_id, nome
- Optional: categoria, unidade, quantidade_atual, quantidade_minima, custo_unitario, cloud_id, metadata
- Used by: src/pages/EstoquePage.jsx, src/pages/SuplementacaoPage.jsx, src/pages/SanitarioPage.jsx
- owner_user_id: required
- metadata: optional

## sanitario
- Required: id, owner_user_id, tipo, data_aplic
- Optional: lote_id, animal_id, produto, dose, unidade_dose, proxima, observacao, rotina_automatica_id, cloud_id, metadata
- Used by: src/pages/SanitarioPage.jsx, src/pages/ResultadosPage.jsx
- owner_user_id: required
- metadata: optional

## tarefas
- Required: id, owner_user_id, titulo, status
- Optional: categoria, prioridade, responsavel_id, data_vencimento, observacao, cloud_id, metadata
- Used by: src/pages/TarefasPage.jsx, src/pages/RotinaPage.jsx, src/pages/CalendarioOperacionalPage.jsx
- owner_user_id: required
- metadata: optional

## funcionarios
- Required: id, owner_user_id, nome
- Optional: cargo, telefone, email, status, cloud_id, metadata
- Used by: src/pages/FuncionariosPage.jsx
- owner_user_id: required
- metadata: optional

## profiles
- Required: id (auth user id), email, perfil
- Optional: nome, telefone, cargo, foto_url, created_at, updated_at
- Used by: src/services/userAccess.js, src/auth/AuthContext.jsx, src/pages/ConfiguracoesPage.jsx
- owner_user_id: not used (id is auth uid)
- metadata: not required

## invites
- Required: id, email, perfil, status, created_at
- Optional: nome, notes, created_by, used_by, used_at, updated_at
- Used by: src/services/userAccess.js, src/pages/ConfiguracoesPage.jsx
- owner_user_id: recommended for tenant scoping if multi-tenant
- metadata: not required

## alertas_resolvidos
- Required: id, owner_user_id, alert_key
- Optional: resolved_at, metadata
- Used by: src/App.jsx, src/components/AppHeader.jsx
- owner_user_id: required
- metadata: optional

## alertas_adiados
- Required: id, owner_user_id, alert_key
- Optional: until_at, metadata
- Used by: src/App.jsx, src/components/AppHeader.jsx
- owner_user_id: required
- metadata: optional

## Migration expectation
- Missing owner_user_id, missing table, or missing expected columns must be treated as schema mismatch.
- App must keep local fallback and surface explicit Portuguese message to user.
