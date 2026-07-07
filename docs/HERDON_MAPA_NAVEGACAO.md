# HERDON — Mapa de Navegação

Estrutura oficial do menu lateral (`src/navigation/navConfig.js`), `pageId`s, permissões por módulo e páginas fora do menu com justificativa. Atualizado na Sprint 18 (ver [SPRINT18_NAVEGACAO_UX_PAGINAS_ORFAS.md](SPRINT18_NAVEGACAO_UX_PAGINAS_ORFAS.md) para o detalhe da auditoria).

Fonte de verdade: `navSections` em `src/navigation/navConfig.js` (o que aparece no menu) + `pageMap` em `src/App.jsx` (todas as páginas roteáveis, incluindo as sem entrada de menu) + `permissoesPorPagina` em `src/auth/perfis.js` (quem pode ver cada uma).

## Estrutura atual do menu (7 grupos, 35 itens)

### Painel
| pageId | Label | Permissão |
|---|---|---|
| `dashboard` | Painel Geral | `dashboard:ver` |
| `alertas` | Central de Alertas | `dashboard:ver` |

### Campo e Rebanho
| pageId | Label | Permissão | Observação |
|---|---|---|---|
| `lotes` | Lotes e Rebanho | `lotes:ver` | |
| `pesagens` | Pesagens | `pesagens:ver` | |
| `acompanhamentoPeso` | Acompanhamento de Peso | `animais:ver` | Sprint 18 — órfã corrigida |
| `modoCurral` | Modo Curral | `dashboard:ver` | |
| `pastagens` | Pastos | `pastagens:ver` | |
| `suplementacao` | Nutrição e Suplementação | `suplementacao:ver` | |
| `sanitario` | Sanidade | `sanitario:ver` | Inclui Agenda Sanitária (seção interna, não página separada) |
| `tarefas` | Tarefas | `tarefas:ver` | |
| `rotina` | Rotinas da Equipe | `sanitario:ver` | Sprint 18 — órfã corrigida (CRUD; o Calendário já lista os eventos gerados) |
| `animais` | Animais | `animais:ver` | |
| `calendarioOperacional` | Calendário | `sanitario:ver` | |
| `comparativo` | Comparativo de Lotes | `comparativo:ver` | Sprint 18 — órfã corrigida |
| `evolucaoRebanho` | Evolução do Rebanho | `evolucao_rebanho:ver` | Sprint 18 — órfã corrigida |

### Estoque
| pageId | Label | Permissão |
|---|---|---|
| `estoque` | Produtos e Insumos | `estoque:ver` |

### Finanças
| pageId | Label | Permissão | Observação |
|---|---|---|---|
| `financeiro` | Visão Financeira | `financeiro:ver` | |
| `custos` | Custos por Lote | `financeiro:ver` | Sprint 18 — órfã corrigida; espelha lançamento em `movimentacoes_financeiras` |
| `fluxoCaixa` | Fluxo de Caixa | `financeiro:ver` | |
| `custosCompartilhados` | Rateio de Custos | `financeiro:ver` | |
| `relatorioFinanceiro` | Relatórios Financeiros | `relatorios:ver` | |

### Decisão
| pageId | Label | Permissão |
|---|---|---|
| `cenarios` | Simulador de Decisão | `cenarios:ver` |
| `resultados` | Resultado dos Lotes | `resultados:ver` |
| `decisoesFazenda` | Decisões da Fazenda | `dashboard:ver` |
| `indicadores` | Indicadores | `indicadores:ver` |
| `relatorios` | Relatórios | `relatorios:ver` |
| `relatoriosGerenciais` | Painel Gerencial | `relatorios_gerenciais:ver` |

### Gestão
| pageId | Label | Permissão |
|---|---|---|
| `fazendas` | Fazendas | `fazendas:ver` |
| `equipeAcessos` | Equipe e Acessos | `acessos:gerenciar` (só proprietário/admin) |
| `importacao` | Importação | `dados:importar` |
| `minhaAssinatura` | Planos e Assinatura | `assinatura:gerenciar` (só proprietário/admin) |
| `configuracoes` | Configurações | `configuracoes:ver` |
| `sincronizacao` | Sincronização | `dashboard:ver` |
| `perfil` | Perfil | `perfil:ver` |

