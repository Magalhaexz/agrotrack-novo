# Auditoria de RLS e Isolamento entre Contas (Sprint 30)

## Método

Sem acesso às ferramentas de Supabase nesta sessão (MCP desconectado) e sem credenciais de conta autenticada, esta auditoria foi feita por leitura completa de `docs/supabase-production-schema.sql` e `docs/supabase-production-rls.sql` — os dois arquivos que compõem o "bundle" que deveria ser executado para provisionar um ambiente Supabase do zero. Não foi possível consultar o estado real do banco em produção; as conclusões valem para o que está documentado/versionado, não necessariamente para o que está de fato aplicado no banco vivo (ver "Ação humana necessária" no final).

## Função de isolamento

```sql
app_current_owner_user_id() -- resolve o owner_user_id da conta do usuário logado (via profiles; fallback auth.uid())
app_is_same_account(target_owner_user_id) -- true se o usuário logado pertence à mesma conta da linha
app_can_manage_account(target_owner_user_id) -- app_is_same_account() + perfil in ('proprietario','gerente')
```

Todas com `security definer` e `set search_path = public` (boa prática — evita *search path hijacking*). A lógica está correta: isolamento por **conta** (`owner_user_id`), não por usuário individual — múltiplos usuários da mesma conta (proprietário, gerente, operador, visualizador) compartilham o mesmo `owner_user_id` e veem os mesmos dados.

## Tabelas e RLS — situação confirmada

**28 tabelas no schema, todas com `enable row level security` + `force row level security`:** `profiles`, `invites`, `subscription_plans`, `customer_subscriptions`, `billing_events`, `checkout_sessions`, `fazendas`, `pastagens`, `lotes`, `animais`, `pesagens`, `sanitario`, `estoque`, `movimentacoes_estoque`, `movimentacoes_financeiras`, `movimentacoes_animais`, `custos`, `funcionarios`, `rotinas`, `tarefas`, `usuarios`, `configuracoes`, `cenarios`, `auditoria`, `alertas_resolvidos`, `alertas_adiados`, `consumo_suplementacao`, `lote_pastagens_historico`.

**Nenhuma tabela sem RLS encontrada.**

### Padrão de policies (a maioria das tabelas operacionais)

Bloco `do $$ ... foreach table_name in array owner_tables loop ... end $$` em `docs/supabase-production-rls.sql` aplica, para cada tabela, 4 policies idênticas: `select`/`insert`/`update`/`delete` para `authenticated`, todas usando `app_is_same_account(owner_user_id)`. Idempotente (`drop policy if exists` antes de cada `create`).

### Exceções com lógica própria

| Tabela | Particularidade |
|---|---|
| `profiles` | `owner_user_id` pode ser nulo (proprietário: `owner_user_id = id`); SELECT também permite `auth.uid() = id` |
| `invites`, `customer_subscriptions`, `billing_events`, `checkout_sessions` | INSERT/UPDATE/DELETE exigem `app_can_manage_account()` (só proprietário/gerente) — correto, convites e assinatura não devem ser editáveis por operador/visualizador |
| `subscription_plans` | SELECT com `using (true)` para qualquer `authenticated` — **intencional**: é o catálogo de planos (preços/limites), não há dado de cliente ali |
| `auditoria` | Ver achado abaixo |

## Achado e correção: `auditoria` podia ter UPDATE/DELETE recriados

**Problema encontrado:** `docs/PLANO_LIMPEZA_HERDON.md` (Sprint 2, 2026-06-15) registra que as policies `auditoria_update_*`/`auditoria_delete_*` foram removidas manualmente — uma trilha de auditoria que a própria conta auditada pode editar/apagar não serve para nada. Mas `docs/supabase-production-rls.sql` (último tocado em 2026-06-11, **antes** da correção da Sprint 2) ainda incluía `auditoria` no loop genérico que cria as 4 policies, incluindo update/delete. Se esse arquivo bundle fosse re-executado no futuro (ex.: provisionar um ambiente novo, ou re-rodar achando que é idempotente — e ele É escrito para ser idempotente), **as policies de update/delete em `auditoria` seriam recriadas**, regredindo a correção da Sprint 2.

**Correção aplicada nesta sprint:** `auditoria` foi removida do loop genérico em `docs/supabase-production-rls.sql` e ganhou um bloco próprio, explícito, que cria apenas `select`/`insert` e **garante** (via `drop policy if exists`) que `update`/`delete` nunca existem, mesmo que o script seja re-executado no futuro.

**Ação humana necessária:** esta correção foi feita no arquivo-fonte (script), não no banco de produção — não tenho acesso para verificar ou alterar o banco vivo nesta sessão. Alguém com acesso ao Supabase deve:
1. Confirmar no painel (Database → Policies → `auditoria`) que **não existem** policies de update/delete hoje.
2. Se existirem, executar manualmente: `drop policy if exists auditoria_update_same_account on public.auditoria; drop policy if exists auditoria_delete_same_account on public.auditoria;`

## Outras observações (sem ação necessária)

- **RLS garante isolamento de conta, não de papel/perfil.** Qualquer membro autenticado da conta (mesmo `visualizador`) pode, em teoria, fazer `insert`/`update`/`delete` diretamente via API REST do Supabase com seu próprio token, contornando os botões desabilitados da interface — porque a policy só verifica "mesma conta", não "tem permissão de editar". A interface já impede isso corretamente (perfis.js: `visualizador` só tem permissões `:ver`, nenhuma `:editar`/`:excluir`/`:movimentar`), mas a *defesa em profundidade* no banco não distingue papéis para a maioria das tabelas (só para convites/assinatura, que exigem `app_can_manage_account`). **Não corrigido nesta sprint** — exigiria mapear, tabela por tabela, qual perfil pode editar o quê (operador edita lotes/animais/pesagens mas não fazendas/funcionários, por exemplo), e qualquer erro nesse mapeamento bloquearia acesso legítimo. Fica como pendência para uma sprint dedicada, com acesso a um ambiente de teste real para validar antes de aplicar.
- **`cenario_eventos`** (mencionada em `docs/PLANO_LIMPEZA_HERDON.md` item 6) não existe no schema/RLS atual — provavelmente uma tabela planejada e nunca criada, ou removida depois. Não é risco (tabela inexistente não precisa de RLS), só uma nota de doc desatualizada.
- **`suplementacao`** (mencionada no item 7 do mesmo plano) hoje corresponde a `consumo_suplementacao`, que já está corretamente protegida no loop genérico — provável renomeação não refletida na doc antiga.

## Conclusão

Isolamento entre contas está correto e consistente em todas as 28 tabelas, com uma correção preventiva aplicada (auditoria) e uma lacuna de defesa em profundidade documentada como pendência (papel/perfil no nível do banco). Recomendo testar manualmente, com duas contas reais, que dados de uma conta nunca aparecem para a outra — ver `docs/SEGURANCA_TESTE_MANUAL.md`.
