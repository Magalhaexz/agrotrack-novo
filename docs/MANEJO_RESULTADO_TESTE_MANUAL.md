# Manejo, Sanidade e Suplementação — Teste Manual (Sprint 33)

> **Atualização (Sprint 34):** testado com conta autenticada real. Card
> "Manejo, sanidade e suplementação" confirmado no Relatório do Lote:
> registrei 1 ocorrência tipo "Manejo" via Modo Curral (sincronizada para
> `sanitario`) e o card mostrou corretamente "Sanidade: Em dia" com o
> insight "Este lote possui registro sanitário recente."; sem nenhum
> registro em `consumo_suplementacao`, mostrou "Suplementação: Sem
> registro no período" e "Ainda faltam dados de pesagem para relacionar
> suplementação e ganho de peso." — nenhuma quebra, nenhum `R$0,00`
> enganoso. **Não testado nesta sessão:** registro de suplementação real
> (`consumo_suplementacao`), status "Custo de suplemento elevado",
> "Suplementação com desempenho positivo", prioridade combinada de
> revisão de manejo no Dashboard, e Modo Curral autenticado para ações
> de sanidade (que de qualquer forma não têm atalho, por decisão da
> própria Sprint 33). Detalhes completos da sessão:
> [QA_PILOTO_HERDON.md](QA_PILOTO_HERDON.md).

## O que foi possível testar nesta sessão (Sprint 33, sem conta autenticada)

- Servidor de desenvolvimento iniciado com sucesso, sem erros de build.
- Tela de login carrega sem erros de console ou de servidor.
- 36 testes automatizados novos cobrindo as classificações, fórmulas e
  integrações com números calculados à mão e confirmados pelo teste.

## O que NÃO foi possível testar

Sem credenciais de uma conta autenticada disponíveis neste ambiente,
**não foi possível** abrir o Relatório do Lote, o resumo WhatsApp gerado
na tela, Hoje na Fazenda/Dashboard ou o Modo Curral logado, para confirmar
visualmente a leitura de manejo. Mesma limitação documentada em todas as
sprints desde a 22 (ver
[BETA_PILOTO_READY_HERDON.md](BETA_PILOTO_READY_HERDON.md)).

Roteiro pendente de execução por alguém com acesso autenticado:

1. Lote sem nenhum registro sanitário — confirmar "Sem registro" no card
   e mensagem correta.
2. Lote com sanidade recente (último manejo há poucos dias) — confirmar
   "Em dia".
3. Lote com suplementação registrada (`consumo_suplementacao`) — confirmar
   custo total, custo/cabeça e custo/@ corretos no card.
4. Lote com custo de suplemento alto em relação ao custo/@ do lote —
   confirmar status "Custo de suplemento elevado" e o aviso complementar
   no card de Decisão de Venda.
5. Lote com GMD bom (acima da meta) e suplementação registrada — confirmar
   "Suplementação com desempenho positivo" e o insight "Acompanhe se o
   ganho de peso permanece acima da meta."
6. Lote com GMD baixo (abaixo da meta) e suplementação registrada —
   confirmar "Acompanhar GMD" e a mensagem de comparação.
7. Relatório do Lote (PDF/cópia) — confirmar que o texto exportado inclui
   o card de manejo.
8. Resumo WhatsApp — confirmar a linha `Manejo: Sanidade <status> ·
   Suplemento: R$ X/cab · Insight: <texto>` (ou a linha de fallback
   "Manejo: sem registros suficientes." quando não há dados).
9. Hoje na Fazenda/Dashboard — se houver lote com sanidade "Revisar
   manejo" ou suplemento "Custo elevado", confirmar a prioridade "N lotes
   precisam de revisão de manejo ou suplementação." e que o clique leva
   para Resultado dos Lotes.
10. Modo Curral — confirmar que **não há** atalho de sanidade/suplemento
    (decisão desta sprint, documentada em
    [MANEJO_RESULTADO_HERDON.md](MANEJO_RESULTADO_HERDON.md)) e que isso
    não quebra nada nas 4 ações existentes.
11. Lote com ocorrência sanitária crítica recente (ex.: mortalidade
    registrada há poucos dias) — confirmar que aparece como "Revisar
    manejo" mesmo sendo um registro recente.

## Verificação indireta feita

- `npm test`: 607 testes, 0 falhas (573 antes da sprint + 34 novos: 26 em
  `manejoResultado.test.js`, 4 em `hojeNaFazenda.test.js`, 2 em
  `relatorios.test.js`, 2 em `whatsappResumo.test.js`).
- `npm run lint`: 0 erros.
- `npm run build`: build de produção concluído sem erros.
- Leitura completa do código integrado (`RelatorioLotePage.jsx`,
  `whatsappResumo.js`, `hojeNaFazenda.js`, `relatorios.js`) confirmando
  que os campos novos (`manejoResultado`, `sinaisComplementaresVenda`) são
  lidos com `?.`/valores padrão, sem risco de quebrar a tela quando
  ausentes.

## Recomendação

Antes de liberar para o piloto, alguém com conta autenticada e pelo menos
2-3 lotes com sanidade/suplementação em estágios diferentes (sem
registro, em dia, custo alto, GMD bom/baixo) deve percorrer os 11 itens
acima.
