# Sprint 11 — Migration Supabase: Campos de Status Financeiro

**Data aplicação:** 2026-06-16
**Projeto:** HERDON (ljpiszxicmmuefbiixui) — us-west-2 — ACTIVE_HEALTHY
**Migration:** `20260616000000_financial_status_fields.sql`
**Status:** Aplicada com sucesso ✅

---

## Objetivo

Adicionar os campos de status e datas do modelo financeiro por competência na tabela `movimentacoes_financeiras` de produção, sem destruir dados existentes.

---

## Campos adicionados

| Campo | Tipo | Nullable | Constraint |
|-------|------|----------|------------|
| `status` | TEXT | SIM | CHECK IN ('previsto','realizado','pago','cancelado') |
| `data_competencia` | DATE | SIM | — |
| `data_pagamento` | DATE | SIM | — |

> **Nota:** `data_vencimento` já existia na tabela (adicionado anteriormente via outra rota). A migration usa `IF NOT EXISTS`, portanto o DDL foi executado sem erro.

---

## Índices criados

```sql
CREATE INDEX IF NOT EXISTS idx_mf_status ON movimentacoes_financeiras(status);
CREATE INDEX IF NOT EXISTS idx_mf_data_competencia ON movimentacoes_financeiras(data_competencia);
```

---

## Campos pré-existentes descobertos (não na migration)

Colunas já presentes na tabela antes desta migration:

| Campo | Tipo | Origem |
|-------|------|--------|
| `data_vencimento` | DATE | Adicionado anteriormente |
| `pago` | BOOLEAN | Legado de antes do modelo status |
| `metodo_pagamento` | TEXT | Legado |
| `parcela_num` | INT | Funcionalidade parcelamento (não ativa no app) |
| `parcela_total` | INT | Funcionalidade parcelamento (não ativa no app) |
| `metadata` | JSONB | Uso interno futuro |
| `fazenda_id` | UUID | Multi-fazenda (não exposto na UI atual) |
| `subcategoria` | TEXT | Subcategorias (não exposto na UI atual) |
| `comprador` | TEXT | Dado de contraparte |
| `fornecedor` | TEXT | Dado de contraparte |

Nenhum desses campos interferiu na migration. A aplicação usa apenas os campos documentados.

---

## Impacto nos dados existentes

**Tabela estava vazia no momento da aplicação (0 registros).**

- Nenhum dado legado foi impactado.
- Backward compatibility garantida via código (não por dados): `status NULL` → tratado como `'realizado'` em `normalizarStatusMovimentacao`.

---

## Como reverter (se necessário)

```sql
ALTER TABLE movimentacoes_financeiras
  DROP COLUMN IF EXISTS status,
  DROP COLUMN IF EXISTS data_competencia,
  DROP COLUMN IF EXISTS data_pagamento;

DROP INDEX IF EXISTS idx_mf_status;
DROP INDEX IF EXISTS idx_mf_data_competencia;
```

> Apenas execute isso se precisar desfazer esta migration. Dados novos com `status` preenchido seriam perdidos.
