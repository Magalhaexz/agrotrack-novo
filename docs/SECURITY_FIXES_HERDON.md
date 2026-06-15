# Security Fixes — HERDON

> Aplicadas em 2026-06-15 via Supabase MCP.  
> Base: auditoria de políticas RLS gerada na Sprint 1.

---

## Resumo

Todas as 5 vulnerabilidades identificadas na auditoria foram corrigidas. Nenhuma alteração foi necessária no código da aplicação — todas as correções são migrations SQL nas políticas RLS do Supabase.

| ID | Tabela | Severidade | Status |
|----|--------|-----------|--------|
| SEC-001 | `invites` | 🔴 Crítico | ✅ Corrigido |
| SEC-002 | `alertas_adiados` + `alertas_resolvidos` | 🟠 Médio | ✅ Corrigido |
| SEC-003 | `fazendas` | 🟠 Médio | ✅ Corrigido |
| SEC-004 | `cenario_eventos` + `suplementacao` | 🟡 Baixo | ✅ Corrigido |
| SEC-005 | `auditoria` | 🟡 Baixo | ✅ Corrigido |

---

## SEC-001 — `invites`: Vazamento de convites entre contas

**Problema:** A policy `"Authenticated users can read invites"` tinha `qual: true` para role `{authenticated}`. Qualquer usuário autenticado conseguia ler todos os convites de todas as contas via SELECT.

**Risco:** Exposição de emails de funcionários de outras empresas. Violação de isolamento de dados entre clientes.

**SQL aplicado:**
```sql
DROP POLICY IF EXISTS "Authenticated users can read invites" ON public.invites;
```

**Policy correta que permanece:** `invites_select_same_account_managers` com `qual: app_can_manage_account(owner_user_id)` — apenas proprietário/gerente da própria conta pode listar convites.

**Como validar:**
```sql
SELECT policyname, cmd, qual FROM pg_policies 
WHERE tablename = 'invites' AND schemaname = 'public';
-- Deve retornar 4 policies, nenhuma com qual = true
```

**Resultado pós-correção:** 4 policies, 0 com `qual: true`. ✅

---

## SEC-002 — `alertas_adiados` e `alertas_resolvidos`: INSERT por role `{public}`

**Problema:** 8 policies legadas (4 por tabela) com role `{public}` incluíam operações para usuários não autenticados. O role `{public}` no PostgreSQL aplica-se a todas as conexões, inclusive `anon`.

**Risco:** Se o acesso anônimo estiver habilitado no Supabase, qualquer pessoa poderia inserir ou manipular alertas.

**SQL aplicado:**
```sql
-- alertas_adiados
DROP POLICY IF EXISTS "Usuários podem criar seus alertas adiados" ON public.alertas_adiados;
DROP POLICY IF EXISTS "Usuários podem ver seus alertas adiados" ON public.alertas_adiados;
DROP POLICY IF EXISTS "Usuários podem atualizar seus alertas adiados" ON public.alertas_adiados;
DROP POLICY IF EXISTS "Usuários podem excluir seus alertas adiados" ON public.alertas_adiados;

-- alertas_resolvidos
DROP POLICY IF EXISTS "Usuários podem criar seus alertas resolvidos" ON public.alertas_resolvidos;
DROP POLICY IF EXISTS "Usuários podem ver seus alertas resolvidos" ON public.alertas_resolvidos;
DROP POLICY IF EXISTS "Usuários podem atualizar seus alertas resolvidos" ON public.alertas_resolvidos;
DROP POLICY IF EXISTS "Usuários podem excluir seus alertas resolvidos" ON public.alertas_resolvidos;
```

**Policies corretas que permanecem:** as 4 policies `_same_account` com role `{authenticated}` em cada tabela.

**Como validar:**
```sql
SELECT tablename, COUNT(*) as policies, 
  COUNT(CASE WHEN roles = '{public}' THEN 1 END) as public_policies
FROM pg_policies WHERE tablename IN ('alertas_adiados','alertas_resolvidos') 
  AND schemaname = 'public' GROUP BY tablename;
-- public_policies deve ser 0 nas duas tabelas
```

**Resultado pós-correção:** `alertas_adiados` = 4 policies / 0 public, `alertas_resolvidos` = 8 policies / 0 public. ✅

---

## SEC-003 — `fazendas`: Registros com `owner_user_id IS NULL`

**Problema:** As policies legadas `fazendas_select_own`, `fazendas_update_own`, `fazendas_delete_own` usavam a condição `(owner_user_id IS NULL OR auth.uid() = owner_user_id)`. Fazendas com `owner_user_id` nulo ficariam visíveis a qualquer usuário autenticado.

