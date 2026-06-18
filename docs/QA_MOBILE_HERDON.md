# QA Mobile — HERDON

**Atualizado Sprint 19 · Beta Piloto** | Criado Sprint 15 · Etapa 4
**Gerado em:** 2026-06-18
**Observação:** Documentado a partir do código-fonte (sem dispositivo físico disponível). Verificar em browser com DevTools mobile (375px) antes do go-live.

---

## Componentes mobile presentes no código

| Componente | Arquivo | Função |
|------------|---------|--------|
| `MobileBottomNav` | `src/components/MobileBottomNav.jsx` | Bottom nav com 5 itens: Início, Rebanho, Financeiro, Estoque, Mais |
| `MobileFab` | `src/components/MobileFab.jsx` | Botão flutuante de ação rápida |
| `AppHeader` | `src/components/AppHeader.jsx` | Header responsivo com menu hambúrguer |
| `Sidebar` | `src/components/Sidebar.jsx` | Sidebar lateral (desktop) — oculta em mobile via CSS |

---

## Bottom nav mobile — itens disponíveis

| Item | Page ID | Destino |
|------|---------|---------|
| Início | `dashboard` | Painel Geral |
| Rebanho | `lotes` | Lotes e Rebanho |
| Financeiro | `financeiro` | Movimentações Financeiras |
| Estoque | `estoque` | Estoque |
| Mais | `mais` | Abre menu lateral completo |

---

## Checklist de QA mobile (375px)

### Navegação

- [ ] Bottom nav visível na parte inferior
- [ ] Tap em "Início" → Painel Geral
- [ ] Tap em "Rebanho" → Lotes e Rebanho
- [ ] Tap em "Financeiro" → Movimentações Financeiras
- [ ] Tap em "Estoque" → Estoque
- [ ] Tap em "Mais" → abre menu lateral com todos os itens
- [ ] Item ativo destacado visualmente no bottom nav

### Header e layout

- [ ] `AppHeader` visível no topo com logo e menu hambúrguer
- [ ] Sidebar não visível em mobile (deve estar oculta)
- [ ] Conteúdo não sobrepõe bottom nav (padding-bottom correto)
- [ ] Scroll vertical funciona nas páginas longas

### Telas críticas (375px)

| Tela | Verificar |
|------|-----------|
| Login | Campos legíveis e teclado não cobre formulário |
| Painel Geral | KPI cards empilhados verticalmente, alertas legíveis |
| Fazendas | Cards de fazenda sem overflow horizontal |
| Lotes | Filtros acessíveis, cards sem overflow |
| Movimentações Financeiras | Tabela/lista rola corretamente |
| Fluxo de Caixa | KPI cards responsivos |
| Resultado dos Lotes | Tabs e tabelas acessíveis em mobile |

### FAB e modais

- [ ] `MobileFab` não cobre conteúdo importante
- [ ] Modais abrem em tela cheia ou centralizado
- [ ] Modais fecham com toque fora ou botão fechar
- [ ] Formulários dentro de modais: campos acessíveis com teclado virtual

### Tipografia e espaçamento

- [ ] Fonte mínima ≥ 14px em todos os textos visíveis
- [ ] Botões com área de toque ≥ 44px (padrão Apple/Google)
- [ ] Espaçamento entre itens de lista adequado (sem itens colados)

---

## Telas do Golden Path em mobile

| Passo | Tela | Verificação mobile |
|-------|------|--------------------|
| 2–3 | Login | Formulário responsivo, senha visível/oculto |
| 4 | Dashboard | KPIs empilhados, alertas legíveis |
| 5 | Fazendas | Modal de nova fazenda em mobile |
| 6 | Lotes | Modal/form de novo lote em mobile |
| 8 | Pesagens | Formulário de pesagem em mobile |
| 9 | Financeiro | Lançamento financeiro em mobile |
| 11 | Resultados | Resultado de lote em mobile |

---

## Status

