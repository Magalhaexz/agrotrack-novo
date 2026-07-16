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

## 15. Sprint de expansão — as 8 operações que faltavam

Continuação direta desta sprint (base `89624be`), completando a lista de
"limitações conhecidas" da seção 13 original. Mesma arquitetura, mesmo
motor de conversa (`cadastros.js` + `conversas.js`), **custo de IA
continua zero** — nenhuma das 8 intenções novas usa qualquer provedor
externo.

| Intenção | Preparer puro | Escreve em | Confirmação | Permissão |
| --- | --- | --- | --- | --- |
| `cadastrar_lote` | `cadastroLote.js` | `lotes` (insert) | sim | `lotes:editar` |
| `cadastrar_pasto` | `cadastroPasto.js` | `pastagens` (insert) | sim | `pastagens:editar` |
| `registrar_venda` | `acoesLote.js::prepararVendaAnimais` | `movimentacoes_animais` + `lotes` + `movimentacoes_financeiras` (se valor > 0) | sim | `animais:movimentar` |
| `registrar_morte` | `acoesLote.js::prepararMorteAnimais` | `movimentacoes_animais` + `lotes` (nunca financeiro) | sim | `animais:movimentar` |
| `finalizar_lote` | `acoesLote.js::prepararFinalizarLote` | `lotes` (só status/motivo/data) | sim | `lotes:editar` |
| `cadastrar_manejo` | `cadastroManejo.js` | `sanitario` + `estoque`/`movimentacoes_estoque` (se produto e saldo suficientes) | sim | `sanitario:editar` |
| `cadastrar_planejamento_suplementacao` | `suplementacao.js::prepararPlanejamentoSuplementacao` | `lotes` (campos `supl_*`/`consumo_*`, nunca estoque) | sim | `suplementacao:editar` |
| `registrar_consumo_suplementacao` | `suplementacao.js::prepararConsumoSuplementacao` | `consumo_suplementacao` + `estoque` + `movimentacoes_financeiras` | sim | `suplementacao:editar` |

Todas as 8 são cadastros por conversa em etapas (`INTENCOES_CADASTRO` em
`permissoesTelegram.js`) — a mensagem inicial extrai o que der, o slot que
faltar vira pergunta; nada é gravado sem passar por `/confirmar`. Todas
foram adicionadas a `INTENCOES_ATENDIDAS` e `INTENCOES_ESCOPADAS`
(`api/_telegramBot.js`) — contas com mais de uma fazenda precisam
selecionar a fazenda antes de iniciar qualquer uma delas.

### Campos e regras por operação

- **`cadastrar_lote`**: nome, quantidade (cabeças), sexo (`macho`/`femea`/
  `misto`, com sinônimos plural/gênero), peso médio inicial (opcional),
  pasto (opcional, valida mesma fazenda). Fazenda resolvida do contexto da
  conexão (ou automaticamente quando a conta só tem uma) —
  `FAZENDA_NAO_DEFINIDA` se não houver uma fazenda clara. Bloqueia nome
  duplicado de lote ativo na mesma fazenda. Escreve os mesmos defaults
  numéricos de `LotesPage.jsx::buildLoteSavePatch` (rendimento de carcaça
  52%, sem investimento/GMD meta, etc.) — não abre o assistente de
  planejamento econômico completo do formulário web.
- **`cadastrar_pasto`**: nome, área em hectares (opcional) e capacidade de
  suporte (opcional, número livre — o app não define uma unidade fixa no
  formulário). Não inclui "tipo de capim": a tabela `pastagens` não tem
  essa coluna hoje, então o bot não inventa uma.
- **`registrar_venda`** / **`registrar_morte`**: mesma fórmula de
  `registrarSaidaAnimal` (`services/movimentacoes.js`) espelhada em
  `acoesLote.js` (ver nota `ponytail:` no topo do arquivo) — peso médio de
  quem sai é a média atual do lote, `lote.qtd` nunca fica negativo
  (`ANIMAIS_INSUFICIENTES`), venda com valor > 0 gera receita
  (`categoria: venda_animal`), morte nunca gera lançamento financeiro.
  Ambas rejeitam lote finalizado (`LOTE_BLOQUEADO`).
- **`finalizar_lote`**: espelha `FechamentoLoteModal.jsx` +
  `LotesPage.jsx::handleFechamento` — só atualiza `status`,
  `data_encerramento` e `motivo_encerramento`; nunca mexe em pasto,
  pesagens ou custos (histórico sempre preservado). Motivo é obrigatório;
  lote já finalizado devolve `LOTE_JA_FINALIZADO`.
