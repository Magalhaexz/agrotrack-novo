# Plano de Ação — Correções HERDON (pós Auditoria 360º)

> Baseado nos achados de [AUDITORIA_GERAL_HERDON.md](AUDITORIA_GERAL_HERDON.md) e
> [MATRIZ_TESTES_FUNCIONAIS_HERDON.md](MATRIZ_TESTES_FUNCIONAIS_HERDON.md). IDs entre parênteses
> referenciam a matriz.

## Onda 0 — Integridade imediata (parte já feita nesta sprint)

| Item | Status |
|---|---|
| Venda/morte/transferência não sincronizava `animais.qtd` (VND-01) | ✅ Corrigido |
| RPC `registrar_saida_lote` do Telegram com o mesmo bug (VND-02) | ✅ Corrigido |
| Ajuste de Lotação reabria o mesmo bug (LOT-1) | ✅ Corrigido |
| Escalada de privilégio via auto-atualização de `perfil` (S-01) | ✅ Corrigido |
| **Estoque: tipos "Tratamento"/"Saída" falham silenciosamente (EST-01)** | 🔴 Pendente — próximo item desta onda |
| RLS não reflete a matriz granular de permissões por módulo (S-02) | 🔴 Pendente — requer decisão de escopo (ver Sprint A) |
| Entrada de estoque não gera despesa financeira (EST-02) | 🔴 Pendente |
| Planejamento de suplementação não persiste na nuvem (SUP-01) | 🔴 Pendente — feature incompleta, já avisada na UI |

**Por que EST-01 não foi corrigido nesta rodada**: a correção correta depende de uma decisão de
produto — os tipos "Tratamento" e "Saída" devem (a) ser mapeados para um `tipo` real já suportado
(`consumo`/`ajuste`/`perda`), ou (b) o serviço deve ganhar esses dois tipos novos como categorias
próprias? Escolher errado aqui reclassificaria retroativamente o significado de saídas de estoque.
Recomendo tratar como o primeiro item do Sprint A (abaixo), com uma pergunta objetiva ao produto
antes de implementar.

**Por que S-02 não foi corrigido nesta rodada**: fechar a granularidade no RLS (`operador` não pode
gravar em Financeiro/Custos/Funcionários mesmo via API direta) é uma mudança de schema/policies que
toca múltiplas tabelas — maior risco de regressão sem poder validar ao vivo nesta sessão (sem
navegador autenticado). Diferente de S-01 (uma vulnerabilidade isolada e crítica, corrigida
imediatamente), este é um endurecimento estrutural que merece sua própria sprint com testes de
regressão por perfil.

## Onda 1 — Operações essenciais

- **LOT-2** — Pesagem lançada pelo modal do detalhe do lote (`LotesPage.jsx`) não usa
  `recalcularPesoAtualLote`; uma pesagem retroativa sobrescreve o "peso atual" com um valor mais
  antigo. Unificar os dois caminhos de "registrar pesagem" (`PesagensPage.jsx` e o modal do lote) em
  uma única implementação.
- **PST-1/PST-2** — Cálculo de UA/status de capacidade de pasto usa `animais` cru em vez de
  `lote.qtd`; e o KPI de UA da fazenda não filtra lotes finalizados/vendidos. Mesma classe de bug de
  VND-01, precisa da mesma correção (seguir `lote.qtd` como fonte canônica).
- **EST-01** (se ainda não decidido no fim da Onda 0) e **EST-02** — fechar as duas falhas de
  persistência de Estoque.
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
**Objetivo**: nenhuma ação de Estoque falha silenciosamente ou deixa de gerar o lançamento
financeiro esperado.
**Resolve**: EST-01, EST-02, EST-03.
**Arquivos prováveis**: `src/pages/EstoquePage.jsx`, `src/services/movimentacoes.js`.
**Migrations**: nenhuma esperada (é lógica de aplicação, não schema).
**Testes**: unitários em `movimentacoes.test.js` para os tipos corrigidos; teste manual dos 5
cenários do diagnóstico UX.
**Riscos**: decisão de produto sobre o significado de "Tratamento"/"Saída" (ver Onda 0).
**Critério de aceite**: nenhum tipo do dropdown de saída falha silenciosamente; toda entrada com
custo > 0 gera despesa.

### Sprint B — Pastagens/Lotes: fonte única de contagem de animais
**Resolve**: PST-1, PST-2, LOT-2.
**Arquivos prováveis**: `src/domain/unidadeAnimal.js`, `src/domain/ocupacaoPastos.js`,
`src/pages/LotesPage.jsx`, `src/domain/pesagensLote.js`.
**Testes**: regressão garantindo que UA/status de pasto e "peso atual" seguem `lote.qtd`/pesagem
mais recente mesmo quando `animais` diverge (mesmo padrão de teste já usado em
`movimentacoes.test.js` para lote.qtd × animais.qtd).
**Ordem recomendada**: depois do Sprint A (mesma classe de bug, mesmo padrão de correção já
validado nesta auditoria).

### Sprint C — Suplementação intuitiva e RLS granular
**Resolve**: SUP-01 (persistir ou remover Dietas), EST-04/EST-05 (unificar categorização e regra de
saldo negativo), S-02 (RLS granular por módulo).
**Dependências**: decisão de produto sobre o futuro da aba "Dietas"; sessão de QA com navegador
autenticado antes de mexer em RLS (alto risco de regressão de permissão sem poder testar ao vivo).
**Critério de aceite**: um `operador` autenticado, chamando a API diretamente (não só pela UI), não
consegue mais gravar em `movimentacoes_financeiras`/`custos`/`funcionarios`.

### Sprint D — Navegação e limpeza
**Resolve**: FAZ-1 (código morto), FAZ-2/PST-3/S-03 (gate visual de permissão), FIN-01 (categorias),
TG-02 (ordem de fallback).
**Risco**: baixo — mudanças isoladas e bem localizadas.

Nenhuma dessas sprints foi iniciada nesta rodada além do que está listado na Onda 0 como já corrigido.
