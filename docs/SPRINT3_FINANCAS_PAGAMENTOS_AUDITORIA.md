# Sprint 3 — Fase 0: Auditoria de Finanças e Pagamentos — HERDON

> Diagnóstico antes de qualquer alteração. Data: 2026-07-05.
> **Nenhum código, CSS, rota, Supabase ou migration foi alterado nesta fase.** Método: leitura direta de `src/pages/`, `src/domain/`, `src/services/`, consulta ao Supabase (colunas reais das tabelas + policies RLS).

---

## 1. Estrutura financeira atual (visão geral)

O financeiro do HERDON já é bem mais completo do que a v1 desta auditoria (Sprint 1) registrou por alto — quase tudo que o enunciado pede (status previsto/pago/vencido, vencidas, próximas do vencimento) **já existe em algum lugar do código**, só não está unificado numa única tela de "Pagamentos". A base de dados (`movimentacoes_financeiras`) já tem todas as colunas necessárias; o que falta é reaproveitar o que já existe numa visão dedicada.

Duas camadas coexistem, sem conflito:

| Camada | Papel |
|---|---|
| `src/domain/financeiroStatus.js` | Normaliza status (`previsto`/`realizado`/`pago`/`cancelado`) e datas (`data_competencia`/`data_vencimento`/`data_pagamento`), com compatibilidade para lançamentos legados sem esses campos |
| `src/domain/fluxoCaixa.js` (`calcularFluxoCaixa`) | Agrega `totalRecebido`/`totalPago`/`saldoCaixa`/`contasAReceber`/`contasAPagar`/`previstoFuturo`/`vencido` a partir da lista de movimentações — **fonte única** de fluxo de caixa, reaproveitada por `FluxoCaixaPage` e por `buildRelatorioFinanceiro` |
| `src/domain/hojeNaFazenda.js` (`listarContasFinanceiras`) | Já separa **vencidas** e **próximas do vencimento** (janela padrão de 3 dias, parametrizável) — reaproveitada pelo Dashboard ("Hoje na Fazenda") e por `RelatorioFinanceiroPage` |
| `src/domain/resumoLote.js` (`getResumoLote`) | Resultado financeiro realizado por lote — **não foi tocado nesta auditoria, nem será** (regra do sprint) |
| `computeDRE()` dentro de `FinanceiroPage.jsx` | DRE consolidada da fazenda — **função local da página**, não é domínio puro (ver §5) |

---

## 2. Telas e abas financeiras existentes

| Tela | `pageId` | O que mostra |
|---|---|---|
| **Movimentações Financeiras** (`FinanceiroPage.jsx`) | `financeiro` | 4 abas internas (ver tabela abaixo) |
| **Fluxo de Caixa** (`FluxoCaixaPage.jsx`) | `fluxoCaixa` | Filtros por lote/status/período + KPIs (recebido, pago, saldo, a receber, a pagar, previsto futuro, **vencido**) + tabela de movimentações com status colorido |
| **Rateio de Custos** (`CustosCompartilhadosPage.jsx`) | `custosCompartilhados` | Lança um custo geral (energia, arrendamento, mão de obra etc.) e rateia entre lotes por cabeças/peso/igualitário (`domain/rateio.js` + `services/custosCompartilhados.js`) |
| **Relatório Financeiro** (`RelatorioFinanceiroPage.jsx`) | `relatorioFinanceiro` | Resumo do período + **"Contas vencidas"** e **"Contas próximas do vencimento"** (usa `listarContasFinanceiras`) — já existe hoje, só não é a tela principal de navegação (chega só pelo hub Relatórios ou pelo item que a Fase 1 da sidebar adicionou) |
| **Custos** (`CustosPage.jsx`) | `custos` | Página órfã (sem link na sidebar, backlog da Fase 0/1 de navegação) — usa a tabela legada `custos`, não `movimentacoes_financeiras` |

### Abas internas de `FinanceiroPage.jsx`

| Aba (`tab`) | Rótulo | Conteúdo |
|---|---|---|
| `dre` | DRE | KPIs de receita/despesa/resultado + gráfico mensal + distribuição de despesas (via `computeDRE`, local da página) |
| `lote` | Por Lote | Tabela de resultado por lote (usa `getResumoLote`) + gráfico de margem |
| `lanc` | Lançamentos | Lista filtrável de todas as movimentações (tipo/categoria/lote) + modal "Novo lançamento" (com parcelamento) |
| `pag` | **Pagamentos Diários** | Formulário de lançamento rápido + lista com checkbox "pago" — **mas só mostra despesas com `categoria === 'Pagamento Diário'`**, não todas as contas a pagar (ver lacuna §4) |

---

## 3. Tabelas e campos financeiros (Supabase, confirmado por `information_schema.columns`)

### `movimentacoes_financeiras` — tabela principal, já com tudo que o enunciado pediu