- **`cadastrar_manejo`**: lote, tipo (detecta `vacina`/`vermifugo`/
  `tratamento` pelo próprio verbo da mensagem — "vacinei" já preenche o
  tipo sem perguntar de novo), quantidade de animais tratados, produto e
  quantidade de produto (ambos opcionais). Reaproveita
  `domain/estoqueSanidade.js::calcularBaixaSanitaria` (Sprint 15) para a
  baixa de estoque — **mesma política do app**: saldo insuficiente não
  bloqueia o manejo, só pula a baixa e devolve um aviso explícito na
  confirmação. Carência/próxima dose ficam de fora dos slots (não estavam
  nos exemplos do spec) — podem ser adicionadas depois sem quebrar nada.
- **`cadastrar_planejamento_suplementacao`**: não existe tabela de
  planejamento separada — o planejamento vive nos próprios campos
  `supl_nome`/`consumo_tipo`/`consumo_por_cabeca_dia`/`supl_meta_dias` da
  linha em `lotes` (Bloco 4 de `LoteForm.jsx`). A intenção só faz um
  `update` desses campos; nunca toca em estoque.
- **`registrar_consumo_suplementacao`**: espelha
  `SuplementacaoConsumoModal.jsx` — grava em `consumo_suplementacao`
  (payload com `quantidade_total`/`qtd_total`/`quantidade` duplicados de
  propósito, mesmo padrão do app), baixa `estoque.quantidade_atual` e gera
  despesa (`categoria: nutricao`). Bloqueia saldo insuficiente
  (`SALDO_INSUFICIENTE`) — ao contrário do manejo sanitário, aqui a regra
  do app é impedir saldo negativo, não só avisar. `consumo_suplementacao`
  foi adicionada a `TABELAS_NECESSARIAS` (`api/_herdonDb.js`).

### Interpretação determinística

8 novas `INTENCOES` + regexes em `interpretarComandoTelegram.js`,
verificadas ANTES dos cadastros genéricos de estoque (a palavra de
produto — `ração`/`sal`/`suplemento`/`trato`/`proteinado` — ou o verbo
específico — `vacinar`/`vermifugar`/`vender`/`morrer`/`finalizar` — é o
sinal que desambigua "usei 3 sacos de ração" de uma baixa de estoque
genérica, no mesmo espírito da desambiguação `item_novo` ×
`entrada_estoque` da rodada anterior). `venda`/`morte`/`finalizar`/
`vacina`/`vermifugo`/`suplementacao`/`planejar`/`consumo` entraram no
vocabulário-âncora de tolerância a erro de digitação
(`interpretadorTelegram.js`).

### Segurança e integridade

Mesmas garantias das 4 intenções anteriores, sem nenhum mecanismo novo:
`db` chega recortado por conta/fazenda antes de qualquer resolução de
nome; `writes` são montados campo a campo (nunca `{...dados}`); todo IDs
adulterado no payload nunca chega perto de uma tabela porque os
preparers só leem os campos nomeados. Idempotência e confirmação
reaproveitam `telegram_operacoes_pendentes`/`telegram_conversas`
existentes — nenhuma tabela nova foi criada.

### Testes

**51 testes novos** (1304 → 1355), um arquivo de teste por preparer
(`cadastroLote.test.js`, `cadastroPasto.test.js`, `cadastroManejo.test.js`,
`suplementacao.test.js`), extensão de `acoesLote.test.js` (venda/morte/
finalizar), extensão de `interpretarComandoTelegram.test.js` (classificação
das 8 intenções + não-colisão com `DAR_BAIXA_ESTOQUE` pré-existente) e de
`cadastros.test.js` (integração via `prepararCadastro`). O
`catalogoIntencoes.test.js` (drift-guard) cobre as 8 automaticamente, sem
precisar de teste dedicado.

### Validação real no Telegram

**Não realizada nesta sessão** — mesma limitação da seção 14: implantar em
produção e trocar mensagens reais com o bot alteram estado fora deste
ambiente de desenvolvimento. Fica como pendência explícita, com os
cenários da seção 18 do sprint (as 8 mensagens de exemplo + cancelar,
alterar campo, confirmar duas vezes, visualizador, duas fazendas, erro de
digitação, ambiguidade, saldo insuficiente, lote inexistente) já cobertos
por teste automatizado equivalente.

### Pendências reais (fora do escopo desta rodada)

