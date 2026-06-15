# Plano de Limpeza — HERDON

> Gerado em 2026-06-15. Executar na ordem da tabela — os P0 primeiro.

---

## Critérios

- **Ação:** o que fazer exatamente
- **Risco:** chance de quebrar algo
- **Status:** `[ ]` pendente · `[→]` em andamento · `[✓]` concluído

---

## Limpeza de Segurança (Supabase RLS)

| # | Arquivo / Objeto | Tipo | Problema | Ação | Risco | Status |
|---|-----------------|------|---------|------|-------|--------|
| 1 | `public.invites` (policy legada) | SQL / RLS | Qualquer user autenticado lê todos os convites | `DROP POLICY "Authenticated users can read invites" ON public.invites;` | Baixo (policy correta já existe) | `[✓]` Sprint 2 |
| 2 | `public.alertas_adiados` (2 policies) | SQL / RLS | INSERT com role `{public}` (inclui anon) | Remover policies "Usuários podem criar..." e "Usuários podem ver..." com role `{public}` | Baixo | `[✓]` Sprint 2 |
| 3 | `public.alertas_resolvidos` (4 policies) | SQL / RLS | INSERT/SELECT/UPDATE/DELETE com role `{public}` | Remover as 4 policies legadas com role `{public}` | Baixo | `[✓]` Sprint 2 |
| 4 | `public.fazendas` (3 policies `_own`) | SQL / RLS | `owner_user_id IS NULL` expõe fazendas a todos | 1. Verificado: 0 registros com NULL · 2. Removidas 4 policies `_own` | Médio | `[✓]` Sprint 2 |
| 5 | `public.auditoria` (2 policies de escrita) | SQL / RLS | Audit trail mutável | Removidos `auditoria_update_*` e `auditoria_delete_*` | Baixo | `[✓]` Sprint 2 |
| 6 | `public.cenario_eventos` | SQL / RLS | Sem acesso para equipe | Adicionadas 4 policies `_same_account` | Baixo | `[✓]` Sprint 2 |
| 7 | `public.suplementacao` | SQL / RLS | Sem acesso para equipe | Adicionadas 4 policies `_same_account` | Baixo | `[✓]` Sprint 2 |

---

## Limpeza de Código

| # | Arquivo | Tipo | Problema | Ação | Risco | Status |
|---|---------|------|---------|------|-------|--------|
| 8 | `src/components/LoteCard.jsx` | Componente legado | Duplicado; sem importadores; usa campos que PR #111 remove | Deletado | Baixo | `[✓]` Sprint 2 |
| 9 | `src/pages/ComparativoLotesPage.jsx` | Página legada | Morta (App.jsx usa ComparativoPage); misturava 2 fontes | Deletado | Baixo | `[✓]` Sprint 2 |
| 10 | `src/utils/calculations.js` | Utilitário | Campos financeiros enganosos (`receitaTotal`, `margem`, etc.) | RelatorioLote.jsx migrado para getResumoLote; PR #111 remove campos do cálculo | Médio | `[→]` aguarda merge PR #111 |
| 11 | `src/components/SaidaEstoqueModal.jsx` | Modal | Bypass de service layer | Revisado: já usa props/callbacks corretamente. Sem bypass. | — | `[✓]` Falso positivo |
| 12 | `src/data/mockData.js` | Arquivo legado | Só exporta `createEmptyOperationalDb()` — compatibilidade vazia | Verificar se tem import; se zero usos, deletar | Baixo | `[ ]` |

---

## Limpeza de Documentação

| # | Arquivo/Pasta | Tipo | Problema | Ação | Risco | Status |
|---|--------------|------|---------|------|-------|--------|
| 13 | 158 arquivos `SPRINT*.md`, `HOTFIX*.md`, `HERDON_*.md` da raiz | Docs legados | Poluíam o root | Movidos para `docs/archive/` | Zero | `[✓]` Sprint 2 |
| 14 | `docs/AUDITORIA_AGROTRACK.md` | Doc legado | Nome desatualizado; duplica `AUDITORIA_PROJETO_HERDON.md` | Verificar se há conteúdo exclusivo; arquivar se não houver | Zero | `[ ]` |

---

## Limpeza de Triggers / DB

| # | Objeto | Tipo | Problema | Ação | Risco | Status |
|---|--------|------|---------|------|-------|--------|
| 15 | `handle_new_user` (função órfã no DB) | Função SQL | Não é trigger — é função sem trigger vinculado; `handle_new_user_profile` é o único trigger ativo | Remover a função órfã em manutenção futura | Baixo | `[ ]` P3 |

---

## Verificação pós-limpeza

Após executar todos os itens:

```bash
# Build deve continuar passando
npm run build

# Lint deve mostrar menos erros (P1 separado)
npm run lint

# Verificar zero consumidores dos campos deletados
grep -r "receitaTotal\|\.margem\b\|custoTotalLote" src/ --include="*.jsx" --include="*.js"

# Verificar zero imports do LoteCard legado
grep -r "from.*components/LoteCard'" src/ --include="*.jsx"
```

---

## Ordem de execução recomendada

1. **Agora:** Item 1 (invites RLS) — crítico de segurança, 30 min
2. **Esta semana:** Itens 2-5 (demais RLS) + merge PR #111 (itens 8-10, 13)
3. **Próxima semana:** Itens 6-7 (same_account) + 11 (estoque service)
4. **Quando tiver tempo:** Itens 12, 14, 15