### Ajuda
| pageId | Label | Permissão |
|---|---|---|
| `guiaCriador` | Guia do Criador | (sem restrição) |

## Permissões por papel (resumo)

- **Proprietário/Admin**: `*` — acesso total, único papel que gerencia Equipe e Assinatura.
- **Gerente**: quase tudo exceto `acessos:gerenciar`/`assinatura:gerenciar` (Sprint 6 — "apenas proprietário/admin gerencia equipe e plano").
- **Operador**: módulos operacionais (lotes, animais, pesagens, sanidade, estoque, tarefas) + visão/decisão (resultados, cenários, indicadores) — **sem** `financeiro:ver`, então `financeiro`/`custos`/`fluxoCaixa`/`custosCompartilhados` ficam ocultos para esse papel mesmo estando no menu.
- **Visualizador**: só leitura (`:ver`) em quase tudo, sem nenhuma permissão de edição/exclusão nem gestão de equipe.

Ver `src/auth/perfis.js` para a matriz completa (`permissoesPorPerfil`).

## Páginas fora do menu (com justificativa)

| pageId | Página | Por que fica fora |
|---|---|---|
| `funcionarios` | FuncionariosPage | Duplicata intencional de `equipeAcessos` — ponto de entrada único é `equipeAcessos` desde a Sprint 6/13. Página mantida no `pageMap` (não apagada), sem link de menu. |
| `dashboardPremium` | DashboardPremiumPage | Rollup de KPIs que hoje já aparecem em outros lugares (Dashboard principal, Painel Gerencial) — adicionar ao menu duplicaria caminho de acesso ao mesmo dado. Achado da Sprint 18, ver duplicações. |
| `planejamento` | PlanejamentoPage | Embrulha em abas: Pastagens, Evolução do Rebanho, Indicadores, Cenários, Relatórios Gerenciais — 4 dessas 5 já têm entrada própria no menu depois da Sprint 18. Manter no menu junto com os itens que ela embrulha seria redundante. |
| `relatorioLote`, `relatorioPesagens`, `relatorioPastagens`, `relatorioResumoGeral`, `relatorioFinanceiro`* | Páginas de relatório | Não são órfãs — acessadas via `RelatoriosPage` (menu "Relatórios"), que lista e linka cada uma. *`relatorioFinanceiro` tem entrada própria no grupo Finanças, os outros 4 não. |
| `termos`, `privacidade`, `cobranca`, `suporte` | Páginas legais/institucionais | Rotas fixas (`src/navigation/routes.js`), acessadas por link direto (rodapé, onboarding), não fazem sentido no menu principal. |
| `assinaturaBloqueada` | AssinaturaBloqueadaPage | Tela de estado (bloqueio de conta), não é destino de navegação — renderizada condicionalmente pelo gate de assinatura. |

## Barra inferior mobile (`MobileBottomNav`)

Independente de `navSections` — lista fixa e curta, não afetada por mudanças no menu principal:

1. Início (`dashboard`)
2. Rebanho (`lotes`)
3. Financeiro (`financeiro`)
4. Estoque (`estoque`)
5. Mais → abre o menu completo (drawer com todos os `navSections`)

## Recomendações futuras

- Avaliar se `IndicadoresPage` merece entrada própria no menu (hoje só acessível via `PlanejamentoPage`, que está fora do menu) — precisa de uma leitura mais aprofundada do conteúdo antes de decidir grupo/label (pendência da Sprint 18).
- Decisão de produto pendente sobre `DashboardPremiumPage`/`PlanejamentoPage`: manter como estão (código morto de fato, sem uso), reaproveitar conteúdo único delas em outro lugar, ou remover formalmente após confirmação de que nada mais referencia esses `pageId`s.
- `Relatórios` (grupo Decisão) e `Painel Gerencial` têm nomes parecidos o suficiente para confundir um usuário novo — considerar renomear em conjunto com uma sprint de revisão de copy, não isoladamente.
- Considerar mover `relatorioFinanceiro` (hoje em Finanças) para dentro do fluxo de `Relatórios` junto dos outros 4 sub-relatórios, por consistência — avaliado nesta sprint mas não alterado (risco de quebrar o hábito de quem já usa o atalho direto em Finanças, sem dado suficiente para decidir sozinho).
