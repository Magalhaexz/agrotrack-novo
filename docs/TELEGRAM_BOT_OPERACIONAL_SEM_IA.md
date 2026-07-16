# Bot Operacional HERDON no Telegram (sem IA)

Sprint de remoção da Claude API e consolidação do interpretador
determinístico. Base: commit `1dca7c0` (sprint anterior, que integrou a
Claude API). Esta sprint **reverte integralmente** essa integração e
substitui a camada de linguagem natural por um interpretador 100%
determinístico — sem perder nenhuma das 18 ferramentas construídas.

**Custo de IA: zero.** Não há chamada de rede a nenhum provedor externo em
nenhum ponto do bot.

## 1. O que foi removido

| Item | Arquivo | Uso anterior | Decisão |
| --- | --- | --- | --- |
| SDK Anthropic | `@anthropic-ai/sdk` (`package.json`) | Cliente HTTP para a Claude API | **removido** (`npm uninstall`, lockfile atualizado) |
| Cliente Anthropic | `api/_anthropicClient.js` (+ teste) | Único ponto de chamada à Claude API | **removido** |
| Orquestrador da IA | `api/_telegramIA.js` | Camada entre o bot determinístico e o fallback, chamava a Claude API | **removido** |
| Interpretador LLM | `src/domain/telegram/interpretarMensagemIA.js` (+ teste) | Construía o *system prompt*, as *tools* da Claude e validava o `tool_use` devolvido | **substituído** por `interpretadorTelegram.js` (determinístico) |
| Contexto de mensagens livres | `src/domain/telegram/contextoIA.js` (+ teste), tabela `telegram_ia_contexto` | Histórico de mensagens para enviar à Claude API | **removido** — `telegram_conversas` (pré-existente) já cobre o preenchimento progressivo de campos que o bot determinístico precisa |
| Variáveis de ambiente | `ANTHROPIC_API_KEY`, `TELEGRAM_IA_MODEL`, `TELEGRAM_IA_MAX_TOKENS`, `TELEGRAM_IA_EFFORT` (`.env.example`) | Configuração da chamada à Claude API | **removidas** |
| Testes de segurança da IA | `src/domain/telegram/telegramIASeguranca.test.js` | Simulava respostas de um `chamarClaude` fake | **reescrito** como `telegramSeguranca.test.js` (equivalentes deterministicos, sem "modelo" nenhum para enganar) |
| Testes de integração IA↔confirmar | `api/_telegramBotIA.test.js` | Testava `tipo_operacao='ia_tool'` | **renomeado** para `api/_telegramBotFerramentas.test.js`, adaptado |
| Branch de execução no orquestrador | `executarFerramentaIA`, `tipo_operacao='ia_tool'` (`api/_telegramBot.js`) | Executa uma ferramenta do catálogo já confirmada | **preservado e renomeado** — `executarFerramentaCatalogo`/`'ferramenta_bot'`. Não é código específico da Anthropic: é o executor genérico do catálogo, que agora recebe ordens do interpretador determinístico em vez da Claude |
| Catálogo de ferramentas | `src/domain/telegram/telegramToolsRegistry.js` | 18 ferramentas com metadados + `execute` + `formatResult` | **preservado integralmente** |
| 4 ferramentas novas | `cadastroTarefa.js`, `cadastroItemEstoque.js`, `acoesEstoque.js`, `acoesPasto.js` (+ testes) | Lógica pura de domínio — nunca dependeram de IA | **preservadas integralmente** |
| Confirmação/idempotência | `telegram_operacoes_pendentes`, `operacoesPendentes.js` | Já existia antes da Claude API | **preservado, intocado** |

Nenhum arquivo foi removido "só pelo nome" — cada um foi lido e seus
consumidores confirmados antes da remoção (`grep -R` em todo o repositório,
`npm ls`).

### Migration `telegram_ia_contexto`

A tabela foi criada e **já estava aplicada no Supabase remoto** quando esta
sprint começou. Por isso a migration original
(`20260715142221_telegram_ia_contexto.sql`) **não foi editada nem apagada**
— continua no repositório como registro histórico. Uma **migration nova**
(`20260715210216_drop_telegram_ia_contexto.sql`) foi aplicada por cima,
dropando a tabela. Ela não foi renomeada/reaproveitada porque não oferecia
nada que `telegram_conversas` (pré-existente, nome já neutro) não já
cobrisse: intenção pendente, campos coletados e expiração — exatamente os
critérios que justificariam reaproveitar em vez de dropar.

