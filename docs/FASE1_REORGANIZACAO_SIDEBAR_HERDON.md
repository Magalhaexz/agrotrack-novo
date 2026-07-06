# Fase 1 — Reorganização da Sidebar — HERDON

> Execução da reorganização aprovada na Fase 0 (`docs/FASE0_NAVEGACAO_SIDEBAR_HERDON.md`). Data: 2026-07-05.
> **Escopo controlado**: só `src/navigation/navConfig.js` foi alterado. Nenhuma lógica, cálculo, rota, permissão, migration ou RLS foi tocada. **Aguardando validação antes de commit.**
>
> **Correção pós-revisão (mesma data):** a primeira versão desta fase incluía um item "Alertas" em Painel apontando para o mesmo `pageId` de "Decisões da Fazenda" (Decisão), o que deixava os dois itens destacados como ativos ao mesmo tempo. Corrigido a pedido do usuário: "Alertas" foi **removido da sidebar** nesta fase (fica para uma Central de Alertas própria, ver `docs/AUDITORIA_COMPLETA_HERDON.md`); "Decisões da Fazenda" permanece só em Decisão; a aba "Alertas" do header global não foi alterada. Este documento já reflete a versão corrigida.

---

## 1. Arquivo alterado

Só **um arquivo**: [`src/navigation/navConfig.js`](../src/navigation/navConfig.js). Nenhum outro arquivo de código foi tocado (`Sidebar.jsx`, `App.jsx`, `AppHeader.jsx`, `MobileBottomNav.jsx`, `routes.js`, `perfis.js` permanecem intactos — a reorganização não exigiu nada além do arquivo de configuração, confirmando o diagnóstico da Fase 0). `git diff --name-only` confirma: só `src/navigation/navConfig.js`.

## 2. Nova estrutura implementada (versão final, pós-correção)

| Grupo | Itens | `pageId` |
|---|---|---|
| **Painel** | Painel Geral | `dashboard` |
| **Campo e Rebanho** | Lotes e Rebanho · Pesagens · Modo Curral · Pastos · Nutrição e Suplementação · Sanidade · Tarefas · Animais · Calendário | `lotes` · `pesagens` · `modoCurral` · `pastagens` · `suplementacao` · `sanitario` · `tarefas` · `animais` · `calendarioOperacional` |
| **Estoque** | Produtos e Insumos | `estoque` |
| **Finanças** | Visão Financeira · Fluxo de Caixa · Rateio de Custos · Relatórios Financeiros | `financeiro` · `fluxoCaixa` · `custosCompartilhados` · `relatorioFinanceiro` |
| **Decisão** | Simulador de Decisão · Resultado dos Lotes · Decisões da Fazenda · Indicadores · Relatórios · Painel Gerencial | `cenarios` · `resultados` · `decisoesFazenda` · `indicadores` · `relatorios` · `relatoriosGerenciais` |
| **Gestão** | Fazendas · Equipe e Acessos · Importação · Planos e Assinatura · Configurações · Sincronização · Perfil | `fazendas` · `equipeAcessos` · `importacao` · `minhaAssinatura` · `configuracoes` · `sincronizacao` · `perfil` |
| **Ajuda** | Guia do Criador | `guiaCriador` |

## 3. Decisões técnicas para cada ponto em aberto da Fase 0

- **Alertas**: **não incluído na sidebar nesta fase.** A primeira versão apontava "Alertas" (Painel) para o mesmo `pageId` de "Decisões da Fazenda" (Decisão), o que deixava dois itens de sidebar ativos ao mesmo tempo. Decisão de produto do usuário: manter "Decisões da Fazenda" só em Decisão, não forçar um item "Alertas" reaproveitando outra tela, e deixar a Central de Alertas real para uma fase própria (não existe ainda uma central unificada — ver `docs/AUDITORIA_COMPLETA_HERDON.md`). A aba "Alertas" do header global (`AppHeader.jsx`) **não foi alterada** — segue existindo como já existia, sem relação com a sidebar.
- **Equipe**: `funcionarios` (rótulo antigo "Equipe") foi **removido da sidebar**; `equipeAcessos` (rótulo "Equipe e Acessos", página mais nova da Sprint 6) passou a ser o único ponto de entrada, como decidido. `FuncionariosPage.jsx` **não foi apagada** — continua registrada em `pageMap`/`permissoesPorPagina` no `App.jsx`/`perfis.js` (nenhum dos dois arquivos foi tocado), só deixou de ter link na sidebar. Mesmo tratamento já usado para "Suporte".
- **Estoque crítico / Movimentações / Consumo diário**: **não adicionados** — nenhum existe como entrada real hoje (confirmado na Fase 0). O grupo "Estoque" ficou só com "Produtos e Insumos" (`estoque`), do jeito que já funciona.
- **Pagamentos Diários / Despesas-Custos / DRE** (dentro de Finanças): **não elevados** a itens de sidebar — são abas internas de `FinanceiroPage.jsx` (`pag`/`lanc`/`dre`); criar uma entrada de sidebar para uma aba interna sem "resolver deep-link" (regra 4) resultaria em comportamento inconsistente (funciona ao entrar de fora, não faz nada se o usuário já estiver na página, pois o `pageId` não muda). Ficou de fora por decisão de regra 8/10, não por esquecimento. `custos` (`CustosPage`) continua no backlog de órfãs, como pedido na decisão 4.
- **Relatórios Financeiros**: adicionado (`relatorioFinanceiro`) — é uma página real e distinta (não uma aba), já tinha permissão própria (`relatorios:ver`), só não estava linkada direto na sidebar (só via drill-down do hub "Relatórios"). Baixo risco, sem código novo.
- **Itens que a proposta não mencionou explicitamente, mas já existiam e continuam** (para não remover capacidade sem pedido explícito): `fluxoCaixa` (Finanças), `relatoriosGerenciais` (Decisão), `animais` e `calendarioOperacional` (Campo e Rebanho), `sincronizacao` e `perfil` (Gestão).
- **Nenhuma das 7 páginas órfãs** (`comparativo`, `rotina`, `acompanhamentoPeso`, `custos`, `evolucaoRebanho`, `dashboardPremium`, `planejamento`) foi adicionada — continuam em backlog, como decidido.

