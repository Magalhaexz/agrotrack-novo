# Modo Curral — Teste Manual (Sprint 31)

## O que foi possível testar nesta sessão

- Servidor de desenvolvimento (`npm run dev`) iniciado com sucesso, sem
  erros de build/runtime.
- Página carregada em viewport mobile (375×812): nenhum erro no console do
  navegador, nenhum erro no log do servidor.
- A tela inicial é o login (`LoginPage`) — confirmado via snapshot de
  acessibilidade, sem necessidade de credenciais reais para chegar até ali.

## O que NÃO foi possível testar

Sem credenciais de uma conta autenticada disponíveis neste ambiente, **não
foi possível** entrar no app e abrir o Modo Curral de fato. Esta é a mesma
limitação documentada em todas as sprints desde a Sprint 22 (ver
[BETA_PILOTO_READY_HERDON.md](BETA_PILOTO_READY_HERDON.md)) — nunca houve
acesso a uma conta de teste com dados (fazenda, lote, pasto) carregados.

Itens do roteiro de teste manual da Sprint 31 que ficam pendentes para
quem tiver acesso autenticado:

1. Abrir Modo Curral (menu Operação → Modo Curral).
2. Registrar pesagem online — confirmar toast "Pesagem registrada.
   Sincronizando agora." e o registro aparecendo (e desaparecendo) em
   "Ver pendências".
3. Simular offline (DevTools → Network → Offline) e registrar pesagem —
   confirmar a mensagem de pendência e o registro listado em
   Sincronização com status "Aguardando sincronização".
4. Mover lote de pasto online — confirmar que o pasto do lote realmente
   muda nas telas de Lotes/Pastagens.
5. Mover lote de pasto offline — confirmar que sincroniza ao reconectar e
   que o pasto muda corretamente depois.
6. Lançar despesa rápida — confirmar que aparece em Financeiro depois de
   sincronizar.
7. Registrar ocorrência — confirmar que aparece na aba de sanidade do lote
   (campo `sanitario`, conforme limitação documentada em
   [OFFLINE_HERDON.md](OFFLINE_HERDON.md)).
8. Conferir os contadores de pendência no bloco de sincronização do Modo
   Curral e na página Sincronização — devem bater.
9. Reconectar e confirmar sincronização automática (sem precisar clicar em
   nada) dos itens que ficaram pendentes.
10. Testar os 3 estados vazios (sem fazenda, sem lote, offline sem dados
    carregados) com uma conta nova/limpa.
11. Testar em 375px, 390px, 430px e 768px (DevTools responsive mode) e em
    desktop — confirmar que o grid de ações vai de 2 colunas para 1 coluna
    no breakpoint de 480px, sem scroll horizontal e sem texto cortado.

## Verificação indireta feita

Como alternativa à verificação visual autenticada, foram conferidos:

- `npm test` (546 testes, 0 falhas) — inclui 8 testes novos para a lógica
  de estado vazio do Modo Curral (`src/domain/modoCurral.test.js`).
- `npm run lint` — 0 erros.
- `npm run build` — build de produção concluído sem erros (inclusive os 4
  novos ícones SVG usados pela página, adicionados ao shim
  `src/lucide-react.js`).
- Leitura completa do código dos 4 modais reaproveitados, confirmando que
  os campos e validações batem com os pedidos na sprint (lote, data, peso
  médio, quantidade de cabeças; lote, pasto atual/destino, motivo;
  fazenda, categoria, valor; fazenda, lote opcional, tipo, descrição).

## Recomendação

Antes de liberar para o piloto, alguém com conta autenticada e dados
cadastrados deve percorrer os 11 itens da lista acima e marcar o resultado
aqui ou em um documento de acompanhamento.
