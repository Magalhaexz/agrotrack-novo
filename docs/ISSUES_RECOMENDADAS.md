# Issues Recomendadas — HERDON

> Geradas a partir da auditoria de 2026-06-15.  
> Formato: uma issue por item. Prioridade: P0 (crítico/bloqueante) → P3 (melhoria).

---

## P0 — Crítico / Lançamento Bloqueado

### [SEC-001] Corrigir RLS da tabela `invites` — vazamento de convites entre contas

**Problema:** A policy `"Authenticated users can read invites"` tem `qual: true` para role `{authenticated}`. Qualquer usuário autenticado consegue ler todos os convites de todas as contas via API do Supabase.

**Impacto:** Exposição de emails de funcionários de outras empresas. Risco de privacidade e LGPD.

**Correção:**
```sql
-- Remover a policy legada:
DROP POLICY "Authenticated users can read invites" ON public.invites;
-- A policy invites_select_same_account_managers já cobre o caso correto.
```

**Esforço:** 30 minutos  
**Labels:** `security`, `p0`, `supabase`

---

### [BUG-001] Merge PR #111 após verificar consumidores de campos deletados

**Problema:** PR #111 remove campos `receitaTotal`, `margem`, `receitaPorCabeca`, `custoTotalLote` de `calcLote`. Se houver imports desses campos em componentes não cobertos pelo PR, o app quebra silenciosamente (retorna `undefined`).

**Tarefa:**
1. Verificar com grep (ver `docs/REVIEW_PR_111.md`)
2. Corrigir referências encontradas
3. Fazer `npm run build` no branch PR
4. Merge

**Esforço:** 1-2 horas  
**Labels:** `p0`, `financial`, `pr-review`

---

## P1 — Alta prioridade / Antes do beta público

### [SEC-002] Remover policies INSERT com role `{public}` de alertas

**Problema:** `alertas_adiados` e `alertas_resolvidos` têm policies INSERT com role `{public}`, que se aplica a conexões não-autenticadas.

**Correção:**
```sql
DROP POLICY "Usuários podem criar seus alertas adiados" ON public.alertas_adiados;
DROP POLICY "Usuários podem criar seus alertas resolvidos" ON public.alertas_resolvidos;
-- As policies _same_account já fazem o trabalho para usuários autenticados.
```

**Esforço:** 30 minutos  
**Labels:** `security`, `p1`, `supabase`

---

### [SEC-003] Corrigir fazendas com `owner_user_id IS NULL`

**Problema:** `fazendas_select_own` permite SELECT onde `owner_user_id IS NULL`. Qualquer fazenda sem dono fica visível a todos os usuários autenticados.

**Tarefas:**
1. Verificar se há registros com `owner_user_id IS NULL`:
   ```sql
   SELECT id, nome FROM public.fazendas WHERE owner_user_id IS NULL;
   ```
2. Se houver, corrigir os dados
3. Remover as 3 policies `_own` de fazendas (substituídas pelas `_owner` + `_same_account`)

**Esforço:** 1 hora  
**Labels:** `security`, `p1`, `supabase`

---

### [BUG-002] Lint quebrado — parse errors e warnings de hooks

**Problema:** `npm run lint` falha. Enquanto quebrado, novos bugs de React Hooks podem entrar sem detecção.

**Tarefas:**
1. Identificar quais arquivos têm erros de parse: `npm run lint 2>&1 | head -50`
2. Corrigir erros de parse primeiro (provavelmente JSX malformado ou comentários inválidos)
3. Para warnings de hooks: avaliar entre corrigir ou adicionar `// eslint-disable-next-line` comentado com justificativa
4. Garantir que `npm run lint` passa no CI

**Esforço:** 2-4 horas  
**Labels:** `quality`, `p1`, `tooling`

---

### [BUG-003] Dois triggers auth com comportamento conflitante

**Problema:** `handle_new_user` e `handle_new_user_profile` são dois triggers na tabela `auth.users`. O `handle_new_user` sempre força `perfil = 'PROPRIETARIO'`, podendo sobrescrever o perfil de um funcionário convidado.

**Tarefas:**
1. Verificar quais triggers existem e sua ordem:
   ```sql
   SELECT trigger_name, event_manipulation, action_timing 
   FROM information_schema.triggers 
   WHERE event_object_table = 'users' AND trigger_schema = 'auth';
   ```
2. Decidir qual manter (provavelmente `handle_new_user_profile`)
3. Remover o redundante

**Esforço:** 1-2 horas  
**Labels:** `auth`, `p1`, `supabase`

---

### [DEBT-001] Remover `src/components/LoteCard.jsx` legado

**Problema:** Existe `src/components/LoteCard.jsx` (legado) e `src/components/lotes/LoteCard.jsx` (novo). O legado usa campos financeiros que serão removidos pelo PR #111. Pode ser importado por engano.

