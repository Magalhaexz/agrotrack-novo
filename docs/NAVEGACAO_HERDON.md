# Navegação HERDON — Sprint 12

## Nova estrutura de menu

### Início
| ID | Label | Ícone |
|----|-------|-------|
| dashboard | Painel Geral | LayoutDashboard |

### Operação
| ID | Label | Ícone |
|----|-------|-------|
| fazendas | Fazendas | MapPin |
| lotes | Lotes e Rebanho | Beef |
| animais | Animais | ClipboardList |
| pesagens | Pesagens | Scale |
| estoque | Estoque | Package |
| suplementacao | Suplementação | Leaf |
| sanitario | Sanidade | Syringe |
| tarefas | Tarefas | CheckSquare |

### Financeiro
| ID | Label | Ícone |
|----|-------|-------|
| financeiro | Movimentações Financeiras | Receipt |
| fluxoCaixa | Fluxo de Caixa | TrendingUp |
| custosCompartilhados | Rateio de Custos | Layers |

### Decisão
| ID | Label | Ícone |
|----|-------|-------|
| resultados | Resultado dos Lotes | BarChart3 |
| cenarios | Simulador de Decisão | Calculator |
| indicadores | Indicadores | Activity |
| relatoriosGerenciais | Relatórios | FileBarChart |

### Gestão
| ID | Label | Ícone |
|----|-------|-------|
| funcionarios | Equipe | Users |
| minhaAssinatura | Planos e Assinatura | CreditCard |
| configuracoes | Configurações | Settings |
| perfil | Perfil | User |

---

## Nomes alterados (Sprint 12)

| Antes | Depois |
|-------|--------|
| Dashboard | Painel Geral |
| Lotes | Lotes e Rebanho |
| Financeiro (nav) | Movimentações Financeiras |
| Nutrição e Suplementação | Suplementação |
| Sanitário (nav) | Sanidade |
| Cenários | Simulador de Decisão |
| Resultados e Relatórios | Resultado dos Lotes |
| Minha Assinatura | Planos e Assinatura |
| Funcionários (nav) | Equipe |
| Relatórios Gerenciais (página) | Relatórios |

---

## Grupos renomeados

| Antes | Depois |
|-------|--------|
| (sem título) | Início |
| Cadastros | Operação |
| Nutrição / Suplementação | (integrado em Operação) |
| Planejamento Premium | (removido do nav principal) |
| Estoque | (integrado em Operação) |
| Financeiro | Financeiro |
| Operação | (integrado em Operação) |
| Análises e Resultados | Decisão |
| Configurações | Gestão |

---

## Mobile Bottom Nav

| Posição | ID | Label |
|---------|-----|-------|
| 1 | dashboard | Início |
| 2 | lotes | Rebanho |
| 3 | financeiro | Financeiro |
| 4 | estoque | Estoque |
| 5 | mais | Mais (abre menu completo) |

---

## Páginas existentes fora do menu principal

Estas páginas existem em `pageMap` mas não aparecem na nav principal. Continuam acessíveis via navegação programática:

- `comparativo` — Comparativo de lotes
- `evolucaoRebanho` — Evolução do rebanho
- `acompanhamentoPeso` — Acompanhamento de peso
- `calendarioOperacional` — Calendário operacional
- `planejamento` — Planejamento
- `dashboardPremium` — Dashboard premium
- `pastagens` — Pastos
- `custos` — Custos
- `rotina` — Rotina

---

## Arquivo de configuração

`src/navigation/navConfig.js`

---

## Ícones customizados (Sprint 12)

Os ícones abaixo foram adicionados ao arquivo `src/lucide-react.js` para uso no menu:

- `CreditCard` — Planos e Assinatura
- `FileBarChart` — Relatórios
- `BarChart3` — Resultado dos Lotes
- `Calculator` — Simulador de Decisão
- `Layers` — Rateio de Custos
- `Receipt` — Movimentações Financeiras