## 4. Validação técnica

| Comando | Resultado |
|---|---|
| `npm run lint` | ✅ 0 erros (removidos os imports `LifeBuoy`/`Users`/`Bell`, todos órfãos após os ajustes; nenhum ícone novo precisou ficar) |
| `npm run test` | ✅ 789/789 testes, 0 falhas (nenhum teste depende da estrutura de `navConfig.js`) |
| `npm run build` | ✅ build ok |

Revalidado após a correção do item "Alertas": lint ✅ · testes ✅ 789/789 · build ✅ · `git diff --name-only` → só `src/navigation/navConfig.js`.

## 5. Validação visual (desktop + mobile)

Servidor local iniciado (`npm run dev`) e inspecionado via snapshot de acessibilidade (texto exato da árvore renderizada, mais confiável que print para conferir rótulos):

- **Desktop**: os 7 grupos aparecem na ordem e com os rótulos exatos da nova estrutura — `PAINEL` (só Painel Geral), `CAMPO E REBANHO` (9 itens), `ESTOQUE` (Produtos e Insumos), `FINANÇAS` (4 itens), `DECISÃO` (6 itens, incluindo "Decisões da Fazenda" sozinha), `GESTÃO` (7 itens), `AJUDA` (só Guia do Criador, sem Suporte). Confirmado por `preview_snapshot` antes e depois da correção — nenhum item aparece duplicado ou ativo em dois lugares.
- **Mobile**: o menu "Mais opções" (acionado pelo bottom nav) lê da mesma `navSections` e mostra os grupos corretos, incluindo os rótulos renomeados ("Nutrição e Suplementação"). Bottom nav fixo (`MobileBottomNav.jsx`) **não foi alterado** — continua Início/Rebanho/Financeiro/Estoque/Mais, como antes (regra 9). Confirmado por `preview_eval` sobre o DOM renderizado.
- **Header global** (`AppHeader.jsx`, abas Geral/Estoque/Alertas): **não foi tocado**, continua exatamente como antes — confirmado presente e inalterado na árvore de acessibilidade (regra 9 respeitada).

### Limitação encontrada durante a verificação (não é regressão desta mudança)

Ao tentar clicar nos itens da sidebar no preview para confirmar a troca de tela, a página **não navegou** — nem para "Alertas" (novo), nem para "Decisões da Fazenda" (já existia, não foi tocado), nem para "Lotes e Rebanho" (não foi tocado), nem o botão de colapsar sidebar mudou de estado. O console mostra o app reiniciando o boot de autenticação/dados em loop (`HERDON_AUTH_BOOT`/`HERDON_DATA_BOOT` repetindo centenas de vezes). Como o mesmo travamento acontece em itens que este patch **não tocou**, é uma limitação do ambiente de preview local (já documentada em sprints anteriores — várias notas em `docs/` registram "validação manual interativa não foi possível neste ambiente"), não uma regressão introduzida pela reorganização. A estrutura em si foi confirmada correta pela árvore de acessibilidade renderizada (§5 acima), que reflete fielmente o que `navConfig.js` produz — só o clique-e-navegue não pôde ser exercitado ponta a ponta nesta sessão.

## 6. Riscos restantes (nenhum bloqueia esta entrega, todos herdados da Fase 0 ou cosméticos)

1. ~~Item "Alertas" e "Decisões da Fazenda" compartilhando `pageId`~~ — **corrigido**: "Alertas" foi retirado da sidebar nesta fase, sem duplicidade de item ativo. Sem risco restante.
2. **Barra de abas do cabeçalho (`Geral`/`Estoque`/`Alertas`)** continua existindo, sem nenhuma mudança nesta fase e sem relação direta com a sidebar agora que "Alertas" não é mais item de sidebar. Ainda vale registrar para uma futura Central de Alertas decidir se essa aba é substituída, mantida ou consolidada — mas não é mais uma sobreposição imediata.
3. **`FuncionariosPage`/`equipeAcessos` (EquipePage) permanecem duas páginas de verdade** — só a sidebar foi unificada; a duplicação de código/funcionalidade continua e deve entrar em backlog de produto (decisão já era conhecida, não piora nem melhora com esta mudança).
4. **7 páginas órfãs continuam sem link** — mantidas em backlog por decisão explícita, não por omissão.
5. **Validação de clique-a-clique não foi possível neste ambiente** (§5) — recomendo conferir manualmente em ambiente com sessão estável (produção/preview publicado) antes ou logo depois do merge, phantom de qualquer navegação quebrada só apareceria lá.

## 7. Commit

**Não commitado.** Aguardando validação do usuário conforme solicitado.
