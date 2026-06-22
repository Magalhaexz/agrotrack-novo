# Teste Manual — Modo Campo Offline (Sprint 23)

## Método

Este ambiente não tem credenciais de login reais para a aplicação — o app
exige sessão Supabase autenticada antes de renderizar qualquer página
operacional (confirmado: o dev server abre normalmente na tela de login,
sem erros de console, mas sem uma conta para entrar não é possível avançar
até o Painel Geral, o cabeçalho com o indicador de conexão, ou a página
Sincronização). Não é a primeira vez nesta limitação — o mesmo já foi
registrado nas Sprints 21 e 22.

Como o roteiro de 10 passos do plano depende de estar logado, ele **não foi
executado ponta a ponta no navegador** nesta sessão. Em vez disso, a
verificação foi feita em camadas:

1. **30 testes automatizados** (`src/services/offlineQueue.test.js`,
   `src/domain/offlineCaptureLogic.test.js`) exercitando exatamente a lógica
   que o roteiro manual pediria: adicionar à fila, listar pendências, marcar
   sincronizado, marcar erro, retry manual, duplicidade local, pesagem,
   despesa, ocorrência, RPC de movimentação de pasto (incluindo o caso de o
   lote já ter mudado de pasto antes de sincronizar), comportamento sem
   sessão e comportamento offline/online — usando mocks de `supabase.from`/
   `supabase.rpc`, não chamadas reais à rede, mas exercitando o código real
   de produção (não uma simulação separada).
2. **Build de produção e dev server** verificados sem erros de console na
   tela de login (sanity check de que a aplicação inteira ainda carrega
   corretamente com os módulos novos).
3. **Revisão de código** de toda a integração nova (`App.jsx`,
   `AppHeader.jsx`, `SincronizacaoPage.jsx` e os 4 modais).

## Roteiro do plano — o que pôde ser confirmado e como

| Passo do roteiro | Confirmado via | Resultado |
|---|---|---|
| 1. Abrir o HERDON online | Build + dev server | ✅ Carrega sem erro de console |
| 2. Carregar dados iniciais | — | ⚠️ Não verificado (precisa login) |
| 3. Simular offline pelo DevTools | Teste automatizado (`setOnline(false)` simulando `navigator.onLine`) | ✅ `sincronizarFilaOffline` corretamente não tenta enviar nada e mantém a pendência quando offline |
| 4. Registrar pesagem | Teste automatizado (`pesagem_lote sincroniza via createOperationalRecord...`) | ✅ Item entra na fila com todos os campos; sincroniza corretamente quando online |
| 5. Mover lote de pasto | Teste automatizado (`movimentacao_pasto sincroniza via RPC...` e o caso de bloqueio) | ✅ Usa a RPC `mover_lote_para_pasto`; bloqueia com mensagem amigável se o lote já mudou de pasto antes de sincronizar |
| 6. Lançar despesa | Teste automatizado (`despesa_simples sincroniza como movimentacoes_financeiras...`) | ✅ Grava com `tipo: 'despesa'`, mesmas colunas do financeiro |
| 7. Conferir painel de sincronização | Revisão de código de `SincronizacaoPage.jsx` | ⚠️ Lógica revisada e consistente com os testes; **não visto renderizado no navegador** |
| 8. Voltar online | Teste automatizado (transição de `isOnline()`) | ✅ Coberto na lógica; o disparo real do evento `online` do navegador (em `useOfflineAutoSync`) é colagem de React não testável sem ambiente de DOM — não foi exercitado ao vivo |
| 9. Sincronizar | Testes automatizados (retry automático e manual) | ✅ |
| 10. Conferir dados reais nas telas | — | ⚠️ Não verificado (precisa login + dados reais) |

## O que NÃO foi possível verificar nesta sessão

- O indicador de conexão renderizado de fato no cabeçalho (cores, texto,
  comportamento ao clicar).
- A página Sincronização renderizada (cards de contagem, lista, modais
  abrindo/fechando).
- O comportamento real do evento `online`/`offline` do navegador disparando
  a sincronização automática em uma aba de verdade.
- Que um registro sincronizado pelo Modo Campo realmente aparece nas telas
  existentes (ex.: uma pesagem registrada offline aparecendo na lista de
  pesagens do lote depois de sincronizar).

Recomenda-se executar o roteiro completo de 10 passos manualmente, com uma
conta real, antes deste recurso chegar ao piloto.

## Gates de qualidade

| Gate | Resultado |
|------|-----------|
| `npm test` | ✓ 454 testes, 0 falhas (30 novos) |
| `npm run lint` | ✓ sem erros |
| `npm run build` | ✓ build completo |