## 2. Arquitetura

```
Telegram
  → webhook (api/telegram-webhook.js)
  → bot operacional (api/_telegramBot.js)
      → interpretador determinístico (src/domain/telegram/interpretadorTelegram.js)
          → normalização + sinônimos (sinonimosTelegram.js)
          → tolerância a erro de digitação (toleranciaTelegram.js)
          → classificação por regex (interpretarComandoTelegram.js — intocado)
          → pontuação de confiança
      → [intenção não reconhecida] fallback legado (Sprint 8) — sem IA, como sempre foi
      → catálogo de ferramentas (telegramToolsRegistry.js) OU
        cadastro por conversa (cadastros.js + conversas.js)
      → confirmação (telegram_operacoes_pendentes — pré-existente)
      → domínio → Supabase (aplicarWrites — pré-existente)
```

Nenhuma etapa envolve rede externa. Tudo roda no processo da função
serverless, com o mesmo orçamento de tempo/CPU de qualquer outra rota da
Vercel.

## 3. Interpretador determinístico central

`src/domain/telegram/interpretadorTelegram.js`. Três tentativas, na ordem —
a primeira que classificar decide:

1. **Texto original**, sem qualquer alteração — confiança **0.95**.
2. **Sinônimos canonicalizados** (`sinonimosTelegram.js`) — frases fora da
   alternância literal da regex (ex.: "tirei" → `estoque_saida`) —
   confiança **0.80**.
3. **Tolerância a erro de digitação** (`toleranciaTelegram.js`,
   Levenshtein) sobre o texto **original** (nunca sobre o já normalizado por
   sinônimos) — confiança **0.65**, com a lista de correções exposta.

Se nada classificar: confiança **0**, intenção `DESCONHECIDO` — nunca finge
compreensão.

```js
interpretarMensagemTelegram(texto)
// → { intencao, parametros, requerConfirmacao, confidence, textoInterpretado, correcoes }
```

### Faixas de confiança

| Faixa | Comportamento |
| --- | --- |
| `>= 0.85` | Executa/prepara a confirmação normalmente |
| `0.60 – 0.84` | Prossegue, mas avisa a correção feita antes da resposta (ver abaixo) |
| `< 0.60` (= 0) | `DESCONHECIDO` — cai no fallback determinístico do Sprint 8; se este também não reconhecer, o produtor recebe sugestões de reformulação |

**Como o aviso de correção funciona de verdade** (`api/_telegramBot.js`,
`processarComandoBot`): a função classifica a mensagem **uma vez** com o
interpretador central. Quando a confiança ficou em 0.65 (correção de
digitação), a resposta final vem prefixada com uma nota transparente:

```
(Entendi "pesajen" como "pesagem" — se não era isso, envie /cancelar e reformule.)

Confirme a pesagem:
...
```

Para o degrau 0.80 (sinônimo reconhecido, nenhuma palavra foi *alterada*,
só uma frase alternativa foi mapeada para a canônica) não há nota — e para
qualquer intenção de **escrita**, a etapa de confirmação já existente
(`/confirmar`) reexibe a ação interpretada antes de gravar, o que por si só
cumpre o papel de "confirmar a intenção" pedido pela seção 11 do spec sem
precisar de um mecanismo novo de confirmação de intenção separado.

## 4. Sinônimos

`src/domain/telegram/sinonimosTelegram.js`. Dicionário extensível de grupos
`canônico: [frases]` (`cadastrar`, `consultar`, `estoque_saida`,
`estoque_entrada`, `trocar_pasto`, `morte`, `tarefa`, `pesagem`,
`suplemento`). `normalizarComSinonimos(texto)` produz um texto **só para
classificação** — nunca para extrair entidade (valor/quantidade/data
continuam vindo sempre do texto original via `extrairEntidades.js`).

Alguns dos canônicos deste dicionário (`tarefa`, `estoque_saida`,
`trocar_pasto`) também foram adicionados como alternativas literais dentro
da própria regex de `interpretarComandoTelegram.js` — isso permite que uma
frase reconhecida só por sinônimo ainda seja classificada corretamente
mesmo depois da canonicalização.

## 5. Tolerância a erro de digitação

