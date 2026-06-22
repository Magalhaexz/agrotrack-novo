# Teste manual — Relatórios (Sprint 24)

## Limitação honesta

Não tenho credenciais de uma conta autenticada do HERDON (login é via Supabase Auth, com e-mail/senha ou Google). Por isso **não foi possível** abrir o app logado e clicar pelas telas reais com dados de produção/teste.

O que foi verificado de fato:

1. `npm run dev` sobe normalmente (porta 5173) e a tela de login (`LoginPage`) renderiza sem erro no console.
2. `npm test` — 474 testes passam, incluindo os 18 novos testes de `relatorios.test.js` e `whatsappResumo.test.js` (cálculo de GMD entre pesagens, fluxo financeiro, ocupação de pastos, resumo geral, textos de WhatsApp e estados vazios).
3. `npm run lint` — sem erros.
4. `npm run build` — build de produção concluído com sucesso; os 6 novos chunks (`RelatoriosPage`, `RelatorioLotePage`, `RelatorioPesagensPage`, `RelatorioFinanceiroPage`, `RelatorioPastagensPage`, `RelatorioResumoGeralPage`) foram gerados sem erro de import/export.
5. Revisão de código confirma que os 6 `pageId` novos estão registrados em `pageMap` (`App.jsx`), `permissoesPorPagina` (`auth/perfis.js`) e `MODULES_BASIC` (`services/subscriptions.js`), e que o item "Relatórios" aparece em `navSections` (seção Gestão).

## Roteiro para quando houver uma conta de teste

1. Login → menu **Gestão** → **Relatórios**.
2. Confirmar os 5 cards (Lote, Pesagens, Financeiro, Pastos, Resumo Geral) e que cada um abre a página correspondente.
3. Relatório do Lote: trocar o seletor de lote, confirmar peso/GMD/custo/receita/lucro/ROI e a tabela de últimas pesagens.
4. Relatório de Pesagens: aplicar filtro de fazenda/lote/período e confirmar variação e GMD entre pesagens consecutivas.
5. Relatório Financeiro: aplicar filtro de período e confirmar entrou/saiu/saldo, maiores custos e contas vencidas/próximas.
6. Relatório de Pastos: confirmar contagem de pastos com/sem lote e lotes sem pasto.
7. Resumo Geral: confirmar totais, alertas críticos e pendências do dia.
8. Em cada relatório, clicar **Copiar resumo** e colar em qualquer campo de texto para confirmar o conteúdo.
9. Clicar **Enviar resumo por WhatsApp** e confirmar que abre `wa.me` com o texto preenchido (ou o seletor de compartilhamento nativo, em celular).
10. Clicar **Baixar PDF** e confirmar que abre a caixa de impressão do navegador com cabeçalho/rodapé.
11. Testar um lote sem pesagens, uma fazenda sem lançamentos financeiros e uma fazenda sem pastos cadastrados — confirmar as mensagens de estado vazio.
12. Redimensionar para largura mobile e confirmar que filtros e tabelas continuam usáveis.