| Item | Status |
|------|--------|
| Componentes mobile existem no código | ✅ |
| Bottom nav com 5 itens | ✅ |
| Classes `sem-impressao` nos componentes mobile | ✅ |
| Teste visual em browser 375px | ⚠️ Pendente |
| Teste em dispositivo iOS real | ⚠️ Pendente antes do go-live |
| Teste em dispositivo Android real | ⚠️ Pendente antes do go-live |

---

## Riscos mobile identificados

| Risco | Severidade | Observação |
|-------|-----------|------------|
| Tabelas de dados (financeiro, resultados) — overflow horizontal | Médio | Verificar em 375px |
| Teclado virtual cobre campos de formulário em iOS | Médio | Problema comum em webapps |
| Bottom nav + FAB — sobreposição de conteúdo | Baixo | Verificar padding-bottom |
| Sidebar "Mais" — interação de abertura/fechamento | Baixo | Testar gesto de fechar |

---

## Sprint 19 — Classificação por tela (Beta Piloto)

Classificação de prioridade mobile para o criador piloto. Telas do Golden Path têm maior prioridade.

| Tela | No Golden Path | Prioridade mobile | Sprint de origem | Notas |
|------|---------------|-------------------|-----------------|-------|
| Login | ✔ | CRÍTICO | Sprint 1 | Formulário responsivo, campo senha |
| Dashboard | ✔ | CRÍTICO | Sprint 1 | KPIs empilhados, alertas legíveis |
| Fazendas | ✔ | CRÍTICO | Sprint 5 | Modal de criação em mobile |
| Pastos | ✔ | CRÍTICO | Sprint 18 | Novo módulo — testar CRUD em 375px |
| Lotes | ✔ | CRÍTICO | Sprint 12 | LoteForm com 6 blocos em mobile |
| Pesagens | ✔ | ALTO | Sprint 18 | KPIs `.kpi-card--compact` — Sprint 18 |
| Financeiro | ✔ | ALTO | Sprint 12 | Tabela de lançamentos |
| Fluxo de Caixa | ✔ | ALTO | Sprint 18 | KPIs corrigidos Sprint 18 |
| Resultado dos Lotes | ✔ | ALTO | Sprint 12 | Tabs + tabelas |
| Simulador de Decisão | ✔ | MÉDIO | Sprint 14 | Form + resultados |
| Indicadores | ✔ | MÉDIO | Sprint 14 | Gráficos responsivos |
| Rateio de Custos | — | MÉDIO | Sprint 18 | KPIs corrigidos Sprint 18 |
| Estoque | — | MÉDIO | Sprint 18 | KPIs corrigidos Sprint 18 |
| Animais | — | MÉDIO | Sprint 10 | Lista de animais |
| Sanidade | — | BAIXO | Sprint 11 | — |
| Suplementação | — | BAIXO | Sprint 11 | — |
| Relatórios | — | BAIXO | Sprint 14 | Tabelas gerenciais |
| Comparativo | — | BAIXO | Sprint 12 | — |
| Perfil | — | BAIXO | Sprint 3 | — |
| Configurações | — | BAIXO | Sprint 3 | — |
| Planos e Assinatura | — | INFO | Sprint 10 | Mostrará plano Fundador; sem botão de compra |

### Telas novas desde Sprint 15 que precisam de QA mobile

| Tela | Adicionada em | Risco |
|------|--------------|-------|
| Pastos (`PastagensPage`) | Sprint 18 | Modal com campo de fazenda e área |
| LoteForm — bloco Pasto | Sprint 18 | Campo "Pasto atual" com select filtrado |
| FluxoCaixaPage — KPIs | Sprint 18 | `.kpi-content` wrapper novo |
| CustosCompartilhadosPage | Sprint 18 | `PageHeader` + `Card` migrados |
| EstoquePage — KPIs | Sprint 18 | `.dashboard-strip` 3 colunas em 375px |
| PesagensPage — KPIs | Sprint 18 | `.kpi-card--compact` em linha |
