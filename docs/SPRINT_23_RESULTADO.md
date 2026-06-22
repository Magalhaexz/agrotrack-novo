# Sprint 23 — Resultado

## Funcionalidade entregue

**Modo Campo Offline (MVP)** — uma fila própria, com status claro, que
permite registrar pesagem, movimentação de pasto, despesa simples e
ocorrência/manejo mesmo sem internet, sincronizando com a sessão normal do
usuário quando a conexão volta. Não é o app inteiro offline — é uma base
segura para as operações essenciais de campo. Documentação completa em
[OFFLINE_HERDON.md](OFFLINE_HERDON.md) (arquitetura) e
[MODO_CAMPO_OFFLINE_HERDON.md](MODO_CAMPO_OFFLINE_HERDON.md) (uso).

---

## O que foi construído

### Arquivos novos

| Arquivo | Descrição |
|---|---|
| `src/services/offlineQueue.js` | Fila do Modo Campo: adicionar, listar, sincronizar (tudo ou item único), idempotência local, dispatch por tipo de operação |
| `src/services/offlineQueue.test.js` | 24 testes do serviço |
| `src/domain/offlineCaptureLogic.js` | Validação pura dos 4 formulários + listas de tipo/categoria reaproveitadas do padrão existente |
| `src/domain/offlineCaptureLogic.test.js` | 6 testes de validação |
| `src/hooks/useOfflineQueueStatus.js` | Estado reativo da fila + conexão, para UI |
| `src/hooks/useOfflineAutoSync.js` | Sincronização automática ao reconectar, montada uma vez em `App.jsx` |
| `src/components/ConnectionIndicator.jsx` | Indicador Conectado / Sem internet / N pendências |
| `src/components/offline/RegistrarPesagemOfflineModal.jsx` | Formulário de pesagem (lote, data, peso médio, cabeças, observações) |
| `src/components/offline/RegistrarMovimentacaoPastoOfflineModal.jsx` | Formulário de movimentação de pasto (reaproveita lógica de motivos/validação da Sprint 21) |
| `src/components/offline/RegistrarDespesaOfflineModal.jsx` | Formulário de despesa simples |
| `src/components/offline/RegistrarOcorrenciaOfflineModal.jsx` | Formulário de ocorrência/manejo |
| `src/pages/SincronizacaoPage.jsx` | Painel: contadores, lista de pendências, retry individual e geral, atalhos para os 4 registros |
| `docs/OFFLINE_HERDON.md` | Arquitetura técnica |
| `docs/MODO_CAMPO_OFFLINE_HERDON.md` | Documentação de uso/produto |
| `docs/OFFLINE_TESTE_MANUAL.md` | Roteiro e resultado do teste manual |

### Arquivos modificados

| Arquivo | O que mudou |
|---|---|
| `src/App.jsx` | Monta `useOfflineAutoSync`; estende `syncStatus` com `offlineOnline`/`offlinePendentes`; registra a rota `sincronizacao` |
| `src/components/AppHeader.jsx` | Renderiza `ConnectionIndicator` no cabeçalho, clicável para abrir a página Sincronização |
| `src/auth/perfis.js` | Permissão `sincronizacao: 'dashboard:ver'` — qualquer perfil logado pode ver a própria fila |
| `src/navigation/navConfig.js` | Item "Sincronização" no menu Gestão |
| `src/lucide-react.js` | Ícone `RefreshCw` adicionado |
| `src/styles/app.css` | Estilos do indicador de conexão |

Nenhuma migration nova. Nenhuma alteração em Asaas, planos, cobrança ou
landing page.

---

## 1. O que foi implementado offline

Uma fila local (`localStorage`, chave `herdon-campo-offline-queue`) com o
formato pedido: `id_local`, `tipo_operacao`, `payload`, `status`,
`tentativas`, `erro`, `criado_em`, `sincronizado_em` — mais `owner_user_id`
(isolamento por conta) e `chave_idempotencia` (proteção contra duplo envio),
necessários para correção mas fora da lista original.

## 2. Quais operações funcionam offline

| Operação | Sincroniza com | Observação |
|---|---|---|
| Pesagem de lote | `createOperationalRecord('pesagens', ...)` | Tela própria no Modo Campo |
| Pesagem individual (por animal) | `createOperationalRecord('pesagens', ...)` | Fila já aceita o tipo; **sem tela própria ainda** (pendência) |
| Movimentação de pasto | RPC `mover_lote_para_pasto` (Sprint 21) | Nunca atualiza `lotes.pastagem_id` fora da função; detecta se o lote já mudou de pasto antes de sincronizar |
| Despesa simples | `createOperationalRecord('movimentacoes_financeiras', ...)` | Mesmo padrão de colunas do financeiro existente |
| Ocorrência/manejo | `createOperationalRecord('sanitario', ...)` | Tabela real, mas encaixe imperfeito (não existe tabela dedicada de ocorrências) — documentado como limitação, não como pendência sem solução |

## 3. Onde aparecem as pendências

Indicador no cabeçalho (Conectado / Sem internet / N registros aguardando
sincronização, clicável) e página **Sincronização** (menu Gestão): 3
contadores (aguardando envio, sincronizados, não foi possível enviar) +
lista completa com a mensagem amigável de cada erro e botão de retry por
item.

## 4. Como a sincronização funciona

Automática ao detectar o evento `online` do navegador ou mudança na fila
(com debounce), e manual via "Tentar sincronizar agora" (todos) ou "Tentar
novamente" (um item). Nunca apaga um item com erro — ele permanece visível
até sincronizar de verdade. Itens com erro são reincluídos na próxima
tentativa (automática até 5 vezes, manual sempre).

## 5. Limitações que ficaram

- Sem tela de pesagem individual por animal.
- `ocorrencia_manejo` reaproveita `sanitario` — não é uma tabela dedicada.
- Proteção contra duplicidade é local (chave de idempotência client-side);
  não há constraint de unicidade no banco — janela rara, mas real, de
  duplicidade em caso de falha exatamente entre a gravação e a confirmação.
- Sem Service Worker/PWA — o que funciona offline é registrar dados depois
  que a tela já carregou, não o carregamento inicial do app.
- Sem suporte a fotos/anexos.

## 6. Resultado do teste manual

Sem credenciais de login neste ambiente (mesma limitação já registrada nas
Sprints 21 e 22) — o roteiro de 10 passos não pôde ser executado ponta a
ponta no navegador. Verificação feita via 30 testes automatizados cobrindo
cada cenário do roteiro (fila, online/offline, os 4 tipos de operação,
duplicidade, sem sessão, RPC com bloqueio de estado obsoleto) + build/dev
server sem erros de console + revisão de código da integração nova.
Detalhes completos e honestos sobre o que não foi possível ver renderizado
em [OFFLINE_TESTE_MANUAL.md](OFFLINE_TESTE_MANUAL.md).

## 7. Quantidade de testes criados

30 novos (24 em `offlineQueue.test.js`, 6 em `offlineCaptureLogic.test.js`).

## 8. Resultado de testes, lint e build

| Gate | Resultado |
|------|-----------|
| `npm test` | ✓ 454 testes, 0 falhas (30 novos) |
| `npm run lint` | ✓ sem erros |
| `npm run build` | ✓ build completo |

---

## Pendências para a Sprint 24

- Formulário de pesagem individual por animal no Modo Campo.
- Tabela dedicada de ocorrências.
- Constraint de unicidade no banco para idempotência completa.
- Verificação visual real (indicador, painel de sincronização, modais) com
  conta autenticada.
- Avaliar Service Worker/PWA se o uso real do piloto mostrar necessidade de
  carregar o app já offline.
