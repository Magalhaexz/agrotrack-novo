# Modo Curral — HERDON (Sprint 31)

Página de registro rápido para uso no campo/curral: pesagem, movimentação
de pasto, despesa e ocorrência, em poucos cliques, numa única tela.
Mobile-first. Rota/`pageId`: `modoCurral`. Componente:
[`src/pages/ModoCurralPage.jsx`](../src/pages/ModoCurralPage.jsx).

## Por que existe

A dor operacional que motivou a sprint: o produtor/vaqueiro não pode
navegar por 5 telas diferentes para registrar algo simples no curral. As 4
ações já existiam desde o Modo Campo Offline (Sprint 23), mas estavam
escondidas dentro da tela "Sincronização" — que é sobre gerenciar a fila de
sincronização, não sobre acesso rápido a registro. O Modo Curral é a versão
"primeira tela que abre no campo" dessas mesmas ações.

## O que reaproveita (nada foi duplicado)

| Peça | Onde já existia | O que o Modo Curral faz com ela |
|---|---|---|
| Formulários de captura | `src/components/offline/Registrar*OfflineModal.jsx` (Sprint 23) | Reaproveitados sem alteração, via `RegistroRapidoModais` |
| Validação de formulário | `src/domain/offlineCaptureLogic.js`, `src/components/lotes/movimentacaoPastoLogic.js` | Reaproveitada sem alteração |
| Fila offline | `src/services/offlineQueue.js` | Reaproveitada sem alteração — `adicionarOperacaoOffline` continua sendo a única porta de entrada |
| Permissão + toast ao registrar | Antes só em `SincronizacaoPage.jsx` | Extraído para `src/hooks/useRegistroRapido.js`, usado pelas duas telas |
| Status online/pendências | `src/hooks/useOfflineQueueStatus.js` | Reaproveitado sem alteração |

Nenhuma tabela nova. Nenhum cálculo de GMD duplicado — pesagem só salva o
registro, o domínio (`src/domain/indicadores.js`) calcula GMD depois, como
já fazia.

## O que é genuinamente novo

- [`src/pages/ModoCurralPage.jsx`](../src/pages/ModoCurralPage.jsx) — a página.
- [`src/hooks/useRegistroRapido.js`](../src/hooks/useRegistroRapido.js) — hook compartilhado (permissão, fila, toast).
- [`src/components/curral/RegistroRapidoModais.jsx`](../src/components/curral/RegistroRapidoModais.jsx) — agrupa os 4 modais existentes.
- [`src/domain/modoCurral.js`](../src/domain/modoCurral.js) — lógica pura de estado vazio (`construirResumoModoCurral`, `obterMensagemEstadoVazio`), com testes em `modoCurral.test.js`.
- Item `Modo Curral` no menu, seção Operação (primeiro item, `Warehouse` icon).
- CSS dedicado `.modo-curral-grid`/`.modo-curral-card` em `src/styles/dashboard.css` (mobile-first: 2 colunas → 1 coluna abaixo de 480px).
- `SincronizacaoPage.jsx` foi refatorada para usar os mesmos `useRegistroRapido`/`RegistroRapidoModais` — comportamento idêntico ao de antes, só sem duplicar o código.

## Ações disponíveis

| Ação | Permissão | Abre |
|---|---|---|
| Registrar pesagem | `pesagens:editar` | `RegistrarPesagemOfflineModal` |
| Mover lote de pasto | `lotes:editar` | `RegistrarMovimentacaoPastoOfflineModal` |
| Lançar despesa | `financeiro:editar` | `RegistrarDespesaOfflineModal` |
| Registrar ocorrência | `sanitario:editar` | `RegistrarOcorrenciaOfflineModal` |
| Ver pendências | — | navega para a página Sincronização |

### Sanidade/suplemento — por que não tem atalho dedicado

A ocorrência já cobre "Sanidade" como um dos tipos (`TIPOS_OCORRENCIA`).
Um atalho dedicado para manejo sanitário estruturado (vacina/vermífugo com
próxima dose) ou consumo de suplemento exigiria mapear e validar os campos
de `sanitario`/`suplementacao` num formulário novo — mais que "reaproveitar
fluxo existente". Por orientação explícita da sprint ("só incluir se não
exigir criar módulo grande novo"), ficou de fora. Pendência para Sprint 32.

## Como funciona online

`adicionarOperacaoOffline` sempre enfileira o registro localmente
(`localStorage`, chave `herdon-campo-offline-queue`) — online ou offline,
não há dois caminhos de código diferentes. A diferença é o que acontece
depois: com internet, `useOfflineAutoSync` (montado uma vez em `App.jsx`)
dispara a sincronização quase imediatamente, então o usuário vê
"`<Ação> registrada.` Sincronizando agora." e o item normalmente já some da
fila de pendências em poucos segundos.

## Como funciona offline

O mesmo `adicionarOperacaoOffline` enfileira o registro. Sem internet, a
sincronização automática não dispara — o usuário vê "Ainda não foi possível
enviar este registro. Vamos tentar novamente quando a internet voltar." O
registro fica visível em "Ver pendências" (página Sincronização) até ser
enviado, manual ou automaticamente, quando a conexão voltar.

## Sincronização na própria tela

O bloco superior do Modo Curral mostra `ConnectionIndicator` (estado
online/offline + contagem de pendentes), um botão "Ver pendências" (navega
para Sincronização) e "Tentar sincronizar agora" (mesma função usada na
Sincronização, `status.sincronizarAgora()`). Se há itens com erro, aparece
o aviso "Alguns registros ainda não foram enviados. Toque em "Ver
pendências" para revisar."

## Estados vazios

| Situação | Mensagem |
|---|---|
| Sem fazenda, online | "Cadastre sua fazenda antes de usar o Modo Curral." |
| Sem fazenda, offline (dados nunca carregados) | "Você está sem internet. Abra o HERDON online pelo menos uma vez para carregar seus dados antes de registrar no campo." |
| Tem fazenda, sem lote ativo | "Cadastre um lote para registrar pesagens e movimentações." |
| Tem fazenda e lote, sem pasto | Aviso complementar (não bloqueia): "Cadastre pastos para movimentar lotes no campo." |

Lógica em `src/domain/modoCurral.js` (`obterMensagemEstadoVazio`).

## Limitações conhecidas

- Não há atalho dedicado para sanidade/suplementação (ver acima).
- Verificação visual/funcional com conta autenticada não foi possível
  nesta sprint — ver
  [MODO_CURRAL_TESTE_MANUAL.md](MODO_CURRAL_TESTE_MANUAL.md).
- Não está em nenhuma lista de módulos por plano (`src/services/subscriptions.js`)
  — mesmo tratamento de `sincronizacao`, decisão de plano fora de escopo.

## Pendências futuras (não nesta sprint)

- Leitura por brinco/RFID.
- Pesagem individual em massa (lote completo, um por um, em sequência).
- Apartação com múltiplos lotes de origem/destino.
- Venda rápida.
- Fotos/evidências anexadas ao registro.
- Modo PWA real (instalável, cache de assets).
- Comandos por voz.
- Integração com balança (entrada automática de peso).
- Atalho dedicado para manejo sanitário estruturado e consumo de suplemento.
