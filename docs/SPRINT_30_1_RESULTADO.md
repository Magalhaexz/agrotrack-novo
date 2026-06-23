# Sprint 30.1 — Resultado

## Funcionalidade entregue

**Reconciliação Supabase Preview + Validação RLS Real**

Diferente das sprints anteriores, esta teve acesso real ao Supabase (MCP reconectado) — pela primeira vez desde a Sprint 22, foi possível **validar de fato** o banco de produção, não só ler arquivos `.sql` versionados. Isso revelou e corrigiu uma falha de segurança real e ativa (não hipotética) que nenhuma auditoria anterior conseguiu ver.

---

## 1. Versões de migration faltantes encontradas

| Remoto (`schema_migrations`) | Local (antes) |
|---|---|
| `20260617020950_financial_status_fields` | `20260616000000_financial_status_fields.sql` (versão diferente) |
| `20260619113446_lote_pastagens_historico` | `20260619000000_lote_pastagens_historico.sql` (versão diferente) |

E um caso inverso: `20260618000000_lotes_pastagem_id_uuid.sql` existia só localmente — aplicada no banco (confirmado: `lotes.pastagem_id` já é `uuid`), mas nunca registrada em `schema_migrations`.

## 2. Estratégia de reconciliação usada

Conforme pedido, **sem duplicar arquivos**: os 2 arquivos locais com conteúdo já equivalente ao remoto foram **renomeados** (`git mv`) para o prefixo de versão exato do remoto, com um comentário explicando a renomeação. Para a migration aplicada-mas-não-registrada, **não foi possível** rodar `supabase migration repair` (CLI não instalado nesta sessão) — documentado como pendência, sem editar `schema_migrations` manualmente (conforme instrução explícita de não fazer isso sem autorização separada).

## 3. Migration local não registrada — tratada?

**Parcialmente.** O arquivo (`20260618000000_lotes_pastagem_id_uuid.sql`) ganhou um comentário documentando a situação e o comando exato que resolve (`supabase migration repair --status applied 20260618000000`), mas a reconciliação real no remoto não foi feita — falta o CLI autenticado, que não estava disponível neste ambiente.

## 4. Policies inseguras corrigidas

**`cenario_eventos_insert_same_account`** e **`suplementacao_insert_same_account`** — ambas tinham `with_check: true` (sem filtro), permitindo que qualquer usuário autenticado inserisse uma linha com o `owner_user_id` de outra conta. Essa é a falha de segurança mais séria encontrada em qualquer sprint deste projeto até agora — diferente dos achados anteriores (que eram preventivos ou de baixo impacto), esta estava **ativa em produção**.

Corrigidas via migration `20260623220539_fix_insecure_insert_policies`, aplicada diretamente no banco real (MCP `apply_migration`). Também corrigido: `forcerowsecurity = false` em 4 tabelas (`cenario_eventos`, `eventos_operacionais`, `lote_pastagens_historico`, `suplementacao`), padronizado para `true`.

## 5. Houve alteração no banco real?

**Sim — uma alteração real, intencional e aprovada.** A migration `20260623220539_fix_insecure_insert_policies` foi aplicada ao banco de produção. Ela só altera **regras de acesso** (policies de RLS), não dados: nenhuma linha foi inserida, alterada ou apagada em nenhuma tabela de dados do cliente. Confirmado por consulta direta ao `pg_policies`/`pg_class` antes e depois.

## 6. Resultado de `supabase migration list`

**Não foi possível rodar o comando real** — Supabase CLI não está instalado/autenticado neste ambiente (`supabase: command not found`). Usei a ferramenta MCP equivalente (`list_migrations`), que consulta a mesma fonte de dados (`supabase_migrations.schema_migrations`):

```
20260617020950  financial_status_fields
20260619113446  lote_pastagens_historico
20260623220539  fix_insecure_insert_policies
```

Os 3 agora têm arquivo local com o mesmo prefixo de versão. A única divergência restante é a pendência do item 3 (sentido inverso: arquivo local sem registro remoto).