`src/domain/telegram/toleranciaTelegram.js`. Distância de Levenshtein
contra um dicionário de palavras conhecidas (vocabulário-base de domínio +
os sinônimos). Regras aplicadas rigorosamente:

- **Nunca corrige** números, valores com dígito misturado, ou palavras com
  2 caracteres ou menos.
- **Nunca corrige uma palavra que comece com maiúscula no meio da frase**
  — é o sinal de nome próprio (lote/fazenda/produto). Esta proteção foi
  adicionada depois de um teste pego em revisão: "registrar pesajen de 425
  kg no lote **Recria**" quase teve "Recria" trocado por "receita" (distância
  de edição pequena o bastante para bater no limiar) antes da proteção — ver
  `interpretadorTelegram.test.js`, teste de regressão explícito.
- Limiar de distância cresce com o tamanho da palavra (1 para ≤4
  caracteres, 2 para 5–8, 3 para mais longas) — nunca "adivinha" uma
  correção improvável.
- Sem candidata suficientemente próxima → não corrige (deixa
  `DESCONHECIDO` decidir, nunca escolhe a "menos errada").

Exemplo obrigatório do spec, verificado em teste real:
`"Pesajen do lote Recria"` → corrige `"pesajen"` → `"pesagem"`, preserva
`"Recria"` integralmente.

## 6. As 18 ferramentas preservadas

`src/domain/telegram/telegramToolsRegistry.js` — nenhuma foi perdida na
remoção da Anthropic, nenhuma depende de Claude, nenhuma ferramenta fora
deste catálogo pode ser chamada (campos extras são descartados por
construção — os `writes` de cada ferramenta são montados campo a campo,
nunca por `{...dados}`).

| Ferramenta | Categoria | Risco | Permissão | Confirmação | Teste |
| --- | --- | --- | --- | --- | --- |
| `consultar_fazendas` | consulta | leitura | `fazendas:ver` | não | `telegramToolsRegistry.test.js` |
| `consultar_lotes` | consulta | leitura | `lotes:ver` | não | idem |
| `consultar_lote` | consulta | leitura | `lotes:ver` | não | idem |
| `consultar_estoque` | consulta | leitura | `estoque:ver` | não | idem |
| `consultar_financeiro` | consulta | leitura | `financeiro:ver` | não | idem |
| `consultar_manejos` | consulta | leitura | `sanitario:ver` | não | idem |
| `consultar_pesagens` | consulta | leitura | `pesagens:ver` | não | idem |
| `consultar_resumo` | consulta | leitura | `dashboard:ver` | não | idem |
| `transferir_animais_entre_lotes` | movimentação | crítica | `animais:movimentar` | sim | `_telegramBot.test.js` |
| `renomear_lote` | edição | crítica | `lotes:editar` | sim | idem |
| `registrar_pesagem` | cadastro | escrita simples | `pesagens:editar` | sim | `cadastros.test.js` |
| `cadastrar_despesa` | cadastro | escrita simples | `financeiro:editar` | sim | idem |
| `cadastrar_receita` | cadastro | escrita simples | `financeiro:editar` | sim | idem |
| `registrar_entrada_estoque` | cadastro | escrita simples | `estoque:movimentar` | sim | idem |
| `cadastrar_tarefa` **(novo)** | cadastro | escrita simples | `tarefas:editar` | sim | `cadastros.test.js` + `_telegramBot.test.js` |
| `cadastrar_item_estoque` **(novo)** | cadastro | escrita simples | `estoque:editar` | sim | idem |
| `dar_baixa_estoque` **(novo)** | movimentação | crítica | `estoque:movimentar` | sim | idem |
| `trocar_lote_pasto` **(novo)** | movimentação | crítica | `lotes:editar` | sim | idem |

## 7. As 4 intenções novas — detalhe de cada uma

Todas resolvidas via **conversa em etapas** (`cadastros.js` +
`conversas.js`, pré-existente) — a mensagem inicial extrai o que der, o
slot que faltar vira pergunta; nada é gravado sem passar por
`/confirmar`.

### `cadastrar_tarefa`
Campos: `titulo` (obrigatório), `data_vencimento` (obrigatório), `lote`
(opcional, sempre perguntado), `responsavel` (opcional, resolvido por nome
em `funcionarios`), `categoria`/`prioridade` (opcionais, com enum
default). Escreve em `tarefas`, com `fazenda_id` vindo do contexto da
conexão. Gatilhos: `cadastrar/criar/anotar tarefa`, `agendar`, `me lembra
de`, `lembra de`, `tarefa` (isolado).