| Campo pedido | Existe? | Coluna real |
|---|---|---|
| tipo | ✅ | `tipo` (`receita`/`despesa`) |
| categoria | ✅ | `categoria` + `subcategoria` |
| data | ✅ | `data` |
| data_vencimento | ✅ | `data_vencimento` |
| data_pagamento | ✅ | `data_pagamento` |
| status | ✅ | `status` (`previsto`/`realizado`/`pago`/`cancelado`, com fallback para legado sem valor) |
| fazenda_id | ✅ | `fazenda_id` |
| lote_id | ✅ | `lote_id` |
| fornecedor | ✅ | `fornecedor` (e `comprador` para receitas) |
| recorrência | ⚠️ **Não existe como campo dedicado.** Existe `parcela_num`/`parcela_total` (parcelamento manual, gera N linhas de uma vez no `NovoLancamentoModal`) — não é recorrência automática (ex.: "todo dia 10") |
| — | ✅ extra | `metodo_pagamento`, `pago` (boolean legado), `observacao`, `origem`/`origem_tipo`/`origem_id` (rastreia lançamentos gerados por outras telas, ex. rateio), `metadata` (jsonb) |

### `custos` — tabela legada, campos mínimos

`id, owner_user_id, lote_id, cat, desc, data, val, metadata, fazenda_id, observacao, origem, origem_id`. **Sem** `status`, `data_vencimento`, `data_pagamento`, `fornecedor` — confirma que é a tabela antiga, hoje conciliada com `movimentacoes_financeiras` via `origem='custo'` (regra já documentada na Sprint 1: "custos legados não são contabilizados em dobro").

### RLS (consultado, não alterado)

Ambas as tabelas têm o conjunto completo de policies (`_owner` + `_same_account` para SELECT/INSERT/UPDATE/DELETE) — mesmo padrão saudável do resto do banco. **Nenhuma mudança de RLS é necessária para as Fases 1–3**, porque nenhuma tabela nova está sendo proposta e os dados já existem nas tabelas atuais.

---

## 4. Onde o app já calcula cada coisa (para não duplicar)

| Cálculo | Função | Arquivo |
|---|---|---|
| Saldo de caixa, a receber, a pagar, previsto, vencido | `calcularFluxoCaixa()` | `domain/fluxoCaixa.js` |
| Contas vencidas / próximas do vencimento (só despesas) | `listarContasFinanceiras()` | `domain/hojeNaFazenda.js` |
| DRE da fazenda | `computeDRE()` | **dentro de** `pages/FinanceiroPage.jsx` (não é domínio puro) |
| Resultado financeiro por lote | `getResumoLote()` | `domain/resumoLote.js` |
| Rateio de custo entre lotes | `ratearPorCabecas/Peso/Igualitario()` | `domain/rateio.js` |
| Resumo para relatório/WhatsApp | `buildRelatorioFinanceiro()` | `domain/relatorios.js` (chama `calcularFluxoCaixa` + `listarContasFinanceiras` — **não recalcula nada**, boa reutilização) |

Nenhuma duplicação de lógica de cálculo financeiro foi encontrada — o único ponto de atenção é que **`computeDRE` mora na página, não em `src/domain/`**, então qualquer ajuste futuro na DRE exigiria mexer em `FinanceiroPage.jsx` diretamente (não um arquivo de domínio isolado). Isso não é um problema para esta sprint (a regra é "não alterar DRE sem diagnóstico" — registrado aqui, não uma proposta de mudança).

---

## 5. O que já existe para pagamentos × o que falta

| Item pedido | Situação real |
|---|---|
| Contas vencidas | ✅ Existe (`listarContasFinanceiras` → `vencidas`), mas só para **despesas**, e só visível em `RelatorioFinanceiroPage` (não em `FinanceiroPage`) |
| Contas vencendo hoje | ⚠️ Não é um bucket separado — hoje "vencendo hoje" fica misturado dentro de "próximas" (`dias <= diasProximo`, incluindo `dias === 0`) |
| Contas vencendo em 7 dias | ⚠️ A janela padrão de `listarContasFinanceiras` é de **3 dias**, não 7 (mas a função já aceita um segundo parâmetro `diasProximo` — dá para pedir 7 dias sem alterar a função, só passando outro valor na chamada) |
| Contas pagas | ✅ Existe (`isMovimentacaoPaga`, usado no filtro de status do Fluxo de Caixa e na aba "Pagamentos Diários") |
| Contas previstas | ✅ Existe (`status === 'previsto'`, filtrável no Fluxo de Caixa) |
| Pagamentos recorrentes | ❌ Não existe. Só parcelamento manual (gera N linhas de uma vez, sem repetição automática futura) |
| Contas **a receber** vencidas/próximas | ❌ `listarContasFinanceiras` só olha despesas (`tipo === 'despesa'`) — receitas em atraso não aparecem em nenhum bucket hoje |
| Uma tela única "Pagamentos" com os 5 status separados | ❌ Não existe — os pedaços estão espalhados em 3 lugares (`FluxoCaixaPage` = KPIs agregados; `RelatorioFinanceiroPage` = vencidas/próximas só de despesa; `FinanceiroPage` aba "Pagamentos Diários" = só uma categoria específica) |

---

## 6. Lacunas reais (resumo para priorizar as próximas fases)

