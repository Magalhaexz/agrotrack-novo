# UI/UX HERDON — Padrão Visual

## Design System

### Tokens (src/styles/tokens.css)

| Token | Valor | Uso |
|-------|-------|-----|
| `--color-primary` | `#22c55e` | Verde principal HERDON |
| `--color-bg` | `#0a0a0a` | Fundo global |
| `--color-surface` | `#111111` | Cards e painéis |
| `--color-text` | `#f0f0f0` | Texto principal |
| `--color-text-secondary` | `#a0a0a0` | Texto secundário |
| `--color-text-muted` | `#555555` | Labels e hints |
| `--color-success` | `#22c55e` | Verde sucesso |
| `--color-warning` | `#f59e0b` | Amarelo alerta |
| `--color-danger` | `#ef4444` | Vermelho erro |
| `--color-info` | `#3b82f6` | Azul informação |

---

## Componentes padrão

### Card (`src/components/ui/Card.jsx`)
```jsx
<Card title="Título" subtitle="Subtítulo" action={<Button>Ação</Button>}>
  {children}
</Card>
```
CSS: `.ui-card`, `.ui-card-header`, `.ui-card-title`, `.ui-card-subtitle`

### Button (`src/components/ui/Button.jsx`)
```jsx
<Button variant="primary" size="md" icon={<PlusIcon />} loading={false}>
  Texto
</Button>
```
Variantes: `primary`, `secondary`, `outline`, `ghost`, `danger`, `warning`
Tamanhos: `sm`, `md`, `lg`

### KpiCard (`src/components/KpiCard.jsx`)
```jsx
<KpiCard
  label="Cabeças ativas"
  value="428"
  unit="cab"
  hint="Todos os lotes ativos"
  tone="gn"
  icon="chart"
/>
```
Tones: `nt` (neutro), `gn` (verde), `rd` (vermelho), `am` (âmbar)
CSS: `.kpi-card`, `.kpi-label`, `.kpi-value`, `.kpi-val`, `.kpi-unit`, `.kpi-sub-value`

### EmptyState (`src/components/EmptyState.jsx`)
```jsx
<EmptyState
  title="Nenhum lote cadastrado."
  subtitle="Cadastre seu primeiro lote para acompanhar GMD, custo e resultado."
  icon={BeefIcon}
  tone="neutral"
  action={<Button onClick={...}>Criar lote</Button>}
/>
```
Tones: `neutral`, `success`, `warning`, `danger`

### PageHeader (`src/components/PageHeader.jsx`)
```jsx
<PageHeader
  title="Título da Página"
  subtitle="Descrição breve da finalidade."
  actions={<Button>Ação</Button>}
/>
```
CSS: `.ph`, `.ph-actions`

### Table (`src/components/ui/Table.jsx`)
CSS: `.ui-table-wrap`, `.ui-table`

---

## Padrão de linguagem para o produtor

### Termos que devem ser mantidos (agro)
- GMD (Ganho Médio Diário)
- @ carcaça (arroba de carcaça)
- Peso médio
- Cabeças
- Margem
- Custo por cabeça
- Custo/@ carcaça
- Lote
- Rebanho
- UA (Unidade Animal)

### Termos substituídos
| Técnico | Produtor |
|---------|---------|
| Dashboard | Painel Geral |
| Cenários | Simulador de Decisão |
| Baseline / Projeção | Comparar cenários |
| Financeiro | Movimentações Financeiras |
| Relatórios Gerenciais (menu, até Sprint 26) | Painel Gerencial (Sprint 27 — para não confundir com o hub "Relatórios" da Sprint 24) |
| Pastagem | Pasto (Sprint 22 — varrido em toda a interface; tabela `pastagens` no banco não mudou) |

---

## Estados vazios — mensagens padrão

Quando não há dados, o HERDON orienta o produtor com mensagens ativas:

| Tela | Mensagem principal | Orientação |
|------|-------------------|------------|
| Lotes e Rebanho | Nenhum lote encontrado. | Ajuste os filtros ou cadastre um novo lote para continuar. |
| Painel Geral (conta nova, sem fazenda) | Comece cadastrando sua fazenda ou importando seus dados. | Botões: Cadastrar fazenda, Importar dados, Ver guia do criador piloto (Sprint 22) |
| Painel Geral (com fazenda, sem lotes ativos) | Você ainda não tem lotes ativos. | Cadastre seu primeiro lote para acompanhar GMD, custo e resultado financeiro da operação. |
| Painel Geral — Hoje na Fazenda (sem prioridades) | Tudo certo por aqui — nenhuma prioridade pendente hoje. | — (Sprint 22) |
| Movimentações Financeiras | Nenhuma movimentação financeira encontrada. | Registre receitas e despesas para acompanhar o resultado da operação. |
| Simulador de Decisão | Nenhum cenário simulado ainda. | Crie um cenário para simular se vale a pena comprar, manter ou vender o lote. |
| Indicadores | Sem dados suficientes. | Cadastre lotes e movimentações para visualizar os indicadores por lote. |
| Pastos | Nenhum pasto cadastrado. | Cadastre um pasto para calcular capacidade, lotação e necessidade de arrendamento. (Sprint 22) |

