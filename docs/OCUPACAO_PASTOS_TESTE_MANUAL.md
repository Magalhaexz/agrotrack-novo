# Teste manual — Ocupação de Pastos, UA e Alertas de Lotação (Sprint 25)

## Limitação honesta

Como nas sprints anteriores, não tenho credenciais de uma conta autenticada do HERDON (login via Supabase Auth). Não foi possível abrir o app logado, cadastrar fazenda/pasto/lote reais e clicar pelas telas com dados de verdade.

O que foi verificado de fato:

1. `npm run dev` sobe normalmente (porta 5173); a tela de login renderiza sem erro no console.
2. `npm test` — 500 testes passam (26 novos desta sprint), incluindo todos os cenários pedidos: pasto vazio, pasto com 1 lote, pasto com múltiplos lotes, lote sem pasto, pasto sem área, pasto sem capacidade, classificação ok/atenção/acima da capacidade, relatório de pastos com ocupação, alertas de lotação, Dashboard com pastos em atenção, e dados nulos/undefined sem quebrar.
3. `npm run lint` — sem erros.
4. `npm run build` — build de produção concluído com sucesso, incluindo o chunk atualizado de `PastagensPage`.
5. Revisão de código confirma a integração: `PastagensPage` lê `calcularOcupacaoPastos(db)`; `DashboardPage` lê `hojeNaFazenda.pastos.pastosAcimaCapacidade`/`pastosEmAtencao`; `buildAlerts()` gera os 4 novos tipos de alerta `tipo: 'pasto'`; `RelatorioPastagensPage`/`buildRelatorioPastagens` expõem status e percentual de ocupação.

## Roteiro para quando houver uma conta de teste

1. Criar uma fazenda.
2. Criar um pasto com área (ex.: 10 ha) e capacidade (ex.: 1 UA/ha) → capacidade total 10 UA.
3. Criar um segundo pasto sem capacidade preenchida.
4. Criar um lote com ~50 cabeças vinculado ao primeiro pasto (deve ficar "acima da capacidade") e outro lote pequeno vinculado ao segundo pasto (deve ficar "sem dados suficientes").
5. Criar um lote sem pasto vinculado.
6. Abrir **Pastos**: confirmar a coluna "Lotação" — lotes ativos · cabeças estimadas, badge de status, e a mensagem de aviso correspondente (acima da capacidade / informe área e capacidade).
7. Abrir o **Dashboard** ("Hoje na Fazenda"): confirmar as prioridades "X pasto(s) está(ão) acima da capacidade" (crítico) e, se aplicável, "X pasto(s) precisa(m) de atenção" (atenção); confirmar o card "Pastos em uso" listando os pastos pelo nome.
8. Abrir **Alertas**: confirmar os alertas "Pasto acima da capacidade" (crítico), "Pasto sem área ou capacidade informada" (informativo) e "Lote sem pasto definido" (aviso).
9. Abrir **Relatórios → Relatório de Pastos**: confirmar a tabela "Ocupação por pasto" com cabeças/peso estimados, percentual e status; confirmar a lista "Lotes sem pasto definido".
10. Testar o resumo por WhatsApp do Relatório de Pastos e confirmar que menciona pastos acima da capacidade/em atenção.
11. Testar um pasto recém-criado sem nenhum lote — confirmar que aparece como "Vazio" e não gera alerta.
12. Redimensionar para largura mobile e confirmar que a nova coluna/cartão de lotação continua legível.
