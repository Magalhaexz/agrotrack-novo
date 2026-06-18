# Sprint 18 — Resultado

## Etapa 2 — Hotfix visual (commit `1297d16`)

Corrigidas inconsistências visuais em 5 telas:

| Arquivo | Correção |
|---------|----------|
| `src/pages/FluxoCaixaPage.jsx` | Adicionado `.kpi-content` wrapper — label e valor eram exibidos lado a lado |
| `src/pages/CustosCompartilhadosPage.jsx` | Migrado para `PageHeader` + `Card` components |
| `src/pages/EstoquePage.jsx` | Grid KPI trocado para `.dashboard-strip` + divs corretos sem `Card` aninhado |
| `src/pages/PesagensPage.jsx` | KPI compactos `.kpi-card--compact` + JSX expandido + typo corrigido |
| `src/components/LoteForm.jsx` | 6 blocos `section-card` + label "Duração estimada do ciclo (dias)" |

Gates: 291/291 testes ✔ lint limpo ✔ build 1.95s ✔

---

## Etapa 3 — Módulo de Pastos (commit `feat: activate farm pastures and lot allocation`)

### Diagnóstico Supabase

- Tabela `pastagens` existe com RLS ativo (8 policies)
- Bug crítico corrigido: `lotes.pastagem_id` era `bigint`, `pastagens.id` é `uuid` — vínculo nunca funcionou
- Bug crítico corrigido: payload de `PastagensPage` enviava `fazenda_id` como número para coluna uuid

### Migration aplicada

```sql
ALTER TABLE public.lotes ALTER COLUMN pastagem_id TYPE text USING pastagem_id::text;
```

### Arquivos alterados

| Arquivo | Mudança |
|---------|---------|
| `src/navigation/navConfig.js` | Adicionado item `pastagens` (Pastos / Tractor) na seção Operação |
| `src/pages/PastagensPage.jsx` | Corrigido payload (removido `fazenda_id` UUID); atualizado subtitle |
| `src/components/LoteForm.jsx` | Label "Pasto atual"; limpeza de pasto ao trocar fazenda; validação condicional para sistema 'pasto'; `pastagem_id` salvo como string |
| `docs/PASTOS_HERDON.md` | Criado — documenta estrutura, RLS, fluxo, migration e pendências |
| `docs/NAVEGACAO_HERDON.md` | Atualizado com item Pastos |
| `tests/pastagens.test.js` | 15 testes novos — filtro por fazenda, validação, limpeza ao trocar fazenda |

### Gates

| Gate | Resultado |
|------|-----------|
| `npm test` | 306/306 ✔ |
| `npm run lint` | Limpo ✔ |
| `npm run build` | 1.89s ✔ |

### Pendências futuras

- Histórico de movimentação lote-pasto (`lote_pastagens_historico`) — ver `docs/PASTOS_HERDON.md`
- `lotes.pastagem_id` não tem FK formal com `pastagens.id` — pode ser adicionada em sprint futura
- Campo `pastagens.fazenda_id` (uuid) existe no banco mas não é usado — candidato a remoção ou preenchimento em sprint futura
