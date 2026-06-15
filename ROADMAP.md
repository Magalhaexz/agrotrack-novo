# Roadmap — HERDON

> Última atualização: 2026-06-15  
> Base: auditoria geral + decisões abertas D-001, D-002, D-003.

---

## Agora (esta semana) — Estabilização pré-lançamento

Itens que bloqueiam o lançamento público ou representam risco de segurança/dados.

### Segurança Supabase

- [ ] **[SEC-001]** Corrigir RLS da tabela `invites` (30 min)
  - Remover policy "Authenticated users can read invites" (`qual: true`)
- [ ] **[SEC-002]** Remover policies `{public}` de alertas_adiados e alertas_resolvidos (30 min)
- [ ] **[SEC-003]** Verificar e corrigir `fazendas` com `owner_user_id IS NULL` (1h)

### PR #111

- [ ] **[BUG-001]** Verificar consumidores de campos deletados de `calcLote` (1h)
- [ ] Merge PR #111 após verificação

### Lint

- [ ] **[BUG-002]** Corrigir erros de parse no ESLint (2-4h)
  - Priorizar erros de parse antes dos warnings de hooks

---

## Próximas 2 semanas — Qualidade e arquitetura

### Segurança complementar

- [ ] **[SEC-004]** Adicionar `_same_account` para `cenario_eventos` e `suplementacao`
- [ ] **[SEC-005]** Tornar `auditoria` append-only (remover UPDATE/DELETE)

### Triggers de auth

- [ ] **[BUG-003]** Consolidar `handle_new_user` e `handle_new_user_profile` em um único trigger

### Cálculo financeiro (D-001 completo)

- [ ] Mapear todos os consumidores de `calcLote` no frontend
- [ ] Migrar consumidores financeiros para `getResumoLote`
- [ ] Marcar `calcLote` como "somente zootécnico"

### Estoque

- [ ] **[ARCH-001]** Unificar saída de estoque via service layer (eliminar `setDb` direto)

---

## Próximo mês — Features e robustez

### Modelo financeiro (D-003)

- [ ] Definir e implementar modelo de competência vs caixa
- [ ] Exibir data competência nas `movimentacoes_financeiras`

### Testes

- [ ] **[QUAL-003]** Adicionar testes unitários para `src/domain/` e `src/utils/calculations.js`
- [ ] Cobertura mínima: `getResumoLote`, `calcLote`, `buildAlerts`

### Soft-delete

- [ ] **[QUAL-001]** Adicionar `deleted_at` em `movimentacoes_financeiras`, `animais`, `lotes`

---

## Longo prazo — Evolução estrutural

### TypeScript

- [ ] **[QUAL-004]** Migrar `src/domain/` e `src/services/` para TypeScript
  - Resolve na raiz os erros silenciosos de campo inexistente

### Nomenclatura (D-001 derivado)

- [ ] **[QUAL-002]** Padronizar snake_case (Supabase) ↔ camelCase (JS) com mapeamento explícito

### Relatórios e exports

- [ ] Exportar relatórios em PDF / CSV
- [ ] Dashboard premium com análise de série temporal

### Multi-fazenda

- [ ] Suporte a usuário com múltiplas fazendas em contas separadas (enterprise)

---

## Decisões abertas que travam o roadmap

| ID | Decisão | Impacto | Onde discutir |
|----|---------|---------|--------------|
| D-001 | Fonte única de cálculo financeiro | Travando ARCH-002 | `docs/ISSUES_RECOMENDADAS.md` [ARCH-002] |
| D-002 | Estratégia de lint | Travando CI limpo | `docs/ISSUES_RECOMENDADAS.md` [DEBT-001] |
| D-003 | Modelo competência vs caixa | Travando financeiro completo | `11 - Memória Claude/Decisões em Aberto` |

---

## Não fazer (agora)

- Não migrar para TypeScript antes de resolver D-001 e lint
- Não adicionar novas features de premium antes de resolver SEC-001
- Não escalar usuários antes de confirmar isolamento de dados entre contas
