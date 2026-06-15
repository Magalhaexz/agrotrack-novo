# SPRINT13B — Pagamentos Diários + Lembretes no Dashboard

## Campos de pagamentos implementados
- descrição do pagamento
- valor
- data de vencimento/data do pagamento
- modalidade/método (Dinheiro, Pix, Cartão, Boleto, Transferência, Cheque, Outro)
- status pago/não pago
- checkbox para marcar pago
- observação opcional

## Como funciona pago/não pago
- Pagamentos são listados na aba **Pagamentos Diários** do Financeiro.
- O checkbox alterna o campo `pago` no item e persiste via padrão operacional existente.
- O status visual usa badge claro em português (Pago / Não pago).

## Como os lembretes do dashboard são calculados
- Fonte: movimentações financeiras compatíveis com categoria de pagamento diário.
- Métricas:
  - Pagamentos vencidos
  - Vencem hoje
  - Próximos pagamentos
  - Total pendente (somente não pagos)
  - Total pago
- Exibição segura e concisa, com fallback textual: “Nenhum pagamento pendente”.

## Estratégia de persistência
- Reuso da estrutura existente de `movimentacoes_financeiras`.
- Sem tabela nova de backend e sem alteração de schema.
- Criação/edição via `createOperationalRecord` e `updateOperationalRecord`.

## O que intencionalmente não foi alterado
- Sem mudanças em schema Supabase, RLS, auth, sync core e diagnóstico manual serverless.
- Sem exposição de token/chaves/sessão/header em UI/logs.

## Testes
- `rg -n "^(<<<<<<<|=======|>>>>>>>)" -S .` → sem conflitos.
- `npm run build` → sucesso.
- `npm run lint` → sucesso com warnings preexistentes (sem erros).
