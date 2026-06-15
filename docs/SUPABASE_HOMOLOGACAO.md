# Supabase — Homologação Pré-Produção

> Sprint 4 · Etapa 3 · Gerado em 2026-06-15  
> Projeto Supabase: `ljpiszxicmmuefbiixui`  
> Queries executadas via MCP `execute_sql`

---

## Resumo executivo

| Teste | Resultado | Detalhe |
|-------|-----------|---------|
| 1. RLS habilitado em todas as tabelas | ✅ PASS | Zero tabelas com `rowsecurity = false` em `public` |
| 2. Funcionário só acessa o que a role permite | ⚠️ PARCIAL | Policies corretas; convite de funcionário BLOQUEADO (bug de case) |
| 3. Convites não vazam entre contas | ✅ PASS | Todas as policies de `invites` usam `app_can_manage_account` |
| 4. Auditoria não permite alteração indevida | ✅ PASS | `auditoria` tem apenas INSERT + SELECT — sem UPDATE/DELETE |
| 5. Fazenda sem dono não fica pública | ✅ PASS | Policies exigem match explícito; `app_is_same_account` rejeita NULL |
| 6. Dados financeiros não vazam entre contas | ✅ PASS | `movimentacoes_financeiras` com dual policy — mesmo padrão de `fazendas` |

**🔴 Bug crítico encontrado:** fluxo de convite de funcionário está quebrado em produção.  
**Classificação Sprint 4:** critical permission bug — elegível para correção.

---

## 1. RLS — Cobertura de tabelas

**Query:**
```sql
SELECT tablename FROM pg_tables 
WHERE schemaname = 'public' AND rowsecurity = false
ORDER BY tablename;
```

**Resultado:** `[]` — zero rows.

**Conclusão:** ✅ Todas as tabelas do schema `public` têm RLS habilitado.

---

## 2. Trigger de autenticação

**Query:**
```sql
SELECT trigger_name, event_object_table, action_statement
FROM information_schema.triggers
WHERE event_object_schema = 'auth' OR trigger_schema = 'public'
```

**Resultado relevante:**

| Trigger | Tabela | Função |
|---------|--------|--------|
| `on_auth_user_created` | `auth.users` | `handle_new_user_profile()` |

**Único trigger ativo no auth.** A função `handle_new_user` existe mas é órfã (sem trigger vinculado).

**Função `handle_new_user_profile` cria o perfil:**
```sql
INSERT INTO public.profiles (id, email, nome, perfil, owner_user_id, ...)
VALUES (new.id, new.email, resolved_name, 'PROPRIETARIO', new.id, ...)
ON CONFLICT (id) DO UPDATE ...
```

**Atenção:** insere `perfil = 'PROPRIETARIO'` (maiúsculas) — conflito com `app_can_manage_account`. Ver seção 7.

---

## 3. Profiles — Estado atual do banco

**Query:**
```sql
SELECT COUNT(*) total, COUNT(CASE WHEN owner_user_id IS NULL THEN 1 END) null_owner,
       COUNT(DISTINCT perfil) distinct_roles FROM public.profiles;
SELECT perfil, COUNT(*) total FROM public.profiles GROUP BY perfil;
```

**Resultado:**

| perfil | total |
|--------|-------|
| `admin` | 3 |
| `visualizador` | 5 |

- 8 profiles no total, **7 com `owner_user_id = NULL`**
- Nenhum com `perfil = 'PROPRIETARIO'` (maiúsculas)

**Interpretação:** esses 8 são contas de teste criadas antes do trigger atual. O trigger de produção cria com `perfil = 'PROPRIETARIO'` e `owner_user_id = new.id`. Os dados de teste não refletem o estado de produção.

**Frontend:** `normalizarPerfil('admin')` → `'proprietario'` (via alias em `perfis.js`) → funciona no frontend. O caso `'PROPRIETARIO'` também normaliza via `.toLowerCase()`. O problema é no DB, não no frontend.

---

## 4. Policies de RLS — Tabelas críticas

### `fazendas`, `lotes`, `animais`, `movimentacoes_financeiras`

