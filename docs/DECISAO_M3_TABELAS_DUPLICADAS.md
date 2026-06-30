# Decisão M3 — Tabelas operacionais duplicadas

> Data: 2026-06-30 · Projeto Supabase: `ljpiszxicmmuefbiixui`
> Método: diagnóstico no banco real + auditoria de código. **Nenhuma tabela apagada, nenhum dado movido, nenhuma migration, RLS inalterada.**

## 1. Diagnóstico financeiro — `custos` x `movimentacoes_financeiras`

### Schema (resumo)
- **`custos`** (bigint id): `owner_user_id`, `lote_id`, `cat`, `desc`, `data` (NOT NULL), `val` (NOT NULL), `origem`, `origem_id`, `fazenda_id`, `metadata`. → tabela enxuta de **custo operacional do lote**.
- **`movimentacoes_financeiras`** (bigint id): `owner_user_id`, `tipo` (NOT NULL), `categoria`, `lote_id`, `valor` (NOT NULL), `data` (NOT NULL), `descricao`, `origem`, `origem_tipo`, `origem_id`, `parcela_num/total`, `pago`, `status`, `data_competencia`, `data_pagamento`, `metadata`… → **livro-caixa/DRE completo** (receita + despesa, competência/caixa, parcelas).

### Registros (banco real)
- `custos`: **2** (ambos `cat='aquisição'`, `origem=null` — custos de aquisição legados dos lotes 9 e 10).
- `movimentacoes_financeiras`: **4** (todas `despesa`: 2 manuais `origem=null`; 2 com `origem_tipo='consumo_suplementacao'`). **Nenhuma com `origem='custo'`** no momento.
- Join de duplicidade (mesmo owner+lote+valor): **0 linhas** — não há duplicação real de valor entre as tabelas hoje.

### Telas/uso no código
| Consumidor | Lê de | Papel |
|---|---|---|
| `FinanceiroPage` (DRE, fluxo, lançamentos) | **somente `movimentacoes_financeiras`** | livro-caixa oficial |
| `getResumoLote` → `calcularCustoLote` (resultado realizado do lote) | `movimentacoes_financeiras` (base) **+** `custos` (só legados não espelhados) | resultado oficial, **dedup-aware** |
| `calcLote` (`utils/calculations.js`) | `custos` | **projeção produtiva** (documentada como NÃO oficial) |
| `ResultadosPage` `getDateBounds` | `custos` (só datas) | apenas limites de período, não soma valores |
| `CustosPage` (escrita) | grava em **`custos` e** espelha em `movimentacoes_financeiras` (`origem='custo'`) | entrada de custo do lote |

### Risco encontrado
- **Risco de contagem em dobro:** existe em teoria (um custo está em `custos` e também no livro-caixa como `origem='custo'`), mas **já é tratado**: `calcularCustoLote` usa as movimentações como base e só adiciona custos legados que **não** têm espelho (`custosLegadosNaoRepresentados`). `FinanceiroPage` lê apenas o livro-caixa. **Nenhuma tela soma as duas ingenuamente.**
- **Inconsistência menor (não bloqueante):** os 2 custos de aquisição legados (`origem=null`) entram no resultado do lote, mas **não** aparecem no DRE do Financeiro (só entrariam se re-salvos pela CustosPage, que faz o espelho). Documentado; sem correção destrutiva nesta sprint.

### Respostas às perguntas obrigatórias (financeiro)
1. Lançar **custo** → grava em `custos` **e** espelha em `movimentacoes_financeiras` (`origem='custo'`).
2. Lançar **receita** → `movimentacoes_financeiras` (`tipo='receita'`).
3. **Dashboard/Financeiro** lê de `movimentacoes_financeiras`.
4. **Resultado do lote** lê via `calcularCustoLote` (livro-caixa + custos legados, dedup).
5. **Financeiro geral** lê de `movimentacoes_financeiras`.
6. Risco de lançar numa tabela e relatório ler de outra: **baixo** — o resultado do lote já consolida ambas com dedup; o Financeiro é fonte única.
7. Risco de somar as duas e duplicar: **mitigado** pela dedup `origem='custo'`/`origem_id`.

