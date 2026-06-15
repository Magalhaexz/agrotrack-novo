# Sprint 2 — Resultado

> Sprint: Segurança, Merge Controlado do PR #111 e Limpeza Técnica  
> Data: 2026-06-15

---

## Status geral: ✅ Concluída

Todos os critérios de aceite atendidos.

---

## 1. Segurança Supabase

| Item | Status | Detalhe |
|------|--------|---------|
| `invites` — policy `qual: true` | ✅ Corrigido | Policy removida; `same_account_managers` permanece |
| `alertas_adiados/resolvidos` — role `{public}` | ✅ Corrigido | 8 policies legadas removidas |
| `fazendas` — `owner_user_id IS NULL` | ✅ Corrigido | 4 policies `_own` removidas; 0 registros com NULL confirmados |
| `auditoria` — mutável | ✅ Corrigido | DELETE + UPDATE removidos; tabela append-only |
| `cenario_eventos` — sem acesso de equipe | ✅ Corrigido | 4 policies `_same_account` adicionadas |
| `suplementacao` — sem acesso de equipe | ✅ Corrigido | 4 policies `_same_account` adicionadas |

Detalhes completos em `docs/SECURITY_FIXES_HERDON.md`.

---

## 2. PR #111 — Verificação e Parecer

### Greps executados

**Grep 1:** Consumidores de campos deletados de `calcLote`
```
receitaTotal|receitaPorCabeca|custoTotalLote|\.margem\b
```

Resultado:
- `src/domain/calculos.js` — usa `receitaTotal` mas é o `calculos.js` de domínio, não o `calcLote`. SAFE.
- `src/domain/resumoLote.js` — usa `receitaTotal` como campo de retorno correto. SAFE.
- `src/domain/indicadoresEstrategicos.js` — computa seu próprio `receitaTotal`. SAFE.
- `src/pages/DashboardPage.jsx` — usa `getResumoLote`, não `calcLote`. SAFE.
- `src/pages/FinanceiroPage.jsx` — usa `getResumoLote`. SAFE.
- `src/pages/ResultadosPage.jsx` — usa ambos mas extrai financeiro de `getResumoLote`. SAFE.
- `src/components/ResultadoLoteCard.jsx` — usa `getResumoLote`. SAFE.
- `src/components/lotes/LoteFinanceiroTab.jsx` — usa `resumo.receitaTotal` (de `getResumoLote`). SAFE.
- `src/components/relatorios/RelatorioLote.jsx:26` — chamava `calcLote` e lia `i.margem` + `i.receitaTotal`. **QUEBRARIA** após PR #111. **CORRIGIDO nesta sprint.**
- `src/components/LoteCard.jsx` (root) — morto, sem importadores, deletado nesta sprint.
- `src/utils/calculations.js` — o próprio arquivo; campos ainda existem (PR não mergeado). Esperado.

**Grep 2:** Import do LoteCard legado
```
from.*components/LoteCard
```
Resultado: **sem matches**. LoteCard.jsx root não tinha importadores.

**Grep 3:** Referências ao `ComparativoLotesPage`
```
ComparativoLotesPage
```
Resultado: só o próprio arquivo `src/pages/ComparativoLotesPage.jsx`. App.jsx usa `ComparativoPage`. Arquivo deletado.

### Conclusão

**O PR #111 pode ser mergeado.** Único arquivo com risco real (`RelatorioLote.jsx`) foi corrigido nesta sprint. Os demais usos de `receitaTotal` e `margem` no codebase vêm de `getResumoLote`, não do `calcLote`, e não são afetados.

### Checklist pré-merge

- [x] `RelatorioLote.jsx` migrado para `getResumoLote`
- [x] `src/components/LoteCard.jsx` (root) deletado
- [x] `src/pages/ComparativoLotesPage.jsx` deletado
- [x] `npm run build` passa após as correções
- [ ] Rodar `npm run build` no branch do PR #111 antes do merge (responsabilidade do autor)

---

## 3. Lint

| Antes | Depois |
|-------|--------|
| ❌ FAIL — 100+ erros no plugin Obsidian (`.obsidian/plugins/obsidian-local-rest-api/main.js`) | ✅ PASS — saída vazia, exit code 0 |

**Causa raiz:** O lint rodava sobre toda a pasta do projeto, incluindo plugins de terceiros do Obsidian. O arquivo `.obsidian/plugins/obsidian-local-rest-api/main.js` tem 4000+ linhas com padrões de Node.js (`require`, `Buffer`, `process`) que não existem no contexto de browser configurado no ESLint.

**Correção:** `eslint.config.js` — adicionado `.obsidian/**` e `scripts/**` ao `globalIgnores`.

**Observação:** Os arquivos de código da aplicação (`src/`) estão limpos — zero warnings de React Hooks na fase final.

---

## 4. `LoteCard.jsx` duplicado

| Arquivo | Status | Motivo |
|---------|--------|--------|
| `src/components/LoteCard.jsx` (root) | ✅ Deletado | Sem importadores; consumia campos removidos pelo PR #111 |
| `src/components/lotes/LoteCard.jsx` | ✅ Mantido | Versão ativa; importada por `LotesPage` e outros |

---

## 5. Triggers auth sobrepostos

**Achado revisado:** Existe apenas UM trigger ativo:
```sql
on_auth_user_created → AFTER INSERT → handle_new_user_profile()
```

A função `handle_new_user` existe no banco mas **não está vinculada a nenhum trigger**. É uma função órfã (dead function), não um trigger conflitante.

**Ação:** Nenhuma correção urgente necessária. A função órfã pode ser removida em manutenção futura.

---

## 6. Bypass de service layer no estoque

**Achado revisado:** Após leitura do código:
- `SaidaEstoqueModal.jsx` — recebe `handleRegistrarSaidaEstoque` como prop e chama via `await Promise.resolve(...)`. Correto.
- `EstoqueForm.jsx` — recebe `onSave` como prop. Correto.
- Nenhum dos dois faz `setDb` direto.

**Conclusão:** O bypass reportado na auditoria era de versão anterior já corrigida. A camada de serviço está sendo respeitada nos componentes de estoque.

---

## 7. Limpeza de documentação

| Ação | Qtd | Detalhe |
|------|-----|---------|
| Arquivos movidos para `docs/archive/` | 158 | Todos os `SPRINT*.md`, `HOTFIX*.md`, `HERDON_*.md` e históricos da raiz |
| Arquivos mantidos na raiz | 6 | README.md, CLAUDE.md, ARCHITECTURE.md, ROADMAP.md, 00-Home.md, Index.md |
| Novos docs criados em `docs/` | 7 | AUDITORIA, REVIEW_PR_111, ISSUES, PLANO_LIMPEZA, SECURITY_FIXES, SPRINT_2_RESULTADO |

---

## Pendências restantes (não eram escopo desta sprint)

| Item | Prioridade | Próxima ação |
|------|-----------|-------------|
| Merge efetivo do PR #111 | P0 | Requer `npm run build` no branch do PR; aprovar na UI |
| `handle_new_user` função órfã | P3 | Remover em manutenção futura |
| Soft-delete em tabelas críticas | P3 | Sprint futura |
| TypeScript na camada de domínio | P3 | Decisão de arquitetura necessária |
| Testes para `getResumoLote` / `calcLote` | P3 | Sprint futura |
