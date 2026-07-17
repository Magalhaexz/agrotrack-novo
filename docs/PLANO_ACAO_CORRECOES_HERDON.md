# Plano de Ação — Correções HERDON (pós Auditoria 360º)

> Baseado nos achados de [AUDITORIA_GERAL_HERDON.md](AUDITORIA_GERAL_HERDON.md) e
> [MATRIZ_TESTES_FUNCIONAIS_HERDON.md](MATRIZ_TESTES_FUNCIONAIS_HERDON.md). IDs entre parênteses
> referenciam a matriz.

## Onda 0 — Integridade imediata

| Item | Status |
|---|---|
| Venda/morte/transferência não sincronizava `animais.qtd` (VND-01) | ✅ Corrigido |
| RPC `registrar_saida_lote` do Telegram com o mesmo bug (VND-02) | ✅ Corrigido |
| Ajuste de Lotação reabria o mesmo bug (LOT-1) | ✅ Corrigido |
| Escalada de privilégio via auto-atualização de `perfil` (S-01) | ✅ Corrigido |
| **Estoque: tipos "Tratamento"/"Saída" falham silenciosamente (EST-01)** | ✅ **Corrigido** (retomada, mesmo dia) — enum canônico `['consumo','tratamento','ajuste','perda','venda']`, "Saída" removida do formulário, serviço nunca mais falha silenciosamente |
| Entrada de estoque não gera despesa financeira (EST-02) | ✅ **Corrigido** (mesma retomada) — lógica de persistência duplicada removida |
| RLS não reflete a matriz granular de permissões por módulo (S-02) | 🔴 Pendente — requer decisão de escopo (ver Sprint C) |
| Planejamento de suplementação não persiste na nuvem (SUP-01) | 🔴 Pendente — feature incompleta, já avisada na UI |
| **Fazenda com lote encerrado não podia ser excluída nem inativada pela mensagem de erro (CAMPO-01)** | ✅ **Corrigido** (teste de campo) — mensagem orienta inativação (fluxo que já existia); `pastagens`/`tarefas` entraram na checagem de vínculos |
| **Cadastro de lote só mostrava a fazenda ativa em conta multi-fazenda (CAMPO-04)** | ✅ **Corrigido** (teste de campo) — campo virou `<select>` real com todas as fazendas ativas |
| **UA/capacidade de pasto com a mesma causa raiz do bug de venda (CAMPO-02 = PST-1/PST-2)** | ✅ **Corrigido** (teste de campo) |

**Como EST-01 foi resolvido**: em vez de mapear "Tratamento"/"Saída" para tipos já existentes, optei
por um enum canônico explícito e escopado a Estoque (não um refactor de todo o app): "Tratamento"
virou um tipo real de primeira classe (gera despesa própria `tratamento_sanitario` quando vinculado a
um lote); "Saída" foi removida do formulário por ser redundante com o próprio título da tela e não
cobrir nenhum caso de uso que Consumo/Tratamento/Ajuste/Perda já não cobrissem. Documentado em
[AUDITORIA_GERAL_HERDON.md](AUDITORIA_GERAL_HERDON.md) §2.1.

**Por que S-02 não foi corrigido nesta rodada**: fechar a granularidade no RLS (`operador` não pode
gravar em Financeiro/Custos/Funcionários mesmo via API direta) é uma mudança de schema/policies que
toca múltiplas tabelas — maior risco de regressão sem poder validar ao vivo nesta sessão (sem
navegador autenticado, confirmado em duas rodadas). Diferente de S-01 (uma vulnerabilidade isolada e
crítica, corrigida
imediatamente), este é um endurecimento estrutural que merece sua própria sprint com testes de
regressão por perfil.

## Onda 1 — Operações essenciais

- **LOT-2** — Pesagem lançada pelo modal do detalhe do lote (`LotesPage.jsx`) não usa
  `recalcularPesoAtualLote`; uma pesagem retroativa sobrescreve o "peso atual" com um valor mais
  antigo. Unificar os dois caminhos de "registrar pesagem" (`PesagensPage.jsx` e o modal do lote) em
  uma única implementação.
- **PST-1/PST-2** — ✅ corrigidos no teste de campo (CAMPO-02): `calcularUaPorLote`/
  `calcularUaTotalFazenda` agora aceitam a contagem canônica (`lote.qtd`) e filtram lotes
  finalizados/vendidos, com compatibilidade retroativa para quem ainda não passa esse argumento.
