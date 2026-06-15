# Review — PR #111

> Branch: `claude/loving-sagan-5xhwzr`  
> Diff: +129 / -694 linhas · 168 arquivos  
> Data da análise: 2026-06-15

---

## Veredicto

**✅ APROVAR — com uma verificação pontual antes do merge.**

O PR é seguro e correto na direção. A maior parte das mudanças são reorganização de documentação. As alterações de código são pequenas mas importantes: elas resolvem em parte o D-001 (fonte dupla de cálculo financeiro) ao renomear campos que sinalizavam resultado financeiro real para campos que sinalizam projeção.

---

## O que o PR faz

### 1. Reorganização de docs de sprint (≈ 150 arquivos)

Move arquivos de sprint da raiz do repositório para `docs/sprints/`. Puramente organizacional, sem impacto funcional. Elimina -694 linhas da raiz.

**Risco:** zero. Arquivos de documentação, não importados por código.

### 2. Alterações em `src/utils/calculations.js`

| Campo removido | Campo adicionado | Motivo |
|---------------|-----------------|--------|
| `receitaTotal` | — | Campo enganoso: era receita estimada, não realizada |
| `receitaPorCabeca` | — | Idem |
| `margem` | — | Idem |
| `margemPct` | — | Idem |
| `investimento` | — | Duplicava `custoTotalLote` |
| `custoTotalLote` | — | Campo computado que misturava fontes |
| — | `receitaProjetada` | Renomeado — deixa claro que é projeção |
| — | `margemProjetada` | Renomeado — deixa claro que é projeção |

Também muda o texto do alert: `"Margem projetada negativa"` em vez de `"Margem negativa"`. Correto — o cálculo é uma projeção, não o resultado realizado.

**O módulo `calcLote` não é deletado** — ele ainda calcula GMD, arroba, peso total etc. Só para de retornar métricas financeiras enganosas e passa a retornar apenas projeções.

**Risco:** baixo, mas deve verificar consumidores dos campos deletados (ver seção "Verificação necessária").

### 3. Deleção de `src/components/LoteCard.jsx` (raiz de components)

O arquivo legado `src/components/LoteCard.jsx` é deletado. Ele consumia `indicators.margem` e `indicators.receitaTotal` — campos que o PR remove de `calcLote`.

O substituto `src/components/lotes/LoteCard.jsx` já existe na árvore e usa a API correta.

**Risco:** médio se houver imports ainda apontando para o path antigo. Verificar.

### 4. Deleção de `src/pages/ComparativoLotesPage.jsx`

A página de comparativo de lotes é deletada. Ela misturava `calcLote` e `getResumoLote` para calcular métricas comparativas — exatamente o problema do D-001.

Existe `src/pages/ComparativoPage.jsx` como substituto (nome diferente, mesma funcionalidade refatorada).

**Risco:** verificar se o App.jsx ainda referencia `ComparativoLotesPage`.

### 5. Adições ao README

Seção "Fonte financeira oficial" documenta o papel de cada módulo. Excelente para onboarding de novos colaboradores e para evitar que o mesmo bug seja reintroduzido.

---

## Resultado dos greps (executados em 2026-06-15)

**Grep 1:** `receitaTotal|receitaPorCabeca|custoTotalLote|\.margem\b`

Único consumer real com risco: `src/components/relatorios/RelatorioLote.jsx` chamava `calcLote` e lia `i.margem` + `i.receitaTotal`. **Corrigido antes desta revisão** — agora usa `getResumoLote` para esses campos.

Demais ocorrências:
- `src/domain/resumoLote.js`, `src/domain/calculos.js` — fontes legítimas, não afetadas
- `src/pages/DashboardPage.jsx`, `FinanceiroPage.jsx`, `ResultadosPage.jsx` — usam `getResumoLote`
- `src/utils/calculations.js` — o próprio arquivo (PR ainda não mergeado, esperado)

**Grep 2:** `from.*components/LoteCard` → **zero matches**. Arquivo já era código morto. Deletado.

**Grep 3:** `ComparativoLotesPage` → só o próprio arquivo (não importado em App.jsx). Deletado.

## Conclusão pós-greps

**✅ APROVADO PARA MERGE — sem ajustes pendentes.**

Todos os riscos identificados foram tratados. O único arquivo com consumo real dos campos deletados (`RelatorioLote.jsx`) foi migrado para `getResumoLote`. Os arquivos mortos foram deletados.

---

## Arquivos críticos no PR

| Arquivo | Tipo de mudança | Risco |
|---------|----------------|-------|
| `src/utils/calculations.js` | Remoção de campos financeiros; adição de projeções | Baixo → verificar consumidores |
| `src/components/LoteCard.jsx` (root) | Deletado | Médio → verificar imports |
| `src/pages/ComparativoLotesPage.jsx` | Deletado | Médio → verificar App.jsx |
| `src/services/operationalPersistence.js` | Ajustes de sync | Baixo → mudanças menores |
| `src/services/userAccess.js` | Ajuste de permissões | Baixo → mudanças menores |
| `README.md` | Reescrito | Zero |
| `docs/sprints/*.md` (≈150 arquivos) | Movidos/reorganizados | Zero |

---

## O que o PR NÃO faz (e não precisa fazer)

- **Não elimina `calcLote`** — correto, pois o módulo ainda é usado para métricas zootécnicas (GMD, peso total, arroba). A eliminação seria uma tarefa separada (D-001 completo).
- **Não cria `getResumoLote` para substituir os campos removidos** — correto, essa função já existe em `src/domain/resumoLote.js`.
- **Não adiciona testes** — ausência esperada dado o estado atual do projeto; não bloqueia o merge.

---

## Riscos de regressão

**Baixo.** As remoções de campo de `calcLote` só afetam código que importava esses campos para exibir resultado financeiro. O PR deleta os dois principais consumidores (`LoteCard.jsx` e `ComparativoLotesPage.jsx`). Se as verificações acima passarem limpo, o risco é mínimo.

---

## Recomendação final

1. ✅ Greps executados — zero problemas remanescentes
2. ✅ `RelatorioLote.jsx` corrigido (migrado para `getResumoLote`)
3. ✅ `LoteCard.jsx` (root) e `ComparativoLotesPage.jsx` deletados
4. ⬜ Fazer `npm run build` no branch `claude/loving-sagan-5xhwzr` antes do merge
5. ⬜ Merge via GitHub — sem necessidade de split ou ajuste estrutural
