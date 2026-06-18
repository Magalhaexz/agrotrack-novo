# Rotas Beta Piloto — HERDON

**Sprint 19 · Gerado em:** 2026-06-18
**Base:** `pageMap` em `src/App.jsx` (linhas 167-197)
**Plano do piloto:** `fundador` + `internal_test` → `modules: ['*']` = acesso a todas as rotas

---

## Legenda

| Status | Significado |
|--------|-------------|
| ✔ Analisado | Componente lido, sem bloqueadores conhecidos |
| ⚠ A validar | Carregamento confirmado, interação pendente de teste em browser |
| ✗ Bloqueado | Problema identificado que precisa de correção |
| — Fora do escopo | Não essencial para o piloto |

| Acesso c/ plano Fundador | Significado |
|--------------------------|-------------|
| BASIC | Disponível para todos os planos |
| PRO | Disponível a partir do plano Pro |
| PREMIUM | Requer plano Fundador ou equivalente |
| — | Sem plano → acesso implícito (lógica de allowMissing) |

---

## Rotas disponíveis (29 entradas no pageMap)

### Início

| ID da rota | Página | Módulo | Status piloto |
|------------|--------|--------|---------------|
| `dashboard` | Painel Geral | BASIC | ✔ |

### Operação

| ID da rota | Página | Módulo | Status piloto |
|------------|--------|--------|---------------|
| `fazendas` | Fazendas | BASIC | ✔ |
| `pastagens` | Pastos | PREMIUM | ✔ (Sprint 18 + FK Sprint 18.1) |
| `lotes` | Lotes e Rebanho | BASIC | ✔ |
| `animais` | Animais | BASIC | ⚠ |
| `pesagens` | Pesagens | BASIC | ⚠ |
| `acompanhamentoPeso` | Acompanhamento de Peso | — | ⚠ |
| `estoque` | Estoque | PRO | ✔ (Sprint 18 — KPIs) |
| `suplementacao` | Suplementação | — | ⚠ |
| `sanitario` | Sanidade | PRO | ⚠ |
| `tarefas` | Tarefas | BASIC | ⚠ |
| `funcionarios` | Equipe | — | ⚠ |
| `rotina` | Rotina | BASIC | — |
| `calendarioOperacional` | Calendário Operacional | BASIC | — |

### Financeiro

| ID da rota | Página | Módulo | Status piloto |
|------------|--------|--------|---------------|
| `financeiro` | Movimentações Financeiras | PRO | ✔ |
| `fluxoCaixa` | Fluxo de Caixa | — | ✔ (Sprint 18 — KPIs) |
| `custosCompartilhados` | Rateio de Custos | — | ✔ (Sprint 18) |
| `custos` | Custos | — | ⚠ |

### Decisão

| ID da rota | Página | Módulo | Status piloto |
|------------|--------|--------|---------------|
| `resultados` | Resultado dos Lotes | BASIC | ✔ |
| `comparativo` | Comparativo de Lotes | BASIC | ⚠ |
| `cenarios` | Simulador de Decisão | PREMIUM | ✔ |
| `indicadores` | Indicadores | PREMIUM | ✔ |
| `dashboardPremium` | Dashboard Premium | PREMIUM | ⚠ |
| `evolucaoRebanho` | Evolução do Rebanho | PREMIUM | ⚠ |
| `relatoriosGerenciais` | Relatórios | PRO | ⚠ |
| `planejamento` | Planejamento | — | ⚠ |

### Gestão de conta

| ID da rota | Página | Módulo | Status piloto |
|------------|--------|--------|---------------|
| `minhaAssinatura` | Planos e Assinatura | — | ✔ (mostrará plano Fundador) |
| `configuracoes` | Configurações | BASIC | ✔ |
| `perfil` | Perfil | BASIC | ✔ |

---

## Rotas NOT no pageMap (acesso especial)

| Destino | Como acessar | Notas |
|---------|-------------|-------|
| `/login` | URL direta | Redireciona se autenticado |
| `/suporte` | URL direta ou botão | SuportePage, fora da autenticação normal |
| `/cadastro` | URL direta | Cadastro de nova conta |
| `AssinaturaBloqueadaPage` | Automático | Exibido quando `subscriptionGate.blocked === true` — não ocorrerá com plano Fundador |

---

## Rotas essenciais para o piloto (Golden Path)

Estas 12 rotas cobrem 100% do fluxo do criador de gado:

1. `dashboard` — visão geral
2. `fazendas` — cadastro de propriedade
3. `pastagens` — gestão de pastos
4. `lotes` — rebanho e produção
5. `animais` — cadastro individual
6. `pesagens` — controle de GMD
7. `financeiro` — movimentações
8. `fluxoCaixa` — visão financeira
9. `custosCompartilhados` — rateio
10. `resultados` — resultado por lote
11. `cenarios` — simulação de decisão
12. `indicadores` — indicadores estratégicos

---

## Bloqueadores identificados

Nenhum bloqueador crítico identificado via análise estática. Todos os `✔` foram confirmados via código.

Os `⚠` requerem validação em browser real mas não há evidência de quebra funcional.