Padrão dual — cada operação tem duas policies PERMISSIVE:

```
SELECT: owner_user_id = auth.uid()               ← proprietário direto
SELECT: app_is_same_account(owner_user_id)        ← funcionário da mesma conta
INSERT: WITH CHECK owner_user_id = auth.uid()     ← proprietário
INSERT: WITH CHECK app_is_same_account(...)       ← funcionário
UPDATE/DELETE: mesmo padrão
```

**Status:** ✅ PASS — isolamento multi-tenant correto.

### `auditoria`

| Policy | CMD | qual |
|--------|-----|------|
| `auditoria_insert_owner` | INSERT | owner = auth.uid() |
| `auditoria_insert_same_account` | INSERT | app_is_same_account |
| `auditoria_select_owner` | SELECT | owner = auth.uid() |
| `auditoria_select_same_account` | SELECT | app_is_same_account |

Sem UPDATE. Sem DELETE. **Status:** ✅ PASS — audit trail imutável.

### `invites`

Todas as 4 policies (SELECT/INSERT/UPDATE/DELETE) usam exclusivamente `app_can_manage_account(owner_user_id)`.

**Status:** ✅ Isolamento correto — sem vazamento entre contas.  
**Status da funcionalidade:** ❌ QUEBRADO — ver seção 7.

### `subscription_plans`

Policy com `qual = 'true'` — leitura aberta para todos os usuários autenticados.

**Status:** ✅ Intencional — catálogo de planos deve ser visível antes da assinatura.

### `profiles`

Políticas mistas: 2 antigas (`Users can view own profile` / `Users can update own profile basics`) e 3 novas (`profiles_select_same_account`, `profiles_insert_self_or_manager`, `profiles_update_self_or_manager`).

As antigas são redundantes mas não prejudicam. **Status:** ⚠️ Redundância estética — não é bug crítico.

---

## 5. Funções de suporte

### `app_is_same_account(target_owner_user_id)`

```sql
SELECT
  auth.uid() IS NOT NULL
  AND target_owner_user_id IS NOT NULL      -- ← protege contra NULL
  AND public.app_current_owner_user_id() = target_owner_user_id
```

**Comportamento com NULL:** retorna `false` se `target_owner_user_id IS NULL` — fazendas/lotes sem dono **não são acessíveis**.

### `app_current_owner_user_id()`

```sql
SELECT p.owner_user_id FROM public.profiles p WHERE p.id = auth.uid() LIMIT 1;
RETURN coalesce(current_owner, auth.uid());   -- ← fallback para próprio UID
```

Proprietário (`owner_user_id = id`): retorna próprio ID → acessa apenas seus dados.  
Funcionário (`owner_user_id = proprietario_id`): retorna ID do proprietário → acessa dados do proprietário.

### `app_can_manage_account(target_owner_user_id)`

```sql
SELECT
  public.app_is_same_account(target_owner_user_id)
  AND coalesce(public.app_current_profile_role(), '') IN ('proprietario', 'gerente')
```

**Verifica roles em lowercase.** `app_current_profile_role()` retorna `p.perfil::text` diretamente do banco.

---

## 6. Fazendas sem dono

**Query:**
```sql
SELECT COUNT(*), COUNT(CASE WHEN owner_user_id IS NULL THEN 1 END) null_owner
FROM public.fazendas;
```

**Resultado:** 2 fazendas, 0 com `owner_user_id = NULL`. ✅ PASS.

---

## 7. 🔴 Bug crítico — Case mismatch em `app_can_manage_account`

### Causa

O trigger `handle_new_user_profile` cria profiles com:
```sql
perfil = 'PROPRIETARIO'  -- maiúsculas
```

`app_current_profile_role()` retorna `p.perfil::text` sem normalização → retorna `'PROPRIETARIO'`.

`app_can_manage_account` verifica:
```sql
IN ('proprietario', 'gerente')   -- minúsculas
```

`'PROPRIETARIO' IN ('proprietario', 'gerente')` → **FALSE** em PostgreSQL (case-sensitive).

### Impacto

