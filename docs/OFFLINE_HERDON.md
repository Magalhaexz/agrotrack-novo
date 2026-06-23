# Offline — Arquitetura HERDON

Sprint 23. Documento técnico de arquitetura. Para a visão de produto/uso,
ver [MODO_CAMPO_OFFLINE_HERDON.md](MODO_CAMPO_OFFLINE_HERDON.md). Para o
novo ponto de entrada rápido que reaproveita esta fila, ver
[MODO_CURRAL_HERDON.md](MODO_CURRAL_HERDON.md) e
[REGISTRO_RAPIDO_HERDON.md](REGISTRO_RAPIDO_HERDON.md) (Sprint 31).

> **Atualização (Sprint 31):** nenhuma mudança na fila em si
> (`src/services/offlineQueue.js`, formato do item, tipos suportados,
> sincronização automática/manual — tudo abaixo continua válido sem
> alteração). O que mudou foi só a porta de entrada: a lógica de
> "registrar offline" (permissão + `adicionarOperacaoOffline` + toast) que
> antes só existia dentro de `SincronizacaoPage.jsx` foi extraída para
> `src/hooks/useRegistroRapido.js`, e os 4 modais de captura foram agrupados
> em `src/components/curral/RegistroRapidoModais.jsx` — para serem
> reaproveitados tanto pela Sincronização quanto pela nova página Modo
> Curral, sem duplicar formulário, validação ou regra de negócio.

## Auditoria do que já existia (Etapa 1)

Antes desta sprint, `src/services/operationalPersistence.js` já tinha um
motor de fila de recuperação (`enqueuePendingSync` / `readPendingSyncQueue` /
`processPendingSyncQueue` / `getPendingSyncQueueSnapshot`), guardado em
`localStorage` sob a chave `herdon-pending-sync-queue`, com fingerprint
anti-duplicidade, retry com backoff e auto-retry conectado em `App.jsx` aos
eventos `online`, `herdon-pending-sync-updated` e
`herdon-cloud-diagnostic-state`.

**Por que esse mecanismo não resolvia o Modo Campo:**

1. **Só liga de verdade em DEV/teste ou sem sessão.** `canUseLocalRecoveryForWrite`
   retorna `true` automaticamente quando `IS_DEV` ou `IS_TEST`, ou quando não
   há sessão — mas em **produção, com usuário logado** (o caso real do
   piloto em campo), retorna `false` por padrão. Nenhuma tela do app passa
   `allowLocalRecovery: true`. Ou seja: hoje, se a internet cair durante uma
   gravação real, o dado **não é enfileirado automaticamente** — a tela só
   recebe um erro genérico.
2. **Não sabe chamar RPC.** `processPendingSyncQueue` só sabe fazer
   `create`/`update`/`delete` direto numa tabela via PostgREST
   (`supabase.from(table)...`). Movimentação de pasto depende da função
   `mover_lote_para_pasto` (Sprint 21) — uma RPC, não uma tabela.
3. **Ciclo de vida diferente do pedido.** A fila legada **remove** o item da
   fila quando sincroniza com sucesso — sem `sincronizado_em`, sem contagem
   histórica de "sincronizados" para mostrar ao usuário.

**Decisão:** criar uma fila própria do Modo Campo
(`src/services/offlineQueue.js`), com o formato de item pedido nesta sprint,
delegando a gravação real para as funções já existentes
(`createOperationalRecord`, `moverLoteParaPasto`) — sem duplicar a lógica de
persistência, sem usar `SUPABASE_SERVICE_ROLE_KEY`, sem burlar RLS. A fila
legada continua existindo e funcionando exatamente como antes — não foi
alterada.

## Fila do Modo Campo

Armazenamento: `localStorage`, chave `herdon-campo-offline-queue`. Evento de
mudança: `herdon-campo-offline-queue-updated` (igual ao padrão da fila
legada, para qualquer parte da UI reagir sem polling).

### Formato do item