- **EST-01/EST-02** — ✅ já corrigidos na Onda 0 (ver acima).
- **CAMPO-01/CAMPO-04** — ✅ já corrigidos no teste de campo (ver Onda 0 acima).
- **SAN/Tarefas/Alertas** — sem achados P0/P1 novos; manter como estão.

## Onda 2 — Simplificação da experiência (Estoque e Suplementação)

Ver diagnóstico completo e fluxo proposto em
[AUDITORIA_UX_ESTOQUE_SUPLEMENTACAO.md](AUDITORIA_UX_ESTOQUE_SUPLEMENTACAO.md). Resumo do que essa
onda deve entregar:
- Unificar a categorização "item nutricional" (EST-04) em uma única fonte de verdade.
- Padronizar a regra de saldo negativo entre Estoque e Suplementação (EST-05) — substituir o
  `window.confirm` nativo por um modal do próprio design system.
- Simplificar o cadastro de item de estoque (unidade como dropdown, não texto livre; campos
  avançados atrás de "Mais informações").
- Adicionar exclusão/estorno de movimentação de estoque geral (EST-03).
- Persistir o planejamento de suplementação (SUP-01) ou remover a aba até estar pronta — hoje é uma
  feature "meio implementada" que a própria UI avisa não funcionar totalmente.

## Onda 3 — Consistência

- **FIN-01** — alinhar as categorias fixas do filtro do Financeiro com os slugs reais gerados por
  Estoque/Suplementação (`compra_estoque`, `consumo_estoque`, `nutricao`), para essas despesas
  pararem de sumir do filtro por categoria.
- **FAZ-2/PST-3/S-03** — padronizar o gate de permissão visual (`disabled` no botão, não só bloqueio
  no clique) em Fazendas, Pastagens e Funcionários, replicando o padrão já correto de
  Tarefas/Sanidade/Lotes.
- **TG-02** — alinhar a ordem de fallback `totalAnimais`/`lote.qtd` entre `respostasConsulta.js` e
  `saudeLote.js` (hoje ambos chegam ao mesmo número, mas por ordens de precedência diferentes —
  arrumar antes que um dia divirjam de verdade).
- **FAZ-1** — remover as ~380 linhas de código morto (`_executarDiagnosticoNuvem`,
  `_reconectarNuvem`, `_sincronizarFazendasComNuvem`) em `FazendasPage.jsx`.

## Onda 4 — Gestão avançada

- **S-02** (se não resolvido antes) — endurecer RLS para refletir a matriz granular de
  `src/auth/perfis.js` por módulo, não só o gate binário visualizador × resto.
- **S-05/S-06** — revisar funções `SECURITY DEFINER` expostas via RPC público (avaliar
  `SECURITY INVOKER` onde possível) e ligar a proteção de senha vazada no painel do Supabase Auth.
- **A-02** — decidir o destino do painel de alertas legado (`alertas_resolvidos`/`alertas_adiados`)
  coexistindo com a Central unificada: migrar ou aposentar formalmente.
- Relatórios/consolidado/equipe/assinatura: sem achados novos de severidade alta nesta rodada — não
  priorizar aqui além do que já está no backlog de sprints anteriores.

## Onda 5 — Piloto real

- Validar com produtores reais os fluxos redesenhados de Estoque/Suplementação (Onda 2).
- Medir tempo por operação e taxa de erro nos 5 cenários do diagnóstico UX
  ([AUDITORIA_UX_ESTOQUE_SUPLEMENTACAO.md](AUDITORIA_UX_ESTOQUE_SUPLEMENTACAO.md) §Cenários de teste).
- **Pré-requisito**: uma sessão de QA com navegador autenticado (credenciais de `.env.e2e`
  funcionando) para validar visualmente tudo o que esta auditoria só confirmou por código —
  especialmente os 8 viewports e 4 perfis do escopo original, que não puderam ser exercidos aqui.

---

## Proposta de sprints

