# Sprint 14 — Resultado

**Data:** 2026-06-17
**Objetivo:** Alertas Unificados, Monitoramento Inteligente e Pendências Visuais HERDON
**Status:** ✅ Concluída

---

## O que foi feito

### Etapa 1 — Diagnóstico dos alertas existentes

Levantamento completo do sistema de alertas antes de qualquer modificação:

| Arquivo | Função | Schema |
|---------|--------|--------|
| `src/utils/alerts.js` | `buildAlerts(db)` | `{nivel, titulo, mensagem, tipoLabel, pagina}` ✅ correto |
| `src/domain/alertas.js` | `gerarAlertasEstoque/Calendario/Pesagem/Lote` | `{urgencia, title, description, route}` ❌ incompatível |

**Problemas encontrados:**
- Dois sistemas em paralelo sendo mesclados em `App.jsx`
- `domain/alertas.js` usa schema diferente (titulo → undefined quando renderizado por AlertList.jsx)
- Duplicatas: estoque e sanitário gerados por ambos os sistemas
- Sem alertas financeiros

### Etapa 2 — Consolidação em `buildAlerts`

**`src/utils/alerts.js` — `buildAlerts(db)` expandido com 3 novas seções:**

| Seção (nova) | Alertas | Página |
|--------------|---------|--------|
| Pesagem | Lote sem pesagem (critical), atrasada >45d (critical), pendente >30d (warning) | `pesagens` |
| Saída de Lote | Saída vencida (critical), saída em até 7 dias (warning) | `lotes` |
| Financeiro | Pagamento vencido (critical), vencimento em até 3 dias (warning) | `financeiro` |

**Regras financeiras:** apenas despesas (`tipo === 'despesa'`), ignorando pagas e canceladas.

### Etapa 3 — Simplificação de App.jsx

Removido sistema duplicado `domain/alertas.js`:

```js
// Antes (dual-system):
const legacy = buildAlerts(db);
const automaticos = [...gerarAlertasEstoque(db), ...gerarAlertasCalendario(db), ...]
return ordenarAlertas([...legacy, ...automaticos]).map(...)

// Depois (unificado):
return buildAlerts(db).map((alert) => ({
  ...alert,
  route: alert?.pagina || null,
  ackKey: getAlertAckKey(alert),
}));
```

### Etapa 4 — Testes

`src/utils/alerts.test.js` criado com **20 testes**:

- db vazio → array vazio
- Estoque crítico, baixo, sem alerta acima do threshold
- Produto vencido
- Lote ativo sem pesagem
- Pesagem atrasada (>45 dias) → critical
- Pesagem pendente (>30 dias) → warning
- Lote inativo não gera alerta de pesagem
- Saída vencida → critical
- Saída próxima (≤7 dias) → warning
- Saída longe (>7 dias) → sem alerta
- Despesa vencida → critical
- Despesa vencimento próximo → warning
- Despesa paga → sem alerta
- Receita vencida → sem alerta
- Despesa cancelada → sem alerta
- Ordenação: critical antes de warning
- Todos os campos obrigatórios presentes

### Etapa 5 — Pendências visuais Sprint 13

| Tela | Problema | Correção |
|------|---------|---------|
| `FluxoCaixaPage.jsx` | KpiCard local com inline styles | Migrado para classes CSS: `kpi-card`, `kpi-label`, `kpi-val gn/rd/am` |
| `FazendasPage.jsx` | Empty state com div manual `ui-card empty-state` | Migrado para `<EmptyState>` component |
| `FinanceiroPage.jsx` | Detalhe de lote com `<h1>` solto sem PageHeader | Substituído por `<PageHeader title="Financeiro — {lote.nome}" />` |

---

## Gates finais

| Gate | Resultado |
|------|-----------|
| `npm test` | ✅ 266 testes, 0 falhas (246 anteriores + 20 novos) |
| `npm run lint` | ✅ Sem erros |
| `npm run build` | ✅ 347ms |

---

## Arquivos modificados

| Arquivo | Mudança |
|---------|---------|
| `src/utils/alerts.js` | Expandido com 3 novas seções + import `financeiroStatus` |
| `src/utils/alerts.test.js` | Criado (20 testes) |
| `src/App.jsx` | Removido dual-system, simplificado rawAlerts |
| `src/pages/FluxoCaixaPage.jsx` | KpiCard: inline styles → classes CSS |
| `src/pages/FazendasPage.jsx` | Empty state: div → `<EmptyState>` |
| `src/pages/FinanceiroPage.jsx` | h1 detalhe → PageHeader + import |
| `docs/ALERTAS_HERDON.md` | Criado |
| `docs/SPRINT_14_RESULTADO.md` | Criado |

---

## Arquivos removidos da chamada (não deletados)

`src/domain/alertas.js` — mantido no repositório, mas não mais chamado por `App.jsx`. Pode ser removido em Sprint futura após validação em produção.

---

## Pendências para Sprint 15+

- [ ] Remover `src/domain/alertas.js` após validação em produção
- [ ] Tela de Alertas dedicada (AlertasPage.jsx) — visualização paginada e filtrada
- [ ] Alertas push/notificação mobile
- [ ] Detalhe do Lote (abas internas) — revisão visual não realizada nesta sprint
- [ ] AnimaisPage, PesagensPage, SuplementacaoPage, ConfiguracoesPage, PerfilPage — não revisadas
- [ ] Responsividade mobile (mobile 375px) — não verificada visualmente