**Tarefa:** Deletar `src/components/LoteCard.jsx` (já feito no PR #111 — este item fecha automaticamente com o merge do PR).

**Esforço:** 0 (coberto pelo PR #111)  
**Labels:** `cleanup`, `p1`

---

## P2 — Média prioridade / Próximas semanas

### [SEC-004] Adicionar policies `_same_account` para `cenario_eventos` e `suplementacao`

**Problema:** Essas tabelas só têm policies `_own` (`auth.uid() = owner_user_id`). Membros de equipe (gerente, operador) não conseguem acessar cenários ou suplementação, mesmo tendo conta na mesma fazenda.

**Correção:** Adicionar policies `_same_account` equivalentes às demais tabelas seguindo o padrão existente.

**Esforço:** 1 hora  
**Labels:** `security`, `p2`, `supabase`, `roles`

---

### [SEC-005] Tornar tabela `auditoria` append-only

**Problema:** Existem policies UPDATE e DELETE na tabela `auditoria`. Audit trails devem ser imutáveis.

**Correção:**
```sql
DROP POLICY "auditoria_update_owner" ON public.auditoria;
DROP POLICY "auditoria_update_same_account" ON public.auditoria;
DROP POLICY "auditoria_delete_owner" ON public.auditoria;
DROP POLICY "auditoria_delete_same_account" ON public.auditoria;
```

**Esforço:** 30 minutos  
**Labels:** `security`, `p2`, `supabase`

---

### [ARCH-001] Unificar saída de estoque no service layer

**Problema:** `SaidaEstoqueModal.jsx` e código legado no `EstoqueForm` modificam `db.estoque` via `setDb` direto, bypossando o service layer e a sincronização com Supabase.

**Tarefa:** Mover a lógica de saída para `src/services/estoqueService.js` (criar se não existir) e substituir os `setDb` diretos por chamadas ao service.

**Esforço:** 2-3 horas  
**Labels:** `architecture`, `p2`, `estoque`

---

### [ARCH-002] D-001 completo — eliminar `calcLote` como fonte de dados financeiros

**Problema:** Mesmo após PR #111, `calcLote` ainda existe com campos `receitaProjetada`/`margemProjetada`. A fonte oficial é `getResumoLote`. O módulo `calcLote` deve ficar limitado a métricas zootécnicas (GMD, peso, arroba).

**Tarefas:**
1. Mapear todos os consumidores de `calcLote` no frontend
2. Migrar os que usam métricas financeiras para `getResumoLote`
3. Remover campos financeiros restantes de `calcLote`
4. Documentar em `src/utils/calculations.js`: "este módulo é zootécnico, não financeiro"

**Esforço:** 1 dia  
**Labels:** `architecture`, `p2`, `financial`

---

## P3 — Melhoria / Roadmap

### [QUAL-001] Soft-delete em tabelas críticas

**Problema:** Exclusões em `movimentacoes_financeiras`, `animais`, `lotes` são permanentes. Sem histórico de auditoria ou possibilidade de recuperação.

**Tarefa:** Adicionar campo `deleted_at TIMESTAMP` nas tabelas críticas. Atualizar RLS para filtrar `deleted_at IS NULL` por padrão.

**Esforço:** 2-3 dias  
**Labels:** `feature`, `p3`, `database`

---

### [QUAL-002] Padronizar nomenclatura — snake_case para Supabase, camelCase para JS

**Problema:** Inconsistências como `lucroporCabeca` vs `lucroPorCabeca`, `lote_id` vs `loteId` causam erros silenciosos de `undefined`.

**Tarefa:** Criar convention doc + aplicar nos próximos PRs. Considerar TypeScript como solução estrutural.

**Esforço:** 3+ dias  
**Labels:** `quality`, `p3`, `refactor`

---

### [QUAL-003] Cobertura de testes para cálculos de domínio

**Problema:** As funções de cálculo (`calcLote`, `getResumoLote`, `calcularResultadoLote`) têm zero testes. Bugs financeiros passam despercebidos.

**Tarefa:** Adicionar testes unitários para pelo menos as funções do `src/domain/` e `src/utils/calculations.js`.

**Esforço:** 2-3 dias  
**Labels:** `testing`, `p3`, `quality`

---

### [QUAL-004] Migrar para TypeScript nas camadas de domínio e serviço

**Problema:** Todo o projeto é JavaScript puro. Erros de tipo (campo inexistente, `undefined`) são detectados só em runtime.

**Tarefa:** Migrar progressivamente — começar por `src/domain/` e `src/services/`.

**Esforço:** 1-2 semanas  
**Labels:** `refactor`, `p3`, `typescript`

---

## Resumo por prioridade

| Prioridade | Qtd | Tipo principal |
|-----------|-----|---------------|
| P0 | 2 | Segurança + bug crítico |
| P1 | 5 | Segurança + qualidade |
| P2 | 5 | Arquitetura + segurança |
| P3 | 4 | Qualidade + refactor |
| **Total** | **16** | |
