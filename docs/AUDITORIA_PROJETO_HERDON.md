# Auditoria Geral — Projeto HERDON

> Gerada em 2026-06-15. Base: branch `main` + Supabase project `ljpiszxicmmuefbiixui`.

---

## 1. Resumo Executivo

O HERDON está em estado pré-lançamento funcional. O build passa, a autenticação funciona, o billing Asaas está integrado e as 30 tabelas do Supabase têm RLS habilitado. O projeto tem três problemas críticos que devem ser resolvidos antes do lançamento público:

1. **Vazamento de convites** — qualquer usuário autenticado lê todos os convites de todas as contas (RLS mal configurado na tabela `invites`).
2. **Fonte dupla de cálculo financeiro** — `calcLote` e `calcularResultadoLote` retornam números diferentes para as mesmas métricas. PR #111 está em aberto para corrigir isso.
3. **Lint quebrado** — `npm run lint` falha com erros de parse e warnings de React Hooks. Não bloqueia o usuário hoje mas esconde bugs reais.

---

## 2. Estado do Projeto

| Dimensão | Status | Detalhe |
|----------|--------|---------|
| Build | ✅ PASS | `npm run build` passa sem erros |
| Lint | ❌ FAIL | Erros de parse + warnings de hooks |
| Autenticação | ✅ Funcional | Supabase Auth + profiles + roles |
| Billing | ✅ Integrado | Asaas sandbox OK; checkout e assinatura implementados |
| RLS | ⚠️ 1 crítico | 29/30 tabelas OK; `invites` tem falha grave |
| PR em aberto | ⚠️ #111 | 168 arquivos, aguarda merge |
| Testes | ❌ Sem cobertura | `scripts/run-node-tests.mjs` existe mas cobertura de domínio é zero |
| Conflitos de merge | ✅ Resolvidos | Limpo desde Sprint 4 |

**Versões em produção:**
- React 19.2.4 · Vite 8.0.4 · Supabase 2.103.3
- ESLint 9.39.4 · Framer Motion 12.38 · Lucide React 1.8

---

## 3. Mapa de Módulos

### Módulos por tier de assinatura

| Módulo | BASIC | PRO | PREMIUM |
|--------|-------|-----|---------|
| Dashboard, Fazendas, Lotes, Animais | ✅ | ✅ | ✅ |
| Pesagens, Tarefas, Calendário, Rotina | ✅ | ✅ | ✅ |
| Perfil, Configurações, Resultados | ✅ | ✅ | ✅ |
| Financeiro, Estoque, Sanitário | — | ✅ | ✅ |
| Relatórios Gerenciais | — | ✅ | ✅ |
| Pastagens, Indicadores, Cenários | — | — | ✅ |
| Dashboard Premium, Evolução Rebanho | — | — | ✅ |

### Páginas (26 total, lazy-loaded)
`Dashboard` · `Fazendas` · `Lotes` · `Animais` · `Pesagens` · `Pesagens (Acomp.)` · `Tarefas` · `Calendário` · `Rotina` · `Perfil` · `Configurações` · `Resultados` · `Comparativo` · `Financeiro` · `Estoque` · `Sanitário` · `Funcionários` · `Relatórios Gerenciais` · `Pastagens` · `Indicadores` · `Cenários` · `Dashboard Premium` · `Evolução Rebanho` · `Planejamento` · `Minha Assinatura` · `Assinatura Bloqueada`

---

## 4. Problemas Encontrados

### 4.1 Código / Arquitetura

#### [P0] Fonte dupla de cálculo financeiro (D-001)

Dois módulos calculam métricas para o mesmo lote com lógicas diferentes:

| Módulo | Arquivo | Fonte de dados | Problema |
|--------|---------|---------------|---------|
| `calcLote` | `src/utils/calculations.js` | `db.custos` + `lote.investimento` | Usa dados em memória; sem movimentações reais |
| `calcularResultadoLote` / `getResumoLote` | `src/domain/resumoLote.js` | `db.movimentacoes_financeiras` | Fonte correta — mas não está em todos os lugares |

Resultado: a mesma métrica (ex: lucro por cabeça) pode aparecer com valores diferentes em telas distintas do mesmo produto.

