# Registro Rápido — mecanismo compartilhado (Sprint 31)

Este documento descreve o mecanismo de "registrar offline" reutilizado por
duas telas — Modo Curral e Sincronização. Para a visão de produto do Modo
Curral, ver [MODO_CURRAL_HERDON.md](MODO_CURRAL_HERDON.md). Para a
arquitetura da fila em si (não alterada nesta sprint), ver
[OFFLINE_HERDON.md](OFFLINE_HERDON.md).

## Por que extrair um hook

Antes da Sprint 31, a função `registrar(tipoOperacao, payload,
mensagemSucesso)` — que checa permissão, chama `adicionarOperacaoOffline`,
mostra o toast certo (sucesso/duplicado/erro/pendente) — só existia dentro
de `SincronizacaoPage.jsx`. Criar o Modo Curral como uma segunda tela com
as mesmas 4 ações significaria copiar essa função e os 4 `<Modal>` que ela
abre. Em vez disso:

- `src/hooks/useRegistroRapido.js` — toda a lógica de permissão/fila/toast.
- `src/components/curral/RegistroRapidoModais.jsx` — os 4 modais já
  existentes (`Registrar*OfflineModal.jsx`, Sprint 23), num só componente.

Ambas as telas (`ModoCurralPage.jsx`, `SincronizacaoPage.jsx`) usam as duas
peças da mesma forma:

```jsx
const status = useOfflineQueueStatus(session, setDb);
const { modalAberto, abrirModal, fecharModal, registrar } = useRegistroRapido(session, status);

<RegistroRapidoModais
  modalAberto={modalAberto}
  fazendas={fazendas}
  lotes={lotes}
  pastagens={pastagens}
  onClose={fecharModal}
  registrar={registrar}
/>
```

## `useRegistroRapido(session, status)`

Retorna:

| Campo | Tipo | Descrição |
|---|---|---|
| `modalAberto` | `string \| null` | Qual modal está aberto: `'pesagem'`, `'movimentacao'`, `'despesa'`, `'ocorrencia'` ou `null` |
| `abrirModal` | `(id: string) => void` | Abre um modal pelo id |
| `fecharModal` | `() => void` | Fecha o modal atual |
| `registrar` | `(tipoOperacao, payload, mensagemSucesso) => void` | Valida permissão, enfileira, mostra o toast |
| `hasPermission` | `(permissao: string) => boolean` | Repassado de `useAuth`, para desabilitar botões de ação sem permissão |

### Permissão por tipo de operação

| `tipoOperacao` | Permissão exigida |
|---|---|
| `pesagem_lote` / `pesagem_animal` | `pesagens:editar` |
| `movimentacao_pasto` | `lotes:editar` |
| `despesa_simples` | `financeiro:editar` |
| `ocorrencia_manejo` | `sanitario:editar` |

### Mensagem ao registrar

| Situação | Mensagem |
|---|---|
| Online, sucesso | `"<mensagemSucesso> Sincronizando agora."` |
| Offline, sucesso (enfileirado) | `getFriendlyPendingMessage()` → "Ainda não foi possível enviar este registro. Vamos tentar novamente quando a internet voltar." |
| Já existia um pendente igual (mesma chave de idempotência) | "Este registro já estava aguardando sincronização." |
| Sem permissão | "Você não tem permissão para executar esta ação." |
| Falha ao gravar no aparelho (ex.: `localStorage` cheio) | Mensagem específica do erro retornado por `adicionarOperacaoOffline` |

## `RegistroRapidoModais`

Componente puramente de apresentação — recebe `modalAberto`, `fazendas`,
`lotes`, `pastagens`, `onClose`, `registrar`, e renderiza os 4 modais já
existentes, cada um chamando `registrar(tipoOperacao, payload,
mensagemSucesso)` no `onSubmit`. Não tem estado próprio, não valida nada —
toda validação continua dentro de cada modal individual
(`validarPesagemOfflineForm` etc., inalterados desde a Sprint 23).

## O que NÃO mudou

- A fila offline (`src/services/offlineQueue.js`) — formato do item, tipos
  suportados, sincronização automática/manual, proteção de duplicidade.
- Os 4 formulários de captura e suas validações.
- O comportamento da tela Sincronização (mesmas mensagens, mesmos botões,
  mesma lista de registros do aparelho) — só a implementação interna foi
  reorganizada.

## Payloads por tipo (referência rápida)

| Tipo | Campos do payload |
|---|---|
| `pesagem_lote` | `loteId`, `data`, `pesoMedio`, `quantidadeCabecas` (opcional), `observacao` (opcional) |
| `movimentacao_pasto` | `loteId`, `pastagemDestinoId`, `dataMovimentacao`, `quantidadeCabecas` (opcional), `motivo` (opcional), `observacoes` (opcional), `pastagemOrigemEsperada` |
| `despesa_simples` | `fazendaId`, `data`, `descricao`, `valor`, `categoria`, `observacoes` (opcional) |
| `ocorrencia_manejo` | `fazendaId`, `loteId` (opcional), `data`, `tipo`, `descricao`, `observacoes` (opcional) |

Nenhum desses formatos foi alterado nesta sprint — já existiam desde a
Sprint 23 (Modo Campo Offline).