---

## Arquivos modificados/renomeados

| Arquivo | O que mudou |
|---|---|
| `supabase/migrations/20260616000000_financial_status_fields.sql` → `20260617020950_financial_status_fields.sql` | Renomeado (git mv) para bater com a versão remota; comentário de reconciliação adicionado |
| `supabase/migrations/20260619000000_lote_pastagens_historico.sql` → `20260619113446_lote_pastagens_historico.sql` | Idem |
| `supabase/migrations/20260618000000_lotes_pastagem_id_uuid.sql` | Comentário documentando a pendência de `migration repair` |
| `docs/RLS_AUDITORIA_HERDON.md` | Reescrito com a validação real no banco (substitui as conclusões da Sprint 30 baseadas só em leitura de arquivo, que erravam ao afirmar que `cenario_eventos`/`suplementacao` não existiam) |
| `docs/SEGURANCA_HERDON.md` | Atualizado com os 2 novos achados corrigidos e a reconciliação de migrations |
| `docs/CHECKLIST_PRE_PILOTO_HERDON.md` | Itens de RLS marcados como confirmados ao vivo; nova seção CI/GitHub |

## Arquivos novos

| Arquivo | Descrição |
|---|---|
| `supabase/migrations/20260623220539_fix_insecure_insert_policies.sql` | Migration corretiva de RLS, já aplicada no banco real |
| `docs/SUPABASE_PREVIEW_RECONCILIACAO.md` | Diagnóstico completo da divergência de migrations e a estratégia de correção |
| `docs/SPRINT_30_1_RESULTADO.md` | Este documento |

---

## Decisões técnicas

### Por que corrigir a falha de RLS direto no banco, e não só documentar

A Sprint 30 documentou achados sem poder agir (sem acesso). Nesta sprint, com acesso real e aprovação explícita do plano, a falha era **ativa e séria** (escrita entre contas) — esperar por outra sessão para corrigir manteria o risco real em produção sem necessidade. A correção foi escopada ao mínimo necessário (2 policies de INSERT + 1 flag de força em 4 tabelas), idempotente, sem tocar em dados.

### Por que não usar `supabase migration repair`

A ferramenta certa para reconciliar a migration "aplicada mas não registrada" é o comando do CLI, não disponível neste ambiente. Editar `supabase_migrations.schema_migrations` manualmente via SQL teria o mesmo efeito, mas a instrução do projeto foi explícita em não fazer isso sem autorização separada — então a decisão foi documentar a limitação e deixar a ação para alguém com o CLI.

## Limitações conhecidas

- `supabase migration repair` não foi executado (CLI ausente).
- Nenhuma verificação visual/funcional em produção foi feita (mesma limitação de todas as sprints desde a 22) — esta sprint validou **banco**, não **interface**.
- Os avisos do `get_advisors` (funções RPC expostas, search_path de triggers) não foram corrigidos — fora do escopo aprovado para esta sprint.

## Pendências para Sprint 31

- Rodar `supabase migration repair --status applied 20260618000000`.
- Confirmar que o check "Supabase Preview" do GitHub passa (recomendo "Re-run checks").
- Avaliar os avisos do `get_advisors`.
- RLS por papel/perfil (defesa em profundidade).
- Testar isolamento entre contas reais visualmente, e testar restore de backup.

## Teste manual

Não testado visualmente (sem credenciais de app). Validação desta sprint foi inteiramente via consultas diretas ao banco real (`pg_policies`, `pg_class`, `schema_migrations`, `get_advisors`) — uma camada de confiança mais forte que leitura de código, ainda que não substitua o teste funcional com a interface.

## Resultado dos gates

| Gate | Resultado |
|---|---|
| `npm test` | 538 testes, 0 falhas (sem alteração de lógica JS nesta sprint) |
| `npm run lint` | 0 erros |
| `npm run build` | Build de produção concluído com sucesso |
| `supabase migration list` (via MCP) | 3 migrations remotas, todas com arquivo local correspondente |