PR #111 resolve parcialmente: renomeia os campos do `calcLote` para `receitaProjetada`/`margemProjetada` (sinalizando que são projeções, não realizados), mas não elimina o módulo.

#### [P1] Dois `LoteCard.jsx` na árvore de componentes

- `src/components/LoteCard.jsx` — versão legada, será deletada pelo PR #111
- `src/components/lotes/LoteCard.jsx` — nova versão

Enquanto o PR não é mergeado, o arquivo legado existe e pode ser importado por engano.

#### [P1] Lint quebrado — falsos negativos de qualidade

`npm run lint` falha por:
- Erros de parse (provavelmente código gerado ou comentários mal formados)
- Warnings de React Hooks (regras de hooks violadas)

Enquanto o lint está quebrado, novos bugs de hook podem ser introduzidos sem detecção.

#### [P1] Dois triggers de auth sobrepostos

`handle_new_user` e `handle_new_user_profile` executam na mesma tabela `auth.users`. `handle_new_user` sempre seta `perfil = 'PROPRIETARIO'`, enquanto `handle_new_user_profile` preserva o perfil existente. A ordem de execução determina o resultado e pode causar inconsistências em contas de funcionários.

#### [P2] Bypass do handler de estoque

`SaidaEstoqueModal.jsx` e código legado no `EstoqueForm` modificam `db.estoque` diretamente via `setDb` em vez de passar pelo service layer. Isso bypassa a sincronização com Supabase e pode causar divergência entre UI e banco.

#### [P2] Ausência de soft-delete / histórico de exclusão

Tabelas como `movimentacoes_financeiras` e `animais` não têm `deleted_at`. Exclusões são permanentes, sem possibilidade de auditoria ou recuperação.

#### [P3] Nomenclatura inconsistente

| Problema | Local |
|----------|-------|
| `lucroporCabeca` vs `lucroPorCabeca` (casing) | `calculations.js` vs `resumoLote.js` |
| `lote_id` vs `loteId` (snake_case vs camelCase) | Supabase vs código JS |
| `calcularResultadoLote` vs `calcLote` | Dois nomes para cálculo do mesmo domínio |

Causa erros silenciosos (`undefined` quando o campo não é encontrado).

---

## 5. Segurança — Supabase

### 5.1 Resultado geral

Todas as 30 tabelas têm RLS habilitado. A arquitetura de funções helper (`app_is_same_account`, `app_can_manage_account`) está bem desenhada e implementa corretamente o modelo multi-tenant. O padrão de dual policies (`_owner` + `_same_account`) é correto.

**Problema:** existem policies legadas que precisam ser revisadas.

### 5.2 Achados de segurança

#### 🔴 CRÍTICO — Tabela `invites`: vazamento de convites entre contas

```sql
-- Policy: "Authenticated users can read invites"
-- Role: {authenticated}  CMD: SELECT  QUAL: true
```

Qualquer usuário autenticado lê **todos** os convites de **todas** as contas. Se o usuário A criou um convite para `funcionario@empresa.com`, o usuário B (de outra empresa) consegue ver esse convite via SELECT direto no Supabase ou via API.

**Correção:** remover ou substituir essa policy por `qual: app_is_same_account(owner_user_id)`.

#### 🟠 MÉDIO — Tabela `fazendas`: registros com `owner_user_id IS NULL` visíveis para todos

```sql
-- fazendas_select_own: (owner_user_id IS NULL OR auth.uid() = owner_user_id)
```

Qualquer fazenda com `owner_user_id` nulo (por bug ou migração antiga) fica visível a qualquer usuário autenticado.

**Correção:** verificar se existem fazendas com `owner_user_id IS NULL` em produção; corrigir a policy para exigir o campo preenchido.

#### 🟠 MÉDIO — Tabelas `alertas_adiados` e `alertas_resolvidos`: INSERT com role `{public}`

```sql
-- Role: {public}  CMD: INSERT  QUAL: null
```

Políticas com role `{public}` se aplicam inclusive a conexões não-autenticadas. Se o anon access estiver habilitado no projeto Supabase, qualquer pessoa pode inserir linhas nessas tabelas.

**Correção:** remover as policies legadas com role `{public}` (as versões `_same_account` com role `{authenticated}` já fazem o trabalho).