### ✅ Decisão financeira
**Manter as duas com papéis claros e distintos:**
- **`movimentacoes_financeiras` = fonte oficial financeira** (livro-caixa, DRE, fluxo de caixa, Dashboard). Receita e despesa passam por aqui.
- **`custos` = tabela operacional de custo do lote** (entrada na CustosPage + base da projeção `calcLote` + legado dedup no resultado realizado).
- O elo é o espelho `origem='custo'` + `origem_id`. A consolidação dedup-aware fica em `calcularCustoLote` e agora está **travada por teste**.

## 2. Diagnóstico suplementação — `suplementacao` x `consumo_suplementacao`

### Schema (resumo)
- **`suplementacao`** (bigint id): `lote_id`, `produto_id`, `nome`, `tipo`, `data_inicio`, `data_fim`, `consumo_kg`, `consumo_kg_dia`, `custo_total`, `metadata`. → desenho de **plano alimentar**.
- **`consumo_suplementacao`** (bigint id): `lote_id`, `item_estoque_id`, `dieta_id`, `produto_nome`, `dieta_nome`, `modo`, `quantidade/qtd_total/quantidade_total`, `consumo_por_cabeca_dia`, `percentual_peso_vivo`, `custo_total`, `data`, `metadata`. → **consumo real** + plano/dieta.

### Registros (banco real)
- `consumo_suplementacao`: **2**.
- `suplementacao`: **0** (vazia).

### Telas/uso no código
- **`SuplementacaoPage` / `SuplementacaoForm`** escrevem e leem **`consumo_suplementacao`**. O custo de consumo flui para o financeiro como `movimentacoes_financeiras` com `origem_tipo='consumo_suplementacao'`.
- **`suplementacao`**: **não é hidratada** em `useOperationalData` e **não tem leitura/escrita** no app. Aparece apenas em: arrays mortos do `operationalTemplate.js` (sempre `[]`) e na lista defensiva de limpeza de conta (`ConfiguracoesPage`).
- O `id` de nav `'suplementacao'` é a **rota** da página (que usa `consumo_suplementacao`), não a tabela.

### Respostas às perguntas obrigatórias (suplementação)
1. `suplementacao` representa **plano** (desenho original) — mas está vazia/sem uso.
2. `consumo_suplementacao` representa **consumo real (+ plano/dieta)** — é a usada.
3. O app trata como **duplicação acidental herdada**: só `consumo_suplementacao` é exercida.
4. Produto do estoque é salvo em `consumo_suplementacao.item_estoque_id`.
5. Lote é vinculado em `consumo_suplementacao.lote_id` (FK→lotes, ON DELETE SET NULL).
6. Nenhuma tela salva numa e lê de outra (suplementacao não é lida em lugar nenhum).
7. Dado real só existe em `consumo_suplementacao` (2); `suplementacao` está vazia.

### ✅ Decisão suplementação
- **`consumo_suplementacao` = fonte oficial** de suplementação (plano + consumo real).
- **`suplementacao` = descontinuada (legado).** Mantida no banco (sem drop) e na lista de limpeza defensiva, mas marcada como legado no `operationalTemplate.js`. O app não deve passar a usá-la.

## 3. Plano de transição
**Agora (nesta sprint, seguro):**
- Documentar as fontes oficiais (este arquivo + comentários no código).
- Travar a consolidação financeira com testes de regressão em `calcularCustoLote` (sem dobro; legado contado uma vez).
- Marcar `suplementacao` como legado no template.

**Futuro (requer autorização / migration com backup):**
- Eventual `DROP TABLE suplementacao` (após confirmar 0 uso por período).
- Backfill opcional dos 2 custos de aquisição legados para o livro-caixa, se quiser que apareçam no DRE.
- Avaliar unificar a entrada de custo: escrever apenas em `movimentacoes_financeiras` e tratar `custos` como view/derivado (refator maior).

**Nunca apagar sem backup:** `custos`, `movimentacoes_financeiras`, `consumo_suplementacao`. `suplementacao` está vazia, mas não será dropada nesta sprint.