| Campo | Tipo | Descrição |
|---|---|---|
| `id_local` | string | Identificador gerado no aparelho (`campo-<timestamp>-<random>`) |
| `tipo_operacao` | string | Um de `pesagem_lote`, `pesagem_animal`, `movimentacao_pasto`, `despesa_simples`, `ocorrencia_manejo` |
| `payload` | object | Dados do formulário, específicos de cada tipo |
| `status` | string | `pendente` \| `sincronizado` \| `erro` — mutuamente exclusivos |
| `tentativas` | number | Quantas vezes a sincronização foi tentada e falhou |
| `erro` | string \| null | Mensagem amigável do último erro, se houver |
| `criado_em` | string (ISO) | Quando o registro foi salvo no aparelho |
| `sincronizado_em` | string (ISO) \| null | Quando foi confirmado na nuvem |
| `owner_user_id` | string | **Adicionado além da lista pedida** — isola a fila por conta, no mesmo padrão da fila legada. Sem isso, um aparelho compartilhado por duas contas misturaria registros. |
| `chave_idempotencia` | string | Ver "Proteção contra duplicidade" abaixo |

### Por que três status mutuamente exclusivos

`pendente` → aguardando primeira tentativa. `erro` → já tentou e falhou,
continua na fila (nunca é apagado automaticamente). `sincronizado` → confirmado
na nuvem. Os contadores "pendentes", "sincronizados" e "com erro" do painel
são essas três contagens — não há sobreposição entre eles.

### Como cada tipo sincroniza

| Tipo | Como sincroniza |
|---|---|
| `pesagem_lote` / `pesagem_animal` | `createOperationalRecord('pesagens', ...)` — mesma função já usada pelas telas online. `tipo: 'lote'` ou `'animal'`, `animal_id` só quando individual. |
| `despesa_simples` | `createOperationalRecord('movimentacoes_financeiras', ...)` com `tipo: 'despesa'`, respeitando as mesmas colunas que `FinanceiroPage.jsx` já usa. |
| `movimentacao_pasto` | RPC `mover_lote_para_pasto` (Sprint 21), via `moverLoteParaPasto()` de `src/services/movimentacaoPastos.js`. **Nunca** atualiza `lotes.pastagem_id` diretamente — só a função é quem faz isso. |
| `ocorrencia_manejo` | `createOperationalRecord('sanitario', ...)`. Ver limitação abaixo. |

Nenhuma gravação usa `SUPABASE_SERVICE_ROLE_KEY`. Todas usam a sessão normal
do usuário (`session` recebida via prop, a mesma sessão Supabase do
restante do app) — RLS continua valendo exatamente como em qualquer outra
tela.

### `ocorrencia_manejo` — limitação conhecida e documentada

Não existe uma tabela `ocorrencias` genérica no banco. A tabela mais próxima
é `sanitario` (usada hoje para manejo sanitário programado: vacina,
vermífugo, próxima dose). Ela tem colunas de texto livre (`tipo`, `desc`,
`obs`) flexíveis o suficiente para registrar manejo/sanidade/observação, mas
**não é um encaixe perfeito** — em especial para o tipo "mortalidade", que
semanticamente não é um "manejo sanitário programado". Decisão tomada: usar
`sanitario` mesmo assim (é uma tabela real, com RLS, não é uma promessa
vazia), documentando aqui a imperfeição. Uma tabela `ocorrencias` dedicada é
uma melhoria natural para uma sprint futura.

### Movimentação de pasto: detectando mudança de estado entre o registro e a sincronização

A função `mover_lote_para_pasto` não recebe "de onde" o lote deveria estar
vindo — ela lê o `pastagem_id` atual do lote no momento da chamada (decisão
da Sprint 21). Isso significa que, se eu enfileirar offline "mover o lote do
Pasto 1 para o Pasto 3" e, antes de sincronizar, alguém mover esse mesmo lote
para o Pasto 5 por outro caminho, a sincronização não deve simplesmente mover
de qualquer lugar para o Pasto 3 sem avisar.

