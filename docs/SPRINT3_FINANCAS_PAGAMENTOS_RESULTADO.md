# Sprint 3 — Resultado: Finanças, Pagamentos e Alertas Internos — HERDON

> Sprint único (Fase 0 auditoria + Fase 1 visão geral + esta entrega de controle de status/alertas internos). Data: 2026-07-05.
> Escopo: só `src/pages/FinanceiroPage.jsx` + `src/styles/pagamentos.css` (novo). Nenhuma migration, nenhum RLS, nenhum arquivo de domínio financeiro crítico foi alterado.

---

## 1. O que foi implementado nesta entrega

### 1.1 Ação de pagar dentro da Visão Geral de Pagamentos
Cada linha das faixas **Vencidas / Vencendo hoje / Próximos 7 dias / Previstas-pendentes** agora tem um botão **"Marcar como pago"**. Ao clicar:
- grava `status: 'pago'`, `pago: true` e `data_pagamento: <hoje>` na `movimentacoes_financeiras` via `updateOperationalRecord` (mesma função já usada por `alternarPagamentoPago`, só generalizada para qualquer despesa, não só as da categoria "Pagamento Diário");
- some da faixa de origem no próximo cálculo (porque `isMovimentacaoPaga` passa a ser verdadeiro) e passa a aparecer em "Pagas";
- não tem botão na faixa "Pagas" (já está paga, ação redundante).

### 1.2 Alerta financeiro interno (dentro da própria área financeira)
Acima dos 5 blocos, um resumo compacto:
- se houver conta vencida, vencendo hoje ou vencendo em até 7 dias → mostra badges com as contagens ("2 contas vencidas", "1 vencendo hoje", "3 vencendo em até 7 dias");
- se não houver nenhuma urgência → mensagem única "✓ Nenhuma conta vencida ou vencendo nos próximos 7 dias.".

Isso **não é um sistema de alerta novo**: é só uma leitura resumida das mesmas listas (`vencidas`/`vencendoHoje`/`proximosSeteDias`) que já aparecem nos blocos abaixo — zero cálculo adicional, zero persistência própria, zero id/severidade — só uma exibição a mais dentro da tela de Finanças.

### 1.3 Leitura visual
- Badge de situação por linha (já existia da Fase 1, mantido: `Vencida`/`Hoje`/`Em breve`/`Prevista`/`Paga`, cores danger/warning/info/neutral/success);
- borda colorida à esquerda de cada card de bloco (`src/styles/pagamentos.css`), reforçando visualmente a urgência sem depender só da cor do badge;
- estado vazio da faixa "Vencidas" ganhou um subtítulo ("Tudo em dia por aqui.") — as demais faixas mantêm o texto simples já existente (não adicionado a todas para não engordar a tela com frases repetidas);
- CSS responsivo (`@media max-width: 640px`) para o alerta financeiro empilhar em telas pequenas — o restante (tabelas) já usa as classes globais `.table-responsive`/`.data-table` já testadas em todo o app.

---

## 2. O que foi reaproveitado (nada duplicado)

| Necessidade | Função/dado reaproveitado | Arquivo |
|---|---|---|
| Vencidas / vencendo em N dias | `listarContasFinanceiras(db, 7)` | `domain/hojeNaFazenda.js` (não alterado) |
| O que conta como "pago"/"cancelado"/data de vencimento | `isMovimentacaoPaga`, `isMovimentacaoCancelada`, `getDataVencimento` | `domain/financeiroStatus.js` (não alterado) |
| Persistir a mudança de status | `updateOperationalRecord` | `services/operationalPersistence.js` (não alterado, já usado por `alternarPagamentoPago`) |
| Nome do lote vinculado | `lotes` já carregado no `db` da página | — |
| Contagens do alerta interno | As próprias listas de `pagamentosVisaoGeral` (Fase 1) | `FinanceiroPage.jsx` (mesmo objeto, sem recálculo) |

Nenhuma fórmula de DRE, fluxo de caixa ou `getResumoLote` foi tocada — confirmado por `git diff --stat -- src/domain/` vazio.

---

## 3. Como o status funciona agora (resumo para o produtor)

| Situação | Como é identificada | Ação disponível |
|---|---|---|
| **Vencida** | Despesa não paga com `data_vencimento` anterior a hoje | Marcar como pago |
| **Vencendo hoje** | Despesa não paga com `data_vencimento` = hoje | Marcar como pago |
| **Vencendo em até 7 dias** | Despesa não paga com `data_vencimento` entre amanhã e +7 dias | Marcar como pago |
| **Prevista/pendente** | Despesa não paga sem vencimento próximo (`status='previsto'` ou vencimento distante/ausente) | Marcar como pago |
| **Paga** | `status='pago'` ou legado `pago=true` | — (já concluída, mostra a data em que foi paga via `data_pagamento`, quando registrada) |

