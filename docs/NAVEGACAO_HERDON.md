# Navegação HERDON — Sprint 12

## Nova estrutura de menu

### Início
| ID | Label | Ícone |
|----|-------|-------|
| dashboard | Painel Geral | LayoutDashboard |

### Operação
| ID | Label | Ícone |
|----|-------|-------|
| modoCurral | Modo Curral | Warehouse |
| fazendas | Fazendas | MapPin |
| pastagens | Pastos | Tractor |
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
| relatoriosGerenciais | Relatórios Gerenciais | FileBarChart |

### Gestão
| ID | Label | Ícone |
|----|-------|-------|
| relatorios | Relatórios | FileBarChart |
| funcionarios | Equipe | Users |
| minhaAssinatura | Planos e Assinatura | CreditCard |
| configuracoes | Configurações | Settings |
| perfil | Perfil | User |

### Ajuda (Sprint 26)
| ID | Label | Ícone |
|----|-------|-------|
| guiaCriador | Guia do Criador | HelpCircle |
| suporte | Suporte | LifeBuoy |

`suporte` já existia (rota `/suporte`), mas só era alcançável pelo banner do Dashboard. A partir da Sprint 26 também aparece no menu principal. `guiaCriador` é uma página nova — ver [GUIA_CRIADOR_APP_HERDON.md](GUIA_CRIADOR_APP_HERDON.md).

---

## Sprint 24 — Hub de Relatórios

A partir da Sprint 24, `relatoriosGerenciais` (resumo executivo já existente) foi renomeado de "Relatórios" para "Relatórios Gerenciais" para não conflitar com o novo hub `relatorios`, adicionado na seção Gestão. O novo hub leva a 5 páginas sem rota própria (acessadas só por `pageId`, via `onNavigate`):

| ID | Label |
|----|-------|
| relatorioLote | Relatório do Lote |
| relatorioPesagens | Relatório de Pesagens |
| relatorioFinanceiro | Relatório Financeiro |
| relatorioPastagens | Relatório de Pastos |
| relatorioResumoGeral | Resumo Geral da Fazenda |

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

## Sprint 31 — Modo Curral

`modoCurral` é uma página nova, primeira da seção Operação, pensada como
ponto de entrada rápido para registro no campo/curral (pesagem,
movimentação de pasto, despesa, ocorrência). Permissão: `dashboard:ver`
(mesmo padrão de `sincronizacao` — qualquer perfil logado acessa a tela; as
4 ações dentro dela continuam protegidas individualmente por
`pesagens:editar`/`lotes:editar`/`financeiro:editar`/`sanitario:editar`).
Não foi adicionada a nenhuma lista de módulos por plano (`MODULES_BASIC`
etc.) em `src/services/subscriptions.js` — mesmo tratamento de
`sincronizacao`, que também não está nessas listas; decisão de plano fica
fora do escopo desta sprint. Ver
[MODO_CURRAL_HERDON.md](MODO_CURRAL_HERDON.md).

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
- `HelpCircle` — Guia do Criador (Sprint 26)
- `LifeBuoy` — Suporte (Sprint 26)
- `Circle` — checklist de primeiros passos, item pendente (Sprint 26)
- `Warehouse` — Modo Curral (Sprint 31)
- `ClipboardPlus`, `ListChecks`, `MapPinned` — cards de ação dentro do Modo Curral (Sprint 31)