Por isso, ao enfileirar, o Modo Campo guarda também `pastagemOrigemEsperada`
(o `pastagem_id` do lote no momento em que o usuário registrou a
movimentação). Na hora de sincronizar, antes de chamar a RPC, o serviço
confere o `pastagem_id` **atual** do lote:

- Se bate com o esperado → chama a RPC normalmente.
- Se não bate → **não chama a RPC**, marca o item como `erro` com a mensagem
  "Este lote já foi movido para outro pasto antes da sincronização. Confira
  o pasto atual e repita a movimentação se necessário." — e mantém a
  pendência visível, sem apagar.

## Proteção contra duplicidade (Etapa 10)

**Local (implementada):** `construirChaveIdempotencia(tipoOperacao, payload)`
gera uma chave determinística por tipo (ex.: `pesagem_lote:<loteId>:<data>:<peso>`).
Ao adicionar um novo registro, se já existir um item **pendente ou com
erro** (não sincronizado) com a mesma chave para o mesmo usuário, o novo
registro não é duplicado — o item existente é retornado. Isso cobre clique
duplo e reenvio do mesmo formulário.

**O que isso NÃO resolve:** não é uma garantia de idempotência no banco. Se
a gravação real (`createOperationalRecord`/RPC) tiver sucesso mas o
aparelho perder o resultado antes de marcar o item como `sincronizado`
(ex.: o app fechar exatamente nesse instante), um retry futuro chamaria a
gravação de novo, podendo criar um registro duplicado no banco — as tabelas
`pesagens`/`movimentacoes_financeiras`/`sanitario` não têm uma constraint de
unicidade por chave de idempotência. Mitigação aplicada: a chave de
idempotência é gravada em `metadata.idempotency_key` do registro enviado,
então um duplicado real fica **rastreável** depois (consulta manual), mesmo
que não seja **impedido** pelo banco. Adicionar essa constraint é uma
melhoria de banco para sprint futura — não foi feita aqui para não alterar
schema de tabelas existentes fora do escopo desta sprint.

## Sincronização automática e manual

- **Automática:** `useOfflineAutoSync(session, setDb)`, montado uma única
  vez em `App.jsx`. Ouve o evento `online` do navegador e o evento de fila
  atualizada, com debounce (mesmo padrão da fila legada), e tenta sincronizar
  tudo que estiver pendente/com erro. Itens com 5 ou mais tentativas não são
  retentados automaticamente (evita bater na rede sem parar para um item
  permanentemente inválido) — mas continuam disponíveis para retry manual.
- **Manual:** botão "Tentar sincronizar agora" (todos os itens) e "Tentar
  novamente" por item individual, na página Sincronização. Manual sempre
  tenta, mesmo com 5+ tentativas.
- Quando sincroniza com sucesso, o registro é também mesclado no `db` em
  memória (`aplicarItemSincronizadoNoDb`), então o resto do app (ex.:
  "Hoje na Fazenda") reflete sem precisar recarregar a página.

## Segurança

- Nenhuma chamada usa `SUPABASE_SERVICE_ROLE_KEY` — confirmado por busca em
  todo `src/services/offlineQueue.js` e nos componentes novos.
- Toda gravação passa pela sessão normal do usuário e pelas mesmas policies
  de RLS já validadas nas Sprints 18–21.
- A fila em si vive só no aparelho (`localStorage`) — nunca é enviada para
  nenhum servidor como está; só os dados de cada operação, no momento da
  sincronização, pelo caminho normal.

## Limites do MVP

- Funciona só nas 4 operações desta sprint — não é um modo offline do app
  inteiro (não foi essa a meta).
- Sem Service Worker / PWA — o app em si precisa ter sido carregado online
  pelo menos uma vez; o que funciona offline é o **registro de dados**
  depois que a tela já está aberta, não o carregamento inicial do app.
- Sem IndexedDB — `localStorage` foi suficiente para o volume e formato de
  dados desta sprint (textos/números simples, sem arquivos/fotos).
- Duplicidade no banco não é estruturalmente impossível, só improvável e
  rastreável (ver seção acima).