A aba **"Pagamentos Diários"** (formulário de lançamento rápido + lista com checkbox "pago") continua exatamente como estava — nenhuma funcionalidade removida, nenhum campo alterado. Ela é uma ferramenta específica (lançar e marcar rapidamente uma categoria); a Visão Geral é o painel amplo de todas as contas a pagar.

---

## 4. Arquivos alterados

- `src/pages/FinanceiroPage.jsx` — modificado (função `marcarComoPago`, componente `PagamentosBucket` estendido com ação e estado vazio com subtítulo, novo componente `PagamentosAlerta`)
- `src/styles/pagamentos.css` — novo (bordas coloridas dos blocos + estilo do alerta financeiro)
- `docs/SPRINT3_FINANCAS_PAGAMENTOS_AUDITORIA.md` — já existia (Fase 0)
- `docs/SPRINT3_FINANCAS_PAGAMENTOS_RESULTADO.md` — este documento

Nenhuma migration criada. Nenhuma policy RLS alterada. Nenhuma tabela nova.

---

## 5. Validação

| Comando | Resultado |
|---|---|
| `npm run lint` | ✅ 0 erros |
| `npm run test` | ✅ 789/789 testes, 0 falhas |
| `npm run build` | ✅ build ok — `FinanceiroPage-*.css` contém as novas classes `.pagamentos-bucket`/`.pagamentos-alerta` (confirmado via grep no `dist/`) |
| `git diff --stat -- src/domain/` | Vazio — nenhum arquivo de domínio tocado |
| `git status --short -- src/` | Só `src/pages/FinanceiroPage.jsx` (modificado) e `src/styles/pagamentos.css` (novo) |

**Validação visual:** o preview local segue com o mesmo loop de boot de autenticação já registrado nas fases anteriores desta sprint (reproduzido de forma idêntica em itens não relacionados a esta mudança), impedindo clique-a-clique nesta sessão. Como evidência alternativa: (1) o build gera o CSS novo corretamente; (2) a lógica de classificação dos 5 grupos foi validada com um script Node isolado usando dados fixos (vencida/hoje/em 3 dias/prevista distante/paga/cancelada) na Fase 1, e essa lógica não foi alterada nesta entrega, só estendida com a ação de marcar como pago (que reaproveita `updateOperationalRecord`, já coberto indiretamente pelos testes de persistência existentes). Recomenda-se validação visual num ambiente estável antes do próximo sprint que dependa desta tela.

---

## 6. O que ficou para o próximo sprint (backlog, nada implementado)

- **Contas a receber vencidas/próximas** — `listarContasFinanceiras` só olha despesas hoje. Se o produtor precisar da mesma visão para receitas em atraso, a função precisaria de um parâmetro para incluir `tipo === 'receita'` (extensão pequena, não recalculada do zero) — não implementado agora porque não foi pedido nesta entrega e mexeria numa função usada também pelo Dashboard.
- **Recorrência automática** — não existe (nem foi criada). Continua só parcelamento manual (`parcela_num`/`parcela_total`, gera N linhas de uma vez). Uma recorrência de verdade ("todo dia 10") exigiria campo novo na tabela (ex.: `recorrencia_tipo`) e rotina de geração — **precisaria de migration**, então fica para quando for aprovada.
- **Telegram/WhatsApp/e-mail** — não implementado, como pedido. Hoje o alerta financeiro é só visual, dentro da própria tela de Finanças. Para virar notificação de verdade (push/WhatsApp), o caminho natural é integrar com a Central de Alertas ainda não construída (`docs/AUDITORIA_COMPLETA_HERDON.md`, item "unificar os dois sistemas de alerta") — sem essa central, uma notificação externa ficaria isolada, reproduzindo a mesma fragmentação de alertas já diagnosticada. Recomenda-se que Telegram/WhatsApp só entre depois da central existir.
- **Estado vazio com subtítulo em todas as 5 faixas** — só a faixa "Vencidas" ganhou subtítulo nesta entrega (evitar textos repetidos sem necessidade); se fizer sentido, é trivial estender às demais.
- **Paginação/período nos blocos** — sem limite hoje; aceitável para o volume atual do piloto, mas vale revisar se a base de lançamentos crescer muito.
