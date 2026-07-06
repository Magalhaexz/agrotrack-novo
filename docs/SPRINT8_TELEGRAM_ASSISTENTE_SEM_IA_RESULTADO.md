# Sprint 8 — Assistente do Bot do Telegram (sem IA generativa)

Faz o Bot do Telegram do HERDON responder perguntas úteis do produtor por
**comandos e palavras-chave**, sem contratar nenhum provedor de IA paga.
Reaproveita 100% do que já existia: Motor Único de Alertas (Sprint 5),
conexão multiusuário e formatador de Telegram (Sprint 7).

## Por que sem IA generativa

Este sprint substitui a ideia original de "Assistente IA" (que chamaria um
provedor pago como OpenAI/Claude/Gemini) por um **interpretador de regras**:
mais barato (custo zero por mensagem), mais previsível (nunca inventa
número) e suficiente para as perguntas que o produtor realmente faz no dia a
dia. Ver [Diferença entre assistente por regras e IA generativa](#diferença-entre-assistente-por-regras-e-ia-generativa)
e [Como evoluir para IA paga no futuro](#como-evoluir-para-ia-paga-no-futuro).

## Arquitetura

```
Telegram → api/telegram-webhook.js
             ├─ código HERDON-XXXXXX?      → fluxo de pareamento (Sprint 7, inalterado)
             └─ senão:
                 ├─ chat_id sem conexão ativa → "envie o código..."
                 └─ chat_id conectado:
                     ├─ src/domain/telegramIntent.js   → classifica a intenção
                     ├─ api/_herdonDb.js                → carrega os dados do owner_user_id
                     ├─ src/domain/alertasUnificados.js → gera os alertas (Sprint 5, inalterado)
                     └─ src/domain/telegramRelatorio.js → formata a resposta por intenção
```

### Arquivos novos

- `src/domain/telegramIntent.js` — classifica a mensagem em uma das 8
  intenções (`ajuda`, `relatorio`, `prioridades`, `pagamentos`, `estoque`,
  `tarefas`, `lotes`, `desconhecido`) por regex de comando/palavra-chave.
  Puro, sem I/O, sem custo.
- `api/_herdonDb.js` — extraído de `telegram-relatorio-diario.js` (Sprint 7)
  para ser reaproveitado também pelo webhook: monta o `db` de uma conta
  filtrando todas as tabelas por `owner_user_id`. Nenhuma lógica nova, só
  deixou de estar duplicado em dois arquivos.

### Arquivos alterados

- `src/domain/telegramRelatorio.js` — ganhou 6 novas funções de formatação
  (`gerarRespostaAjudaTelegram`, `gerarRespostaPrioridadesTelegram`,
  `gerarRespostaPagamentosTelegram`, `gerarRespostaEstoqueTelegram`,
  `gerarRespostaTarefasTelegram`, `gerarRespostaLotesTelegram`). Todas
  recebem a lista de alertas já pronta (`gerarAlertasUnificados`) e só
  filtram/formatam — nenhum cálculo novo.
- `api/telegram-webhook.js` — reescrito para rotear entre pareamento,
  comando fixo e pergunta livre. O fluxo de pareamento por código é
  exatamente o mesmo do Sprint 7 (não alterado).
- `api/telegram-relatorio-diario.js` — passou a importar `montarDbDaConta`
  de `api/_herdonDb.js` em vez de definir a função localmente (mesmo
  comportamento, sem duplicação).

## Comandos disponíveis

| Comando | Resposta |
|---|---|
| `/ajuda` | Lista de comandos e exemplos de perguntas |
| `/relatorio` | Relatório diário completo (mesmo texto do envio agendado) |
| `/prioridades` | Até 6 pendências mais urgentes, na ordem do Motor Único de Alertas |
| `/pagamentos` | Contas vencidas / vencendo hoje / nos próximos 7 dias |
| `/estoque` | Itens de estoque zerados, abaixo do mínimo ou perto do mínimo |
| `/tarefas` | Tarefas atrasadas e tarefas de hoje |
| `/lotes` | Lotes com GMD abaixo da meta, sem pesagem recente, prontos para avaliar venda ou com custo/@ alto |

## Perguntas reconhecidas (exemplos)

| Pergunta | Intenção |
|---|---|
| "O que preciso fazer hoje?" | prioridades |
| "Tem conta vencida?" | pagamentos |
| "Tem produto acabando?" | estoque |
| "Qual lote está pior?" | lotes |
| "Tenho lote pronto para venda?" | lotes |
| "Tem tarefa atrasada?" | tarefas |
| "Como está minha fazenda hoje?" | relatorio |

Qualquer mensagem que não bata com nenhuma regra cai em `desconhecido` e
recebe a mesma resposta de `/ajuda` (comandos + exemplos), nunca um erro.

## Dados usados

Todos vêm do `db` da própria conta (`owner_user_id` resolvido a partir do
`telegram_chat_id` em `telegram_connections` — nunca do texto da mensagem):

- `gerarAlertasUnificados(db)` (Sprint 5) — mesma fonte do Dashboard e do
  relatório diário. Cada função de resposta só filtra por `origem` ou `tipo`:
  - `/pagamentos`: `origem === 'financeiro'`
  - `/estoque`: `origem === 'estoque'`
  - `/tarefas`: `origem === 'tarefas'`
  - `/lotes`: `tipo` em `gmd`, `peso_alvo`, `sem-pesagem`, `pronto-venda`,
    `custo-alto-arroba` (não inclui pasto nem sanidade)
- Contagem bruta das tabelas (`lotes`, `estoque`, `tarefas`,
  `movimentacoes_financeiras`) só para decidir entre "sem dados suficientes"
  (conta nova, tabela vazia) e "sem pendências agora" (tabela tem registros,
  mas nada crítico no momento).

Nenhum valor em R$ linha a linha, nome de fornecedor ou descrição de despesa
individual é enviado — mesmo cuidado de privacidade do relatório diário
(Sprint 6).

## Não inventar dados

Quando a tabela relevante para o comando está vazia (ex.: conta nova, sem
nenhum lançamento financeiro), a resposta é sempre:

> Não encontrei dados suficientes no HERDON para responder isso agora.

Quando há dados mas nada pendente no momento, a resposta é positiva (ex.:
"✅ Nenhuma conta vencida ou vencendo em breve.") — a IA nunca "inventa" um
problema nem afirma que está tudo bem sem checar.

## Diferença entre assistente por regras e IA generativa

| | Assistente por regras (este sprint) | IA generativa |
|---|---|---|
| Custo por mensagem | zero | por token, provedor pago |
| Previsibilidade | 100% determinístico (mesma pergunta → mesma resposta) | pode variar |
| Cobertura de perguntas | só as que baterem com uma regra conhecida | qualquer pergunta em linguagem natural |
| Risco de "alucinação" | nenhum — só filtra dados reais já calculados | precisa de guardrails para não inventar número |
| Latência | imediata (sem chamada de rede externa) | depende do provedor |

## Limitações

- Só reconhece perguntas parecidas com os exemplos cobertos — uma pergunta
  fora do padrão (ex.: "por que meu lote 3 está mais lento que o lote 5?")
  cai em `desconhecido` e recebe a ajuda genérica, não uma resposta
  específica.
- Não há memória de conversa: cada mensagem é interpretada isoladamente.
- `/lotes` não identifica lotes individualmente por nome na pergunta (ex.
  "como está o lote 12?") — lista os lotes com pendência, o produtor abre o
  HERDON para o detalhe.

## Como evoluir para IA paga no futuro

Se o volume de perguntas fora do padrão justificar, dá para acoplar um
provedor de IA (OpenAI/Claude/Gemini) **sem jogar fora nada deste sprint**:

1. `classificarIntencaoTelegram` continua sendo o primeiro filtro — comandos
   fixos e perguntas já reconhecidas continuam respondendo sem custo.
2. Só a intenção `desconhecido` (perguntas que não bateram com nenhuma
   regra) passaria para um provedor de IA, com o mesmo `db`/alertas já
   montados aqui como contexto resumido (nunca o banco inteiro).
3. A chave da IA ficaria só no backend (`AI_API_KEY`, nunca `VITE_`), com
   timeout e limite de tamanho de resposta — mesmo padrão de segurança já
   usado em `api/_asaas.js`/`api/_telegram.js`.

## Segurança

- `TELEGRAM_BOT_TOKEN` continua só no backend (`api/_telegram.js`), nunca no
  bundle do frontend.
- Nenhuma chave de IA foi criada (`AI_API_KEY` **não existe** neste sprint).
- Nenhuma migration foi criada — reaproveita as tabelas do Sprint 7
  (`telegram_connections`) sem alterar RLS.
- `owner_user_id` nunca é aceito do texto da mensagem: vem exclusivamente de
  `telegram_connections.owner_user_id`, resolvido pelo `telegram_chat_id` do
  update do Telegram.
- `getResumoLote`, DRE, financeiro, simulador e domínio pecuário não foram
  alterados — só leitura via `gerarAlertasUnificados` (já existente).

## Validação

- lint: 0 erros
- testes: 813 passando (13 novos — `telegramIntent.test.js` +
  formatadores em `telegramRelatorio.test.js`)
- build: ok
- confirmado (`grep` no `dist/`) que `TELEGRAM_BOT_TOKEN` e qualquer valor
  `SERVER_ONLY` não aparecem no bundle
- confirmado que nenhuma dependência nova foi adicionada ao `package.json`
  (sem SDK de IA)