- Data de entrada do lote (`cadastrar_lote`) e carência/próxima dose
  (`cadastrar_manejo`) não são perguntadas — sempre usam a data de hoje ou
  ficam nulas. Podem virar slots opcionais depois, sem mudar o preparer.
- `cadastrar_pasto` não pergunta "tipo de capim" (coluna inexistente hoje
  na tabela `pastagens`).
- Estorno de consumo de suplementação (mencionado no spec) segue só pelo
  fluxo de edição existente no app — não foi criada uma intenção de bot
  dedicada para isso.

## 16. Sprint Paridade 1 — 4 novas intenções (Fazendas/Lotes/Pastagens)

Continuação a partir de `53f6bec`, primeira rodada de implementação após
`docs/TELEGRAM_PARIDADE_COMPLETA_APP.md`. Mesma arquitetura, custo de IA
zero.

| Intenção | Tipo | Preparer/formatador | Tabela | Confirmação | Permissão |
| --- | --- | --- | --- | --- | --- |
| `cadastrar_fazenda` | cadastro | `cadastroFazenda.js::prepararCadastroFazenda` | `fazendas` (insert) | sim | `fazendas:editar` |
| `renomear_fazenda` | cadastro | `cadastroFazenda.js::prepararRenomearFazenda` | `fazendas` (update) | sim | `fazendas:editar` |
| `listar_pastos` | consulta | `respostasConsulta.js::formatarPastagens` (reaproveita `domain/ocupacaoPastos.js`) | leitura | não | `pastagens:ver` |
| `consultar_resultado_lote` | consulta | `respostasConsulta.js::formatarResultadoLote` (reaproveita `domain/resumoLote.js`) | leitura | não | `lotes:ver` |

`cadastrar_fazenda`/`renomear_fazenda` NÃO entram em `INTENCOES_ESCOPADAS`
— cadastrar ou renomear uma fazenda não pode depender de já ter uma
fazenda selecionada (seria circular). `listar_pastos`/
`consultar_resultado_lote` entram normalmente, como qualquer consulta.

`cadastrar_fazenda` não valida o limite de fazendas do plano
(`canCreateFarm`, `services/subscriptions.js`) — lacuna documentada, não
corrigida: é a mesma ausência de validação de assinatura na camada de
dados já registrada no backlog do app (RLS não valida plano, só o
client-side valida). O bot criar uma fazenda acima do limite do plano não
abre um buraco novo, só herda o gap existente.

### Correções estruturais desta sprint (não são intenções novas)

- **Bug de integridade corrigido**: exclusão de consumo de suplementação
  agora usa uma única função (`domain/consumoSuplementacao.js` +
  `services/consumoSuplementacao.js`), reaproveitada por `LotesPage.jsx`
  e `SuplementacaoPage.jsx` — antes, só uma das duas telas devolvia o
  estoque ao excluir o mesmo tipo de registro.
- **Gap de permissão corrigido**: `RotinaPage.jsx`/
  `CalendarioOperacionalPage.jsx` agora checam `hasPermission` antes de
  criar/editar/excluir/concluir, como as demais páginas operacionais.
- **Motor de alerta duplicado**: avaliado, não corrigido nesta sprint —
  ver `docs/TELEGRAM_PARIDADE_COMPLETA_APP.md` para o plano de migração.

## 17. Sprint Paridade 1 — continuação (bloco 2/3): motor de alertas unificado + 6 novas intenções

Continuação a partir de `710566f`. Custo de IA continua zero.

**Motor de alertas unificado** (3º bloqueio estrutural corrigido): o
painel legado do Dashboard/header (`utils/alerts.js` +
`alertas_resolvidos`/`alertas_adiados`) foi trocado por
`gerarAlertasUnificados` + `alertas_tratativas` — a mesma fonte e a mesma
tabela que a Central e o Telegram já usavam. `domain/alertasUnificados.js::adaptarAlertaParaPainelLegado`
traduz para a forma que `AppHeader.jsx`/`DashboardPage.jsx` já esperavam,
sem reescrever esses componentes. Dashboard, Central, Telegram e
relatório diário agora leem exatamente a mesma tratativa para a mesma
conta/fazenda/data. Isso NÃO adiciona uma ação de resolver/adiar ao bot —
só remove o bloqueio que impedia adicionar uma no futuro com segurança.