### `cadastrar_item_estoque`
Campos: `nome` (obrigatório), `quantidade_inicial`/`categoria`/`unidade`/
`custo_unitario` (opcionais, com defaults seguros — `0`, `'Outro'`, `'un'`).
Distinto de `registrar_entrada_estoque` (que só soma quantidade a um item
**já existente**) — exige a palavra "item"/"produto" explícita para não
confundir as duas leituras possíveis de "cadastre 20 sacos de sal".
Escreve em `estoque`, duplicando as colunas espelhadas
(`produto`/`nome`, `unidade`/`unidade_medida`, `valor_unitario`/
`custo_unitario`/`preco_unitario`) do mesmo jeito que o app já faz.

### `dar_baixa_estoque`
Campos: `item` (obrigatório, resolvido por nome — ambíguo pede
desambiguação numerada), `quantidade` (obrigatório). Valida saldo
suficiente **antes** de gravar (`SALDO_INSUFICIENTE` se não houver);
nunca deixa `quantidade_atual` negativo. Consumo vinculado a lote gera
despesa rastreável (`movimentacoes_financeiras`); venda gera receita —
mesma regra de `registrarSaidaEstoque` do app espelhada (ver nota
`ponytail:` em `acoesEstoque.js` sobre por que é espelhada e não
importada).

### `trocar_lote_pasto`
Campos: `lote` (obrigatório), `pasto` (obrigatório). Valida: lote
encontrado e **ativo** (`LOTE_BLOQUEADO` para encerrado/vendido), pasto na
**mesma fazenda** do lote (`PASTO_OUTRA_FAZENDA`), e — se o pasto de
destino for igual ao atual — exige um motivo explícito
(`MESMO_PASTO_SEM_MOTIVO`). Nunca altera `lotes.qtd`. Grava em
`lote_pastagens_historico` (origem + destino) e atualiza
`lotes.pastagem_id`. A RPC real do app (`mover_lote_para_pasto`) não é
chamada diretamente — ver nota `ponytail:` em `acoesPasto.js`: ela é
`SECURITY INVOKER` e depende de RLS, que o cliente de service role do
webhook ignora; a validação foi espelhada sobre o `db` já recortado por
conta, a mesma garantia que toda outra escrita do bot já usa.

## 8. Resolução de entidades

Reaproveita os resolvedores pré-existentes
(`resolverLotePorNome`/`normalizarChave` em `resolvedores.js`) mais dois
novos, no mesmo padrão: um resolvedor de pastagem por nome
(`acoesPasto.js`) e um resolvedor de funcionário por nome
(`cadastroTarefa.js`). Todos seguem a mesma regra: nome exato primeiro,
depois nome parcial (`includes`), acento-insensível
(`normalizarChave`/`normalizarChaveComparacao`); duas correspondências →
lista numerada de candidatos, **nunca escolhe automaticamente**.

## 9. Permissões

Mesma matriz do app inteiro (`src/auth/perfis.js`), sem segunda fonte de
verdade — `podeExecutarComandoTelegram`/`perfilTemPermissao` continuam
sendo os únicos pontos de decisão. As 4 intenções novas foram mapeadas em
`permissoesTelegram.js`:

```
CADASTRAR_TAREFA       → tarefas:editar
CADASTRAR_ITEM_ESTOQUE → estoque:editar
DAR_BAIXA_ESTOQUE      → estoque:movimentar
TROCAR_LOTE_PASTO      → lotes:editar
```

Validada **duas vezes**: uma ao interpretar a mensagem (antes de sequer
começar a coletar dados), outra em `executarFerramentaCatalogo`/
`executarCadastro` no momento da confirmação — cobre o caso de o perfil
mudar entre a proposta e o `/confirmar` (testado explicitamente em
`_telegramBotFerramentas.test.js`, revalidação de permissão na execução).

## 10. Multi-fazenda

Reaproveita `telegram_connections.fazenda_id` e `filtrarDbPorFazenda`,
pré-existentes e intocados. As 4 intenções novas foram adicionadas ao
conjunto `INTENCOES_ESCOPADAS` de `_telegramBot.js` — se a conta tem mais
de uma fazenda e nenhuma está selecionada, o bot pede a seleção **antes**
de sequer começar a coletar campos.