- Proprietários recém-cadastrados **não conseguem enviar convites** para funcionários
- `profiles` com `perfil = 'admin'` (dados de teste): mesmo problema — `'admin'` não está em `('proprietario', 'gerente')`
- Toda a tabela `invites` fica inacessível mesmo para o proprietário da conta

### Classificação

**Critical permission bug** (critério Sprint 4: "bug de permissão crítico")

### Correção recomendada

**Opção A — corrigir `app_can_manage_account` (mais seguro):**
```sql
CREATE OR REPLACE FUNCTION public.app_can_manage_account(target_owner_user_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN public.app_is_same_account(target_owner_user_id)
    AND lower(coalesce(public.app_current_profile_role(), '')) IN ('proprietario', 'gerente', 'admin');
END;
$$;
```

**Opção B — normalizar `handle_new_user_profile` para lowercase:**
```sql
-- Trocar 'PROPRIETARIO' por 'proprietario' no INSERT e no ON CONFLICT DO UPDATE
perfil = 'proprietario',
```
Mais limpo a longo prazo, mas requer migration dos dados existentes.

**Decisão:** Opção A é mais segura agora (sem migration de dados). Opção B é a certa para o longo prazo.

---

## 8. Triggers duplicados de `updated_at`

Muitas tabelas têm dois triggers de `updated_at` simultâneos:
- `set_X_updated_at` → chama `set_current_timestamp_updated_at()` (UTC)
- `trg_X_updated_at` → chama `set_updated_at()` (now())

**Impacto:** ambos executam no UPDATE, o segundo sobrescreve o primeiro. Resultado final é `now()` sem timezone UTC explícito.

**Classificação:** ⚠️ Não crítico — não afeta dados ou segurança. Registrar para limpeza futura.

**Afeta:** animais, auditoria, cenario_eventos, cenarios, configuracoes, custos, estoque, fazendas, funcionarios, lotes, movimentacoes_animais, movimentacoes_estoque, movimentacoes_financeiras, pastagens, pesagens, profiles, rotinas, sanitario, tarefas, usuarios.

---

## 9. Resultado dos 6 testes de segurança (Sprint 4 Etapa 3)

| # | Teste | Resultado | Evidência |
|---|-------|-----------|---------|
| 1 | Usuário A não pode ver fazenda do Usuário B | ✅ PASS | Policies `fazendas_select_*` com `owner_user_id` match estrito |
| 2 | Funcionário só acessa o que a role permite | ⚠️ PARCIAL | Policies corretas mas invites quebrados (bug case) |
| 3 | Convites não vazam entre contas | ✅ PASS | 100% policies de `invites` via `app_can_manage_account` |
| 4 | Auditoria não permite alteração indevida | ✅ PASS | Sem policies de UPDATE/DELETE em `auditoria` |
| 5 | Fazenda sem dono não fica pública | ✅ PASS | `app_is_same_account` retorna false para NULL owner; 0 fazendas com NULL |
| 6 | Dados financeiros não vazam para outra conta | ✅ PASS | `movimentacoes_financeiras` com dual policy idêntica a `fazendas` |

**Veredicto:** 5 de 6 testes passam. O teste 2 falha parcialmente por bug de case em `app_can_manage_account` que bloqueia todo o fluxo de convites.

---

## Próximas ações

| Prioridade | Ação |
|-----------|------|
| 🔴 P1 — Sprint 4 | Corrigir `app_can_manage_account` para aceitar case-insensitive OU incluir `'admin'` e `'PROPRIETARIO'` |
| 🟡 P2 — Sprint 5 | Normalizar `handle_new_user_profile` para inserir `perfil = 'proprietario'` (lowercase) |
| 🟡 P2 — Sprint 5 | Migrar dados existentes: `UPDATE profiles SET perfil = lower(perfil)` |
| 🔵 P3 — Backlog | Remover triggers duplicados de `updated_at` (limpeza) |
| 🔵 P3 — Backlog | Remover políticas antigas redundantes em `profiles` |
| 🔵 P3 — Backlog | Remover função órfã `handle_new_user` |