### Sprint A — Estoque: fechar as duas falhas de persistência
**Status: ✅ concluído** (Onda 0, retomada do mesmo dia).
**Objetivo**: nenhuma ação de Estoque falha silenciosamente ou deixa de gerar o lançamento
financeiro esperado.
**Resolveu**: EST-01, EST-02. **Não resolveu**: EST-03 (exclusão/estorno de movimentação geral de
estoque) — fica para uma sprint futura, não fazia parte do P0/P1 original.
**Arquivos alterados**: `src/pages/EstoquePage.jsx`, `src/services/movimentacoes.js`.
**Migrations**: nenhuma (era lógica de aplicação, não schema, como previsto).
**Testes**: 6 testes novos em `movimentacoes.test.js`. **Teste manual dos 5 cenários do diagnóstico
UX não foi feito** — sem navegador autenticado nesta sessão (mesma limitação da rodada anterior).
**Critério de aceite**: atingido por código/testes automatizados; validação visual real fica
pendente para quando houver navegador autenticado.

### Sprint B — Pastagens/Lotes: fonte única de contagem de animais
**Status: parcialmente concluído** (teste de campo, mesmo dia).
**Resolveu**: PST-1, PST-2 (= CAMPO-02) e CAMPO-04 (seletor de fazenda no cadastro de lote), além de
CAMPO-01 (exclusão/inativação de fazenda). **Não resolveu**: LOT-2 (pesagem retroativa pelo modal do
detalhe do lote pode corromper "peso atual") — fica para uma sprint futura, é um achado separado,
não fazia parte do relato de campo desta rodada.
**Arquivos alterados**: `src/domain/unidadeAnimal.js`, `src/domain/ocupacaoPastos.js`,
`src/pages/PastagensPage.jsx`, `src/domain/indicadoresEstrategicos.js`, `src/components/LoteForm.jsx`,
`src/pages/FazendasPage.jsx`.
**Testes**: 3 testes novos em `tests/unidadeAnimal.test.js` (contagem canônica via lote, filtro de
lote finalizado, propagação em `calcularDiagnosticoCapacidade`). **Sem teste automatizado** para
CAMPO-01/CAMPO-04 (mudanças de UI/wiring de React sem infraestrutura de teste de componente no
projeto) — verificado por leitura de código, não por clique real.
**Pendente**: LOT-2, e validação visual real de tudo isto (sem navegador autenticado nesta sessão).

### Sprint C — Suplementação intuitiva, redesenho de UI e RLS granular
**Resolve**: SUP-01 = CAMPO-05 (persistir ou remover Dietas — teste de campo confirmou que **não
existe tabela `dietas` no banco**, é 100% local hoje), EST-04/EST-05 (unificar categorização e regra
de saldo negativo), o redesenho funcional de Estoque/Suplementação (wizard "Registrar Uso"/"Criar
dieta" em etapas, ações rápidas de copiar/repetir/pausar/finalizar dieta, empty states, unidade como
dropdown — ver `AUDITORIA_UX_ESTOQUE_SUPLEMENTACAO.md` §Proposta), e S-02 (RLS granular por módulo).
Persistir Dietas de verdade exigirá uma migration nova (tabela `dietas` + policies RLS), não é só
lógica de aplicação como os itens já corrigidos nesta auditoria.
**Pré-requisito explícito**: sessão de QA com navegador autenticado. Diferente das correções de
lógica pura (Sprint A/B), um redesenho de UI implementado às cegas — sem poder ver o resultado —
arrisca quebrar layouts, estados de loading/erro e responsividade de forma que só apareceria depois,
em produção. As credenciais de `.env.e2e` já falharam em duas tentativas ao longo desta auditoria
(não repetidas nesta 3ª rodada, por não trazerem informação nova).
**Dependências**: decisão de produto sobre o futuro da aba "Dietas"; sessão de QA com navegador
autenticado antes de mexer em RLS (alto risco de regressão de permissão sem poder testar ao vivo).
**Critério de aceite**: um `operador` autenticado, chamando a API diretamente (não só pela UI), não
consegue mais gravar em `movimentacoes_financeiras`/`custos`/`funcionarios`.

### Sprint D — Navegação e limpeza
**Resolve**: FAZ-1 (código morto), FAZ-2/PST-3/S-03 (gate visual de permissão), FIN-01 (categorias),
TG-02 (ordem de fallback).
**Risco**: baixo — mudanças isoladas e bem localizadas.

Nenhuma dessas sprints foi iniciada nesta rodada além do que está listado na Onda 0 como já corrigido.