---

## Responsividade

### Breakpoints
| Nome | Valor |
|------|-------|
| Mobile | `max-width: 640px` |
| Tablet | `max-width: 900px` |
| Notebook | `max-width: 1024px` |
| Desktop | `min-width: 1441px` |

### Sidebar
- Desktop: fixa, colapsável (260px → 92px)
- Mobile: drawer lateral + bottom nav

### Mobile Bottom Nav
Itens fixos no rodapé mobile: Início, Rebanho, Financeiro, Estoque, Mais

### Nota (Sprint 27): breakpoints reais são inconsistentes

A tabela acima é o padrão pretendido, mas `src/styles/app.css` na prática usa breakpoints próximos porém distintos entre regras escritas em sprints diferentes (480/560/640/720/760/900/1024/1100/1280px). Não foi consolidado nesta sprint — ver `docs/POLIMENTO_VISUAL_HERDON.md` para detalhes e o caso concreto de regras conflitantes em `.header-tabs`.

---

## Correção de layout (Sprint 27): `.action-row` sem `display: flex`

A classe `.action-row` (barra de botões de ação, usada em formulários, modais e relatórios) tinha `gap`/`flex-wrap` definidos em CSS mas **sem `display: flex`** em nenhuma regra — ou seja, essas propriedades não tinham efeito, e os botões ficavam sem espaçamento consistente entre si. Corrigido em `src/styles/app.css` (regra `.page-actions, .reports-page-actions, .action-row`). Detalhes e verificação em `docs/POLIMENTO_VISUAL_HERDON.md`.

---

## Arquivos CSS

| Arquivo | Conteúdo |
|---------|----------|
| `src/styles/tokens.css` | Variáveis CSS globais (cores, espaçamentos, tipografia) |
| `src/styles/app.css` | Layout principal, componentes base, sprint patches |
| `src/styles/ui.css` | Design system: botões, cards, tabelas, modais, inputs |
| `src/styles/layout.css` | Shell da aplicação, sidebar, main |
| `src/styles/dashboard.css` | Estilos específicos do Painel Geral |

---

## Correção de layout (Sprint 29): modais espremidos no mobile

`src/styles/layout.css` tinha regras (`.app-shell .ui-modal-overlay`/`.ui-modal`, e variantes `--sidebar-collapsed`) que reservavam espaço de sidebar fixa em **qualquer modal**, sem media query. No mobile (sidebar é um *drawer* fora da tela) isso espremia o modal a ~78px de largura — a causa real do "Menu Mais opções cortado". Corrigido restringindo essas regras a `@media (min-width: 901px)`; confirmado por medição (`getComputedStyle`) que o desktop não regrediu. Detalhes em `docs/MOBILE_POLISH_HERDON.md`.

---

## Pendências visuais (futuras sprints)

- [ ] Padronizar uso de `EmptyState` component em vez de `<div className="empty-state">` inline
- [ ] Unificar KpiCard vs. kpi-card direto nas páginas
- [ ] Limpar CSS acumulado de sprints anteriores em `app.css` (9k+ linhas) — inclui consolidar breakpoints e resolver a duplicidade de `.header-tabs` (Sprint 27) e de `.ui-modal-overlay`/`.mobile-fab` (Sprint 29)
- [ ] Adicionar skeleton loading coerente entre páginas
- [ ] Revisar responsividade das tabelas em mobile (scroll horizontal)
- [ ] Tela de Indicadores: empty state mais específico por métrica
- [ ] Animações de transição entre abas (suave, sem exagero)
- [ ] Decidir se modais mobile devem ser bottom sheet (`align-items: flex-end`) — uma regra já escrita para isso é sobreposta por outra sem media query (Sprint 29)
- [ ] Verificação visual real (mobile/desktop) com conta autenticada — nenhuma sprint até a 27 conseguiu fazer isso (sem credenciais de teste)
