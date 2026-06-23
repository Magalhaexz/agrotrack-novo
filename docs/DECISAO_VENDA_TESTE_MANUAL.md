# Decisão de Venda — Teste Manual (Sprint 32)

## O que foi possível testar nesta sessão

- Servidor de desenvolvimento iniciado com sucesso, sem erros de build.
- Tela de login carrega sem erros de console ou de servidor.
- 24 testes automatizados novos (`src/domain/decisaoVenda.test.js` + casos
  novos em `hojeNaFazenda.test.js`, `relatorios.test.js`,
  `whatsappResumo.test.js`) cobrindo as fórmulas e classificações com
  números calculados à mão e confirmados pelo teste.

## O que NÃO foi possível testar

Sem credenciais de uma conta autenticada disponíveis neste ambiente,
**não foi possível** abrir Resultado dos Lotes, o Relatório do Lote ou o
Dashboard logado para ver a Decisão de Venda renderizada de fato. Mesma
limitação documentada em todas as sprints desde a 22 (ver
[BETA_PILOTO_READY_HERDON.md](BETA_PILOTO_READY_HERDON.md)).

Roteiro pendente de execução por alguém com acesso autenticado:

1. Lote com pesagem e financeiro completos — confirmar que o card
   "Decisão de venda e custo por arroba" no Relatório do Lote mostra
   números coerentes (arrobas, custo/@, lucro/@, status).
2. Lote sem financeiro — confirmar mensagem "Dados insuficientes" em vez
   de `R$ 0,00`.
3. Lote sem pesagem — confirmar que não quebra a tela, mesma mensagem de
   dados insuficientes.
4. Lote com custo alto (despesas grandes em relação ao peso) — confirmar
   status "Custo alto por arroba" e a mensagem de revisão.
5. Lote abaixo da meta de GMD (gmd_meta configurado, GMD real bem menor)
   — confirmar status "Abaixo da meta de ganho".
6. Simular vender hoje — confirmar que o texto "Se vender hoje: lucro
   estimado de R$ X" aparece com valor plausível.
7. Simular manter por mais dias — confirmar "Se manter por 30 dias: lucro
   estimado de R$ Y" e a diferença entre os dois.
8. Conferir Resultado dos Lotes — colunas "Custo/@" e "Decisão de venda"
   aparecendo corretamente na tabela por lote, com a cor do badge coerente
   com o status (verde para pronto, amarelo para atenção, cinza para
   dados insuficientes).
9. Conferir relatório do lote (PDF/cópia) — confirmar que o texto exportado
   inclui as novas linhas.
10. Conferir WhatsApp — confirmar a linha `Custo/@: R$ X · Lucro/@: R$ Y ·
    Status: <status>` no resumo copiado/enviado.
11. Conferir Dashboard / Hoje na Fazenda — se houver lote pronto para
    avaliação ou com custo alto, confirmar que a prioridade aparece com o
    texto certo e leva para Resultado dos Lotes ao clicar.

## Verificação indireta feita

- `npm test`: 573 testes, 0 falhas (546 antes da sprint + 27 novos: 20 em
  `decisaoVenda.test.js`, 3 em `hojeNaFazenda.test.js`, 2 em
  `whatsappResumo.test.js`, 2 em `relatorios.test.js`).
- `npm run lint`: 0 erros.
- `npm run build`: build de produção concluído sem erros.
- Leitura completa do código integrado (`RelatorioLotePage.jsx`,
  `ResultadosPage.jsx`, `whatsappResumo.js`, `hojeNaFazenda.js`)
  confirmando que os campos novos (`decisaoVenda`, `simulacaoVenda`,
  `custoPorArroba`, `lucroPorArroba`) são lidos com `?.` / valores padrão,
  sem risco de quebrar a tela quando ausentes.

## Recomendação

Antes de liberar para o piloto, alguém com conta autenticada e pelo menos
2-3 lotes em estágios diferentes (recém-formado, em crescimento, pronto
para venda, com custo alto) deve percorrer os 11 itens acima.