1. **Fragmentação, não ausência.** Quase todo dado e cálculo já existe; falta uma tela que junte tudo com os 5 status pedidos (vencido / vencendo hoje / próximos 7 dias / pago / previsto) para pagar E receber.
2. **Aba "Pagamentos Diários" é mais estreita do que parece.** Só mostra despesas com uma categoria específica (`'Pagamento Diário'`), não é uma visão geral de contas a pagar.
3. **`listarContasFinanceiras` não cobre receitas.** Se a Fase 2 precisar de "contas a receber vencidas", vai precisar generalizar essa função (ou criar uma variante) — não é um problema de dado (o campo `tipo` já existe), é só o filtro atual não olhar para `receita`.
4. **Sem recorrência real.** Se o produtor tem uma despesa mensal fixa (ex.: arrendamento), hoje ele lança manualmente todo mês ou usa o parcelamento (que tem fim definido, não é recorrência indefinida).
5. **DRE é local da página**, não domínio — qualquer mudança futura na DRE não pode ser feita num arquivo isolado de domínio sem tocar `FinanceiroPage.jsx`.

---

## 7. Riscos de duplicação a evitar nas próximas fases

- **Não criar um segundo `calcularContasPagamento()`** — a Fase 2 deve **estender** `listarContasFinanceiras()` (ex.: parâmetro para incluir receitas, ou uma segunda função pequena que reaproveita a mesma lógica de `daysBetween`/`getDataVencimento`) em vez de duplicar a filtragem de vencimento em um arquivo novo.
- **Não recriar o que a aba "Pagamentos Diários" já faz** — se a Fase 2 decidir expandir essa aba para contas a pagar em geral, o formulário de lançamento e o toggle "pago" já existem e devem ser reaproveitados, só a fonte de dados (`filter` por categoria) precisaria mudar.
- **Não duplicar o cálculo de saldo/vencido do Fluxo de Caixa** — qualquer novo card de "Pagamentos" deve chamar `calcularFluxoCaixa`/`listarContasFinanceiras`, nunca somar `movimentacoes_financeiras` de novo na mão.

---

## 8. Proposta de implementação faseada (para aprovação — nada implementado ainda)

**Fase 1 — Organização visual da área Finanças** (menor risco, só UI)
- Reaproveitar as 4 abas já existentes de `FinanceiroPage` (`dre`/`lote`/`lanc`/`pag`), deixando os rótulos mais claros para o produtor se necessário (ex.: avaliar se "Pagamentos Diários" deveria virar "Pagamentos" ou "Contas do Dia" — **sem mudar o `tab` id `pag`**, só o rótulo visível, mesmo padrão já usado com "Suporte"/"Equipe" na Fase 1 da sidebar).
- Não criar nenhuma aba nova nesta fase.
- Arquivo tocado: só `src/pages/FinanceiroPage.jsx` (rótulo `TAB_LABELS`), possivelmente CSS se o rótulo maior quebrar layout.

**Fase 2 — Pagamentos reais** (maior escopo, ainda sem migration)
- Generalizar a leitura de contas (vencidas / vencendo hoje / próximos 7 dias / pagas / previstas) reaproveitando `listarContasFinanceiras` + `calcularFluxoCaixa`, sem duplicar filtros.
- Decidir (a aprovar antes de codar): a aba "Pagamentos Diários" vira a tela de contas a pagar em geral, ou nasce uma 5ª aba nova dentro de `FinanceiroPage` para não misturar com o fluxo já em uso.
- **Nenhuma migration é necessária** — todos os campos (`status`, `data_vencimento`, `data_pagamento`, `fornecedor`) já existem na tabela. Só seria necessária uma migration se a Fase 2 decidir por recorrência automática (campo novo, ex. `recorrencia_tipo`) — e mesmo assim, a proposta seria trazida antes de qualquer criação, como pedido.
- Arquivos prováveis: `src/domain/hojeNaFazenda.js` (nova função ou parâmetro, sem quebrar a assinatura usada pelo Dashboard), `src/pages/FinanceiroPage.jsx` e/ou `src/pages/RelatorioFinanceiroPage.jsx`.

**Fase 3 — Alertas financeiros internos** (depende da Fase 2 estar pronta)
- Preparar os dados (vencido/vencendo hoje/vencendo em 7 dias) para consumo futuro por notificação — sem enviar nada (nem Telegram, nem WhatsApp, nem e-mail nesta sprint).
- Reaproveitar o mesmo motor de alertas já auditado no Sprint 1 (`domain/alertasInteligentes.js`) em vez de criar um terceiro sistema de alerta — evita reproduzir a duplicação "dois sistemas de alerta" já registrada em `docs/AUDITORIA_COMPLETA_HERDON.md`.

---

## 9. Validação desta fase

Nenhum código foi alterado — não há lint/teste/build para rodar (regra da Fase 0: só diagnóstico). Comandos serão executados a partir da Fase 1, como definido no sprint.

## 10. Próximo passo

Aguardar aprovação da proposta do §8 antes de iniciar a Fase 1 (organização visual da área Finanças).