#### 🟡 BAIXO — Tabela `auditoria`: registros são mutáveis

Existem policies de UPDATE e DELETE na tabela `auditoria`. Um audit trail deve ser append-only.

**Correção:** remover as policies de UPDATE e DELETE da tabela `auditoria`.

#### 🟡 BAIXO — Tabelas `cenario_eventos` e `suplementacao`: sem acesso para equipe

Essas duas tabelas só têm policies `_own` (`auth.uid() = owner_user_id`), sem `_same_account`. Membros de equipe (gerente, operador) não conseguem acessar cenários ou suplementação, mesmo estando na mesma conta.

**Correção:** adicionar policies `_same_account` equivalentes às demais tabelas.

### 5.3 O que está bem

- Funções `app_is_same_account` e `app_can_manage_account` estão corretamente implementadas
- Tabelas de billing (`billing_events`, `checkout_sessions`, `customer_subscriptions`) requerem role `proprietario` ou `gerente` para escrita
- `subscription_plans` é somente leitura pelo client (sem policies de escrita)
- Nenhuma tabela acessível por anon sem autenticação

---

## 6. O que está bem

- **Build limpo:** `npm run build` passa sem warnings críticos
- **RLS universal:** todas as 30 tabelas têm RLS — nenhuma esquecida
- **Modelo multi-tenant bem desenhado:** `owner_user_id` consistente, funções helper reutilizadas
- **Auth robusto:** geração de sessão, cache de perfil, fallback de metadata, cooldown de falha (2 min)
- **Billing integrado:** Asaas com sandbox funcional, 5 planos definidos
- **Gating de subscription:** `canAccessModule()` centralizado em `subscriptions.js`
- **Proteção de Infinity:** `formatNumber`/`formatCurrency` protegem divisões por zero
- **Conflitos resolvidos:** nenhum marcador de merge conflict no código base
- **26 páginas lazy-loaded:** boa performance inicial de carregamento

---

## 7. O que precisa corrigir (por prioridade)

| # | Item | Prioridade | Esforço |
|---|------|-----------|---------|
| 1 | Corrigir RLS da tabela `invites` | 🔴 P0 | 30 min |
| 2 | Merge PR #111 (após verificação) | 🔴 P0 | 1h |
| 3 | Remover policies `{public}` legadas de alertas | 🟠 P1 | 30 min |
| 4 | Corrigir `fazendas` NULL owner check | 🟠 P1 | 30 min |
| 5 | Resolver lint (começar pelos parse errors) | 🟠 P1 | 2-4h |
| 6 | Remover `LoteCard.jsx` legado da raiz de components | 🟠 P1 | 10 min |
| 7 | Investigar e consolidar triggers auth | 🟠 P1 | 1h |
| 8 | Adicionar `_same_account` em `cenario_eventos` e `suplementacao` | 🟡 P2 | 1h |
| 9 | Tornar `auditoria` append-only (remover UPDATE/DELETE policies) | 🟡 P2 | 30 min |
| 10 | Unificar saída de estoque no service layer | 🟡 P2 | 2-3h |
| 11 | Eliminar `calcLote` após migrar consumidores | 🟡 P2 | 1 dia |
| 12 | Adicionar soft-delete em tabelas críticas | 🟡 P3 | 2-3 dias |
| 13 | Padronizar nomenclatura (snake_case Supabase, camelCase JS) | 🟡 P3 | 2-3 dias |

---

## 8. Recomendação sobre PR #111

**Aprovar com verificação pontual.** Ver `docs/REVIEW_PR_111.md` para análise completa.

O PR é correto na direção e deve ser mergeado. A única verificação necessária antes é confirmar que nenhum componente remanescente ainda importa os campos deletados (`receitaTotal`, `margem`, `receitaPorCabeca`, `custoTotalLote`) de `calcLote`.

---

## 9. Referências

- Revisão do PR: `docs/REVIEW_PR_111.md`
- Plano de limpeza: `docs/PLANO_LIMPEZA_HERDON.md`
- Issues recomendadas: `docs/ISSUES_RECOMENDADAS.md`
- Arquitetura técnica: `ARCHITECTURE.md`
- Próximos passos: `ROADMAP.md`
- SQL de RLS atual: `docs/supabase-production-rls.sql`