| Intenção | Tipo | Preparer/domínio reaproveitado | Tabela | Confirmação | Permissão |
| --- | --- | --- | --- | --- | --- |
| `editar_pesagem` | cadastro | `cadastroPesagem.js` + `domain/pesagensLote.js` (extraído de `PesagensPage.jsx`) | `pesagens` (update) + `lotes` (recalcula `p_at`) | sim | `pesagens:editar` |
| `excluir_pesagem` | cadastro | idem | `pesagens` (delete) + `lotes` | sim | `pesagens:excluir` |
| `ajustar_lotacao` | cadastro | `acoesLote.js::prepararAjusteLotacao` (reaproveita `lotesLogic.js::buildAjusteLotacaoPatch` direto) | `lotes` (update) + `movimentacoes_animais` (insert, tipo `ajuste`) | sim | `lotes:editar` |
| `editar_lote` | cadastro | `acoesLote.js::prepararEdicaoLote` (sem domínio dedicado no app — página só faz update direto) | `lotes` (update: sexo/raça/observação) | sim | `lotes:editar` |
| `editar_pasto` | cadastro | `cadastroPasto.js::prepararEdicaoPasto` (idem, sem domínio dedicado) | `pastagens` (update: área/capacidade/observação) | sim | `pastagens:editar` |
| `retirar_lote_pasto` | cadastro | `acoesPasto.js::prepararRetirarLotePasto` (espelha `prepararTrocaLotePasto` com destino nulo) | `lote_pastagens_historico` (insert) + `lotes` (update) | sim | `lotes:editar` |

`aplicarWrites` (`api/_telegramBot.js`) ganhou suporte a `tipo:'delete'`
(só `insert`/`update` existiam) para `excluir_pesagem`.

### Extração de domínio: `domain/pesagensLote.js`

`PesagensPage.jsx::recalculateLoteFromPesagens` (recálculo de `lote.p_at`/
`ultima_pesagem` a partir do histórico) e as funções auxiliares
(`resolveTipoPesagem`, `resolverUltimaPesagemLote`, `calculateAverageGmdByLote`)
foram extraídas para `domain/pesagensLote.js` — a página passou a
reaproveitar essas funções em vez de manter uma cópia local. O bot usa a
MESMA fórmula para `editar_pesagem`/`excluir_pesagem`, garantindo que o
peso atual do lote nunca diverge entre os dois caminhos.

### Pendências reais desta continuação

- Confirmação editável (corrigir um campo específico sem reiniciar a
  conversa) — não implementada. **Concluída no bloco 4, ver seção 18.**
