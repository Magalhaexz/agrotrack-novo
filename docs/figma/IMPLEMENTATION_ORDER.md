# HERDON — Ordem aprovada de implementação

Executar em pequenos PRs/sprints. Cada sprint deve passar pelo checklist antes de iniciar o próximo.

| Sprint | Escopo | Dependências | Riscos | Aceite | Fora de escopo |
|---:|---|---|---|---|---|
| 1 | Tokens e componentes básicos | `TOKENS.md`, `COMPONENTS.md` | Divergência entre CSS atual e Conceito A | Tokens e estados principais reproduzidos | Regras de negócio |
| 2 | Shell, sidebar, header, fazenda e bottom nav | Sprint 1, `NODES_MAP.md` | Quebrar permissões ou rotas | Desktop/mobile com shell aprovado | Novos módulos |
| 3 | Login | Shell, `LoginPage.jsx` | Auth/OAuth/recuperação | Estados de login preservados | Alterar Supabase Auth |
| 4 | Painel Geral | Shell, Dashboard | Alertas e dados fictícios | Dashboard coincide com Figma | Novos indicadores |
| 5 | Lotes | Shell, componentes | Ações sensíveis e filtros | Desktop/mobile e estados completos | Alterar cálculos |
| 6 | Pesagens, Pastos e Estoque | Lotes, componentes | GMD, UA, RPCs e saldo | Fluxos sem fórmula nova | Banco/RPC |
| 7 | Financeiro, Resultados e Decisões | componentes, regras financeiras | Status, DRE e dados insuficientes | Totais e estados coerentes | Nova fórmula |
| 8 | Sanidade, Nutrição e Agenda | estoque, tarefas, responsáveis | Consumo, recorrência e Telegram | Fluxos e estados preservados | Alterar Telegram |
| 9 | Alertas, Indicadores e Relatórios | motor unificado, DRE | Duplicação e filtros | Mesmas fontes canônicas | Novo motor |
| 10 | Fazendas, Funcionários, Equipe, Acessos e Importação | permissões, convites | Autoelevação e escopo | Convites e importação preservados | Alterar RLS |
| 11 | Perfil, Configurações, Assinatura, Sincronização e Guia | shell e conta | Auth, billing, backup | Estados e confirmações completos | Novo billing |
| 12 | Responsividade e acessibilidade sistêmicas | Sprints 1–11 | Overflow e foco | 1440/1366/768/375/320 validados | Nova tela |
| 13 | Remoção segura do CSS legado | Todas as telas validadas | Regressão visual | CSS removido somente quando sem uso | Remoção antecipada |
| 14 | Motion e microinterações no código | Tokens e estados | Movimento excessivo/sem reduced motion | Contrato de `MOTION.md` implementado | Animação decorativa |

## Regras de execução

- Ler toda a pasta `docs/figma/` antes de cada sprint.
- Conferir a rota e o node correspondente antes de editar.
- Preservar permissões, RLS, serviços, RPCs, cálculos e estados.
- Fazer validação visual e funcional no navegador.
- Rodar lint, testes, build e `git diff --check` no sprint.
- Não misturar refatoração ampla com redesign.
