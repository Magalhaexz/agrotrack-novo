# HERDON Supabase RLS Checklist

## Security principles
- Frontend permission checks are UX only; RLS must enforce writes.
- Never expose service role key in frontend.
- Prefer soft-delete for operational history.
- Prevent self-removal and last-admin lockout.

## Role model
- admin: full management
- proprietario: full farm operations, limited platform settings
- gerente: operational write access, no critical governance delete
- operador: operational execution with constrained edits
- visualizador: read-only

## Expected RLS matrix

### profiles
- select: own row + admin/proprietario/gerente (scoped)
- insert/update: own row; role changes only admin/proprietario
- delete: blocked (prefer deactivate)
- owner/auth rule: `id = auth.uid()` for self ops

### invites
- select: admin/proprietario/gerente scoped
- insert: admin/proprietario/gerente
- update: admin/proprietario/gerente (cancel/expire)
- delete: admin/proprietario only; accepted invites should not be hard-deleted
- owner/auth rule: tenant scope required

### fazendas / lotes / animais / pesagens / estoque / sanitario / tarefas / funcionarios / movimentacoes_financeiras / movimentacoes_animais
- select: all operational roles within tenant scope
- insert: admin/proprietario/gerente/operador within tenant scope
- update: admin/proprietario/gerente, operador where business-safe
- delete: avoid hard delete; restrict to admin/proprietario when unavoidable
- owner/auth rule: enforce `owner_user_id = auth.uid()` or equivalent tenant relation

## Hard-delete guidance
- Avoid hard-delete on: lotes, animais, pesagens, movimentações, sanitário, financeiro
- Prefer status/lifecycle transitions: ativo, encerrado, cancelado, arquivado

## Validation checklist
1. Verify each table has RLS enabled.
2. Verify SELECT/INSERT/UPDATE/DELETE policies by role.
3. Verify `owner_user_id` predicate exists where required.
4. Verify accepted invites cannot be removed by generic invite delete flow.
5. Verify admin cannot demote/remove self if it causes lockout.