## 11. Testes

**107 testes novos** desta sprint (1197 → 1304 no total do projeto),
organizados por arquivo:

| Arquivo | Cobre |
| --- | --- |
| `sinonimosTelegram.test.js` (9) | Dicionário, substituição de frase contígua, não corrompe palavra por dentro |
| `toleranciaTelegram.test.js` (9) | Levenshtein, os 4 exemplos do spec, nunca corrige valor/data/palavra curta |
| `interpretarComandoTelegram.test.js` (+9, total 29) | As 4 intenções novas por regex, sem colisão com as existentes |
| `cadastros.test.js` (+9, total 19) | As 4 intenções novas via `prepararCadastro`, fazenda_id do contexto |
| `interpretadorTelegram.test.js` (11) | Confiança por faixa, correção real, **regressão de nome próprio não corrompido** |
| `telegramSeguranca.test.js` (7) | Injeção de texto, isolamento cross-conta, campos extras descartados, sem atalho de confirmação |
| `_telegramBot.test.js` (+9, total 22) | Fluxo real fim a fim das 4 intenções novas, nota de confiança visível na resposta |
| `_telegramBotFerramentas.test.js` (5) | Integração com `/confirmar` já existente, idempotência, revalidação de permissão |
| `catalogoIntencoes.js` (atualizado) | As 4 intenções novas catalogadas — sem drift |

Todos os testes pré-existentes continuam passando **sem alteração de
comportamento** (a única mudança de comportamento observável em código
antigo foi a correção do bug real de `extrairNomeApos`, abaixo).

### Bug real encontrado e corrigido durante a revisão

`extrairNomeApos` (`extrairEntidades.js`) tinha um defeito pré-existente:
quando a palavra logo após "lote"/"fazenda" era ela mesma uma palavra de
parada (ex.: "...o lote amanha"), a função capturava a palavra de parada
inteira como se fosse o nome da entidade. Corrigido com uma negativa
antecipada (`(?!(?:stop)\b)`) — nenhum teste pré-existente dependia do
comportamento antigo. Achado ao testar `cadastrar_tarefa` de ponta a
ponta, não fabricado.

## 12. Fallback sem IA

Já existia por construção antes desta sprint inteira: o legado do Sprint
8 (`/relatorio`, `/prioridades`, `/pagamentos`, `/estoque`, `/tarefas`,
`/lotes`, perguntas por palavra-chave) nunca dependeu de IA. Quando o
interpretador determinístico não reconhece nada (confiança 0), o webhook
cai automaticamente para esse fallback — comportamento inalterado.

## 13. Limitações conhecidas

- **7 operações do spec original não foram implementadas nesta sprint**
  (decisão explícita de escopo): `cadastrar_lote`, `cadastrar_pasto`,
  `registrar_venda`, `registrar_morte`, `finalizar_lote`, manejo
  sanitário (`cadastrar_manejo`), planejamento/consumo de suplementação.
  Nenhuma delas existia antes desta sprint nem na versão com Claude API —
  ficam para uma sprint futura, com a mesma pesquisa de campos exatos já
  aplicada às 4 novas desta rodada.
- A faixa de confiança 0.80 (sinônimo reconhecido) não gera nenhuma nota
  de transparência ao usuário — só a 0.65 (correção de digitação) gera.
  Decisão deliberada (ver seção 3) para não adicionar fricção a um
  reconhecimento já confiável.
- Não há teste de carga/concorrência (fila para operações concorrentes).
- Validação real no aplicativo do Telegram: ver seção 14.

## 14. Validação real no Telegram

Sem dependência de API externa, a validação real não está mais bloqueada
por falta de chave — mas **implantar em produção** (Vercel) e **trocar
mensagens reais** com o bot no aplicativo do Telegram são ações que
alteram estado compartilhado fora deste ambiente de desenvolvimento.
Registrado aqui como pendência explícita para a próxima etapa: repetir os
cenários de "quanto gado eu tenho", "dê baixa em 20 kg de sal", "mova o
lote Recria para o Pasto Norte", digitação com erro, ambiguidade,
cancelamento, confirmação repetida, visualizador, duas fazendas, saldo
insuficiente e entidade inexistente através do aplicativo real — todos já
cobertos por teste automatizado equivalente, mas não observados ao vivo
nesta sessão.