- RPC transacional nova — avaliado, não criado (ver
  `docs/TELEGRAM_PARIDADE_COMPLETA_APP.md`, seção "Sprint Paridade 1 —
  continuação"). **Concluída no bloco 4, ver seção 18.**
- Ação de escrita de alertas no bot (resolver/ignorar/adiar) — motor
  unificado agora permite, mas a intenção em si não foi adicionada.
- Edição de peso inicial/data de entrada/origem/pasto do lote; visão
  consolidada/resumo/exclusão de fazenda; excluir/inativar pasto; nova
  pesagem em lote via batch/individual por animal.

Ver `docs/TELEGRAM_PARIDADE_COMPLETA_APP.md` para a matriz completa
atualizada e os totais reais.

## 18. Sprint Paridade 1 — bloco 4: confirmação editável + RPCs transacionais

Continuação a partir de `cf8e7c1`. Custo de IA continua zero.

**Confirmação editável.** Módulo central `src/domain/telegram/edicaoPendente.js`
(puro) + integração em `api/_telegramBot.js::tentarEditarPendente`.
Reconhece frases de correção ("troque/mude/altere/corrija/atualize `<campo>`
para `<valor>`", e "remover/retirar pasto" como caso especial), acha o slot
correspondente no catálogo da intenção pendente (nome exato, sinônimo
pequeno, ou campo composto tipo `nome`→`nome_lote`), e revalida tudo via
`prepararCadastro` — a mesma resolução de entidade/regra de negócio de uma
proposta nova. Faz `UPDATE` na mesma linha `telegram_operacoes_pendentes`
(mesmo `id`), nunca cria uma segunda pendência; revalidação falhando não
altera a pendência original. Escopo: só operações `tipo_operacao='cadastro'`
(a maioria das intenções); os 2 tipos legados de payload bespoke
(`transferir_animais`/`renomear_lote`) ficam sem edição de campo nesta
rodada.

**RPCs transacionais.** Nova migration
`supabase/migrations/20260716120000_rpcs_transacionais_lote_pesagem.sql`
com 8 funções `SECURITY DEFINER` (1 helper + 7 operações):

| RPC | Cobre |
| --- | --- |
| `app_assert_owner_write` | helper compartilhado — valida `p_owner_user_id` contra a sessão quando autenticado; confia na checagem de perfil já feita em JS quando é o service-role do bot |
| `registrar_saida_lote` | venda, morte, abate, descarte, transferência de saída e entre lotes (unificado, mesmo padrão de `services/movimentacoes.js`) |
| `ajustar_lotacao_lote` | ajuste de lotação (porta `buildAjusteLotacaoPatch`) |
| `finalizar_lote` | finalização, com guarda server-side contra dupla finalização |
| `mover_lote_para_pasto_bot` | troca e retirada de pasto (destino opcional) — gêmea `SECURITY DEFINER` de `mover_lote_para_pasto` (`SECURITY INVOKER`, inacessível ao bot) |
| `editar_ultima_pesagem_lote` | edição, recalcula `lotes.p_at`/`ultima_pesagem` no banco |
| `excluir_ultima_pesagem_lote` | exclusão, com fallback pela média dos animais |
| `criar_lote_completo` | cadastro de lote + grupo em `animais` + pesagem inicial + histórico de pasto, atomicamente (fecha o gap de `CADASTRAR_LOTE`) |

Os módulos `acoesLote.js`/`acoesPasto.js`/`cadastroPesagem.js`/
`cadastros.js` mantêm 100% da resolução/validação de antes, só passaram a
devolver `rpc:{nome, params}` em vez de `writes:[...]` para essas 8
operações. `api/_telegramBot.js` ganhou `aplicarRpc` (uma chamada
`client.rpc(...)`, transacional por natureza) como alternativa a
`aplicarWrites` (um `for` sequencial sem checagem de erro), escolhida
quando o plano tem `.rpc`.

**Decisão de escopo**: o app web (`services/movimentacoes.js`) não foi
migrado para as RPCs nesta rodada — só o bot.

**Correção**: o "achado à parte" registrado aqui originalmente (colunas
`peso_medio_atual`/`motivo_encerramento` inexistentes) estava errado —
baseava-se num dump de schema desatualizado. As duas colunas existem de
verdade no banco real; as RPCs já foram escritas para gravar nelas.

## 19. Ativação: migration aplicada, vulnerabilidade corrigida, smoke tests

Continuação a partir de `19736b8`. A migration foi revisada contra o
schema real (`information_schema`, não o dump), corrigida (2 bugs de
coluna) e **aplicada em produção** — único ambiente disponível
(`list_branches` não mostra homologação separada).

**Vulnerabilidade crítica encontrada e corrigida na mesma sessão**: depois
de aplicar, `anon` (sem login) tinha `EXECUTE` nas 8 funções — Supabase
concede `EXECUTE` por padrão a `anon`/`authenticated`/`service_role` via
`ALTER DEFAULT PRIVILEGES`, um grant que `REVOKE ALL FROM PUBLIC` não
remove. Como `app_assert_owner_write` só validava quando
`auth.role()='authenticated'`, um chamador `anon` caía no ramo "confia no
parâmetro" — escrita cross-conta completa, sem autenticação nenhuma.
Corrigido imediatamente: `REVOKE EXECUTE ... FROM anon` nas 8 funções +
`app_assert_owner_write` reescrita para negar explicitamente qualquer
papel que não seja `service_role`/`authenticated` validado (migration de
avanço `20260716181018_hardening_rpcs_transacionais_revoke_anon.sql`).
Confirmado via `get_advisors` que `anon` não aparece mais como executor de
nenhuma das 8 funções.

**Smoke tests diretos** contra dados QA reais (`Fazenda QA Sprint 34`),
numa transação com `ROLLBACK` (nada persistiu): 17 casos cobrindo as 8
RPCs (caminho feliz + erros de valor + cross-conta + permissão) — 16
corretos de primeira, 1 falso-negativo de teste (query de verificação sem
filtro `origem_tipo`) identificado e corrigido. Matriz completa em
`docs/TELEGRAM_PARIDADE_COMPLETA_APP.md`, seção "Sprint Paridade 1 —
bloco 4 (ativação)".

**Validação autenticada no app**: não se aplica — confirmado por grep que
nenhum código de `src/services/`/`src/pages/` chama as 8 RPCs (só o bot).
**Validação real no Telegram**: sem acesso nesta sessão, não validado.

**Pendências reais**: ação de escrita de alertas, edição completa de
lote, fazenda consolidada/exclusão, exclusão de pasto, pesagem batch,
matriz de idempotência/permissão/multi-fazenda dedicada (cobertura
representativa feita, não exaustiva), validação real no Telegram.