**Verificação de dados em produção:**
```sql
SELECT COUNT(*) as total, COUNT(CASE WHEN owner_user_id IS NULL THEN 1 END) as null_owner 
FROM public.fazendas;
-- Resultado: total=2, null_owner=0  (nenhum dado exposto em produção)
```

Nenhum dado foi exposto, mas a regra era perigosa para migrações futuras.

**SQL aplicado:**
```sql
DROP POLICY IF EXISTS "fazendas_select_own" ON public.fazendas;
DROP POLICY IF EXISTS "fazendas_delete_own" ON public.fazendas;
DROP POLICY IF EXISTS "fazendas_update_own" ON public.fazendas;
DROP POLICY IF EXISTS "fazendas_insert_own" ON public.fazendas;
```

**Policies corretas que permanecem:** `fazendas_select_owner` (`auth.uid() = owner_user_id`) e `fazendas_select_same_account` (`app_is_same_account(owner_user_id)`).

**Resultado pós-correção:** 8 policies, nenhuma com condição `IS NULL`. ✅

---

## SEC-004 — `cenario_eventos` e `suplementacao`: Equipe sem acesso

**Problema:** Ambas as tabelas só tinham policies `_own` (`auth.uid() = owner_user_id`). Membros de equipe (gerente, operador) com `owner_user_id` diferente do proprietário não conseguiam acessar cenários ou suplementação, mesmo sendo da mesma conta.

**SQL aplicado:**
```sql
-- cenario_eventos
CREATE POLICY "cenario_eventos_select_same_account" ON public.cenario_eventos
  FOR SELECT TO authenticated USING (app_is_same_account(owner_user_id));
CREATE POLICY "cenario_eventos_insert_same_account" ON public.cenario_eventos
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "cenario_eventos_update_same_account" ON public.cenario_eventos
  FOR UPDATE TO authenticated USING (app_is_same_account(owner_user_id));
CREATE POLICY "cenario_eventos_delete_same_account" ON public.cenario_eventos
  FOR DELETE TO authenticated USING (app_is_same_account(owner_user_id));

-- suplementacao
CREATE POLICY "suplementacao_select_same_account" ON public.suplementacao
  FOR SELECT TO authenticated USING (app_is_same_account(owner_user_id));
CREATE POLICY "suplementacao_insert_same_account" ON public.suplementacao
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "suplementacao_update_same_account" ON public.suplementacao
  FOR UPDATE TO authenticated USING (app_is_same_account(owner_user_id));
CREATE POLICY "suplementacao_delete_same_account" ON public.suplementacao
  FOR DELETE TO authenticated USING (app_is_same_account(owner_user_id));
```

**Resultado pós-correção:** `cenario_eventos` = 8 policies, `suplementacao` = 8 policies. ✅

---

## SEC-005 — `auditoria`: Audit trail mutável

**Problema:** A tabela `auditoria` tinha policies de UPDATE e DELETE, permitindo que registros de auditoria fossem alterados ou apagados. Audit trails devem ser imutáveis.

**SQL aplicado:**
```sql
DROP POLICY IF EXISTS "auditoria_update_owner" ON public.auditoria;
DROP POLICY IF EXISTS "auditoria_update_same_account" ON public.auditoria;
DROP POLICY IF EXISTS "auditoria_delete_owner" ON public.auditoria;
DROP POLICY IF EXISTS "auditoria_delete_same_account" ON public.auditoria;
```

**Policies que permanecem:** INSERT e SELECT. A tabela é agora append-only.

**Resultado pós-correção:** 4 policies (SELECT + INSERT por owner + same_account). ✅

---

## Verificação global pós-correção

```sql
SELECT tablename, COUNT(*) as total_policies,
  COUNT(CASE WHEN roles = '{public}' THEN 1 END) as public_role_policies
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('invites','alertas_adiados','alertas_resolvidos','fazendas','auditoria','cenario_eventos','suplementacao')
GROUP BY tablename ORDER BY tablename;
```

**Resultado verificado:**

| tablename | total_policies | public_role_policies |
|-----------|---------------|---------------------|
| alertas_adiados | 4 | 0 ✅ |
| alertas_resolvidos | 8 | 0 ✅ |
| auditoria | 4 | 0 ✅ |
| cenario_eventos | 8 | 0 ✅ |
| fazendas | 8 | 0 ✅ |
| invites | 4 | 0 ✅ |
| suplementacao | 8 | 0 ✅ |

Todas as 5 vulnerabilidades corrigidas. Zero policies `{public}` em tabelas operacionais.
