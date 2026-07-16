# Assistente Inteligente HERDON no Telegram (HISTÓRICO — arquitetura removida)

> ⚠️ **Este documento descreve uma arquitetura que foi integralmente
> removida na sprint seguinte** ("Remoção da Claude API e consolidação do
> bot operacional gratuito do Telegram"). A integração com a Claude API
> descrita abaixo **não existe mais no código** — não há `ANTHROPIC_API_KEY`,
> não há `@anthropic-ai/sdk`, não há nenhuma chamada a provedor de IA. O bot
> do Telegram voltou a ser 100% determinístico (regex + sinônimos +
> tolerância a erro de digitação), sem custo de IA. Ver
> [`docs/TELEGRAM_BOT_OPERACIONAL_SEM_IA.md`](TELEGRAM_BOT_OPERACIONAL_SEM_IA.md)
> para a arquitetura atual. Este arquivo é mantido só como registro
> histórico de por que a arquitetura foi tentada e por que foi revertida
> (decisão do usuário, reabrindo — e depois reconfirmando — a decisão
> original do Sprint 8 de não usar IA paga).
>
> O que **sobreviveu** da sprint da Claude API (nada foi jogado fora):
> o catálogo de ferramentas (`telegramToolsRegistry.js`), as 4 operações
> novas (`cadastrar_tarefa`, `cadastrar_item_estoque`, `dar_baixa_estoque`,
> `trocar_lote_pasto`) e o mecanismo de confirmação/idempotência — só o
> *interpretador* de linguagem natural trocou de Claude para determinístico.

Sprint bloqueador. Base original: commit `e3a3267`. Transforma o bot do
Telegram, hoje 100% determinístico (regex/aliases, "sem IA generativa" por
decisão explícita do Sprint 8), em um assistente conversacional real com a
Claude API — sem descartar nada do que já funciona.

## Origem

Spec detalhada em português fornecida pelo usuário (37 seções). Antes de
qualquer código, duas decisões foram levadas ao usuário porque tinham
implicações reais de custo/infraestrutura e reabriam uma decisão já tomada
neste repositório (ver `docs/SPRINT8_TELEGRAM_ASSISTENTE_SEM_IA_RESULTADO.md`):

1. **Provedor de IA real (Claude API) vs. motor determinístico ampliado** —
   escolhido: **Claude API real**, com a ressalva de que isso tem custo por
   mensagem e exige `ANTHROPIC_API_KEY` configurada.
2. **Escopo desta sessão** — escolhido: **fatia MVP real e completa**
   (arquitetura inteira + um subconjunto representativo com testes reais e
   validação real, documentando claramente o que fica para depois), em vez
   de tentar as 37 seções inteiras sem conseguir validar tudo de verdade.

## 1. Diagnóstico do bot existente (antes de qualquer alteração)

| Componente | Arquivo | Função atual | Consumidores | Situação |
| --- | --- | --- | --- | --- |
| Webhook | `api/telegram-webhook.js` | Recebe updates, verifica `secret_token`, roteia entre pareamento/bot novo/**IA (nova)**/legado Sprint 8 | Telegram Bot API | Ativo; nesta sprint ganhou um 4º degrau (IA) entre o bot novo e o legado |
| Pareamento | `api/telegram-gerar-codigo.js`, `api/_telegramConnections.js` | Gera código `HERDON-XXXXXX`, resolve `owner_user_id` via `profiles`, nunca do texto | App (gera) + webhook (consome) | Intocado |
| Orquestrador determinístico | `api/_telegramBot.js` | Interpreta por regex, cria/confirma `telegram_operacoes_pendentes`, aplica writes | Webhook | Intocado nos fluxos existentes; ganhou `executarFerramentaIA` (novo branch `tipo_operacao='ia_tool'`) e 5 funções exportadas para reuso |
| Interpretador determinístico | `src/domain/telegram/interpretarComandoTelegram.js` | 22 intents por regex, "SEM IA externa" (comentário original) | `_telegramBot.js` | Intocado — continua sendo o 1º degrau, tentado antes da IA |
| Legado (Sprint 8) | `src/domain/telegramIntent.js`, `src/domain/telegramComandos.js` | 7 intents por palavra-chave, `/start /ajuda /status /contas /alertas` | Webhook (fallback final) | Intocado — é o "fallback sem IA" da seção 29, e já existia |
| Conversas por etapas | `src/domain/telegram/conversas.js` + tabela `telegram_conversas` | Slot-filling determinístico de 1 cadastro por vez | `_telegramBot.js` | Intocado — distinto do contexto novo da IA (ver seção 5 abaixo) |
| Confirmação | `src/domain/telegram/operacoesPendentes.js` + tabela `telegram_operacoes_pendentes` | TTL 5 min, CAS idempotente (`UPDATE ... WHERE status='pendente'`), só o mesmo user_id+chat_id confirma | Toda ação mutável, incl. a IA agora | Intocado — a IA reusa 100% este mecanismo |
| Permissões | `src/domain/telegram/permissoesTelegram.js` reaproveitando `src/auth/perfis.js` | Mapeia intenção → permissão do app | `_telegramBot.js` | Intocado; a IA usa a MESMA matriz (`perfilTemPermissao`), nunca uma segunda fonte |
| Alertas/relatório diário | `src/domain/alertasUnificados.js`, `telegramFazenda.js`, `telegramRelatorio.js`, cron `api/telegram-relatorio-diario.js` | Motor único de alertas do app, sem duplicar cálculo | Webhook, bot, cron | Intocado |
| Auditoria | `telegram_bot_auditoria` | Registra ações mutáveis + negações de permissão | `_telegramBot.js` | Intocado; a IA grava nela também (`ia_resposta_invalida` + o nome de cada ferramenta executada) |
| Multi-fazenda | `src/domain/telegramFazenda.js`, `telegram_connections.fazenda_id` | Recorte por fazenda; pede seleção quando há mais de uma e nenhuma pinada | `_telegramBot.js`, webhook | Intocado; a IA reusa a mesma trava para ferramentas de escrita |
| Testes existentes | 16 arquivos, ~135 casos | Cobertura de intents, entidades, cadastros, ações, permissões, pendências, conversas | `npm test` | Intocados, todos continuam passando |
| Provedor de IA | — | **Nenhum.** Zero dependência de IA, zero chamada de rede a um LLM em todo o repositório antes desta sprint | — | Greenfield — confirmado por grep e por leitura de `docs/SPRINT8_TELEGRAM_ASSISTENTE_SEM_IA_RESULTADO.md` |

**Achados que moldaram o desenho** (não corrigidos aqui — fora do escopo
desta sprint, registrados para não serem re-descobertos):

- Existem **dois interpretadores de intenção paralelos** (legado Sprint 8 de
  7 intents e o novo de 22 intents) — a IA se soma como um **terceiro degrau**,
  entre os dois, em vez de substituir qualquer um.
- O pipeline de 4 passos de alertas (`prepararAlertasEscopados` →
  `gerarAlertasUnificados` → `aplicarTratativasAosAlertas` →
  `enriquecerAlertasComFazenda`) está duplicado em 3 lugares — não mexido
  aqui.
- `executarCadastro` revalida permissão na confirmação; `executarTransferencia`/
  `executarRenomear` não. A execução da IA (`executarFerramentaIA`) **sempre
  revalida** — ver seção 7.

## 2. Arquitetura

```
Telegram
  → webhook (api/telegram-webhook.js)
  → bot determinístico (api/_telegramBot.js) — 1º degrau, grátis, já testado
  → [não reconheceu] Assistente IA (api/_telegramIA.js) — 2º degrau
      → normalizador de contexto (src/domain/telegram/contextoIA.js)
      → interpretador (src/domain/telegram/interpretarMensagemIA.js)
          → Claude API com tool use (api/_anthropicClient.js)
          → validação do retorno (nunca confia no JSON bruto)
      → catálogo central de ferramentas (src/domain/telegram/telegramToolsRegistry.js)
          → domínio (funções puras já existentes + 4 novas desta sprint)
          → Supabase (aplicarWrites, já existente)
      → confirmação (telegram_operacoes_pendentes, já existente)
  → [IA indisponível/erro] fallback legado (Sprint 8) — 3º degrau, sem IA
```

A IA **nunca**: escreve SQL, chama Supabase diretamente, escolhe tabela
livremente, inventa ID, executa código, altera permissão, ignora
confirmação, contorna RLS, ou responde com dado que não veio de uma
ferramenta do catálogo. Ela só propõe **qual ferramenta chamar com quais
parâmetros**; a validação, a confirmação e a escrita continuam sendo
decididas por código determinístico — a mesma garantia que o bot já tinha
para os fluxos existentes, agora extendida ao caminho novo.

## 3. Catálogo central de ferramentas

`src/domain/telegram/telegramToolsRegistry.js`. Cada entrada declara
`{ name, description, category, riskLevel, requiredPermission, requiredFields,
optionalFields, inputSchema, execute, formatResult }` — a IA só recebe (via
`construirFerramentasClaude`) `name`/`description`/`input_schema`; nunca vê
nem pode chamar `execute` diretamente.

`riskLevel`:
- `leitura` — executa direto, sem confirmação (8 ferramentas de consulta).
- `escrita_simples` — exige `/confirmar` (6: pesagem, despesa, receita,
  entrada de estoque — já existentes — + as 2 cadastros novos).
- `critica` — exige `/confirmar` com resumo completo (4: transferir animais,
  renomear lote — já existentes — + as 2 ações novas de movimentação).

18 ferramentas no catálogo: 14 reaproveitam funções de domínio já existentes
(consultas + `acoesLote.js` + `cadastros.js`, sem duplicar lógica) e 4 são
novas desta sprint.

## 4. Interpretação de linguagem natural

`src/domain/telegram/interpretarMensagemIA.js`. A Claude API decide via
**tool use forçado por schema** (`tool_choice: 'auto'`) — ou chama uma
ferramenta do catálogo com parâmetros que batem exatamente com o
`input_schema` dela, ou responde com texto livre (usado para pedir
esclarecimento, listar ambiguidade, ou responder pergunta fora de dado).
Isso é estruturalmente diferente de pedir "responda em JSON": o modelo é
tecnicamente impedido de nomear uma ferramenta fora da lista enviada.

Mesmo assim, **nada do que o modelo devolve é executado sem passar por
`validarChamadaFerramenta`**: ferramenta precisa existir no catálogo
*oferecido àquela chamada específica* (já filtrado por permissão — um
visualizador nunca recebe `cadastrar_tarefa` na lista, então mesmo que o
modelo "alucinasse" o nome certo, a validação roda contra o catálogo que foi
realmente enviado), campos obrigatórios presentes, valores de enum válidos, e
qualquer campo extra (`owner_user_id`, `id`, ou qualquer coisa fora do
`requiredFields`/`optionalFields` declarado) é descartado antes de chegar ao
`execute`. Ver `src/domain/telegram/telegramIASeguranca.test.js`.

## 5. Contexto conversacional

Tabela nova `telegram_ia_contexto` (migration `20260715142221`) — TTL de 20
minutos, até 6 turnos (12 mensagens) guardados por chat. Distinta de
`telegram_conversas` (slot-filling de UM cadastro por vez, campo a campo):
aqui é histórico de mensagens livre, para a IA responder acompanhamentos
("e quanto tempo isso dura?") sem redescobrir o assunto.

Comandos de controle (`comandoDeControle` em `contextoIA.js`) são
verificados **antes** de chamar a IA — funcionam mesmo se o provedor estiver
fora do ar: `cancelar/parar`, `começar de novo/limpar conversa`,
`trocar fazenda` (delega ao comando determinístico `usar fazenda X`),
`menu`, `ajuda`.

## 6. Multi-fazenda

Reaproveita `telegram_connections.fazenda_id` e `filtrarDbPorFazenda`
(iguais ao bot determinístico). Regra nova explícita: se a conta tem mais de
uma fazenda e nenhuma está selecionada, **qualquer ferramenta de escrita é
recusada antes de rodar** (`processarMensagemIA`, checagem
`riskLevel !== 'leitura'`) — a IA responde pedindo a fazenda antes de
prosseguir. Consultas continuam podendo responder de forma consolidada.

## 7. Permissões

Mesma matriz do app inteiro (`src/auth/perfis.js`, `perfilTemPermissao`) —
nenhuma segunda fonte de verdade. `ferramentasPermitidas()` filtra o
catálogo **antes** de montar o prompt (defesa em profundidade: a IA nem sabe
que uma ferramenta proibida existe). A execução (`executarFerramentaIA` em
`_telegramBot.js`) **revalida a permissão de novo**, com o perfil lido na
hora da confirmação — cobre o caso de o perfil mudar entre a proposta e o
`/confirmar` (mesmo padrão que `executarCadastro` já tinha; estendido aqui
também às 2 ações críticas quando vêm pela IA).

## 8. Idempotência e confirmação

Reaproveita 100% o mecanismo existente: `telegram_operacoes_pendentes`
(TTL 5 min, `UPDATE ... WHERE status='pendente'` como compare-and-swap,
checagem de mesmo `user_id`+`chat_id`). Toda ferramenta de escrita da IA
grava `tipo_operacao='ia_tool'`, `payload:{tool, params}` — um único branch
novo em `confirmar()` (`_telegramBot.js`) despacha para
`executarFerramentaIA`, que recarrega o `db` fresco (contra saldo
desatualizado) antes de aplicar os writes.

## 9. Ações compostas / atomicidade

`dar_baixa_estoque` gera até 3 writes atômicos no mesmo plano (movimentação
de estoque + atualização de saldo + lançamento financeiro condicional,
espelhando `registrarSaidaEstoque` do app) — todos aplicados por
`aplicarWrites` (já existente) na mesma execução de `/confirmar`; se uma
etapa falhar, a exceção sobe e a operação pendente vira `status='erro'`, sem
marcar como executada. Não há uma transação SQL real (o Supabase client não
expõe uma aqui) — o mesmo comportamento que o restante do bot já tinha
para "escrita" (várias chamadas sequenciais, TODAS gravadas antes de marcar
sucesso).

## 10. Segurança contra injeção de prompt

Todo texto do usuário — e todo dado vindo de fazenda/lote/produto/
observação — é tratado como conteúdo pelo `system prompt`
(`construirSystemPrompt`), nunca como instrução. A defesa real, porém, não é
o texto do prompt (que é só uma instrução a mais que um ataque sofisticado
poderia tentar contornar) — é estrutural: mesmo que o modelo "obedecesse" a
um prompt injetado e tentasse chamar uma ferramenta fora do catálogo, ou
com um campo além do declarado, ou grave em outra conta, isso é
estruturalmente impossível de executar (ver `telegramIASeguranca.test.js`):
catálogo fechado, `db` já recortado por conta/fazenda antes de a IA ver
qualquer coisa, campos extras descartados, permissão revalidada na
confirmação.

## 11. Auditoria

`telegram_bot_auditoria` (já existente) ganha duas categorias novas de
`acao`: o **nome de cada ferramenta da IA executada** (mesmo padrão das
ações antigas) e `ia_resposta_invalida` (quando o modelo devolve algo que
falha a validação — nunca executado, mas registrado com o motivo técnico e
o texto original do usuário, para auditoria sem expor detalhe interno ao
usuário).

## 12. Fallback sem IA

Já existia antes desta sprint, por construção: o bot determinístico
(`_telegramBot.js`) e o legado (Sprint 8) continuam funcionando sem
qualquer dependência da Claude API. `processarMensagemIA` devolve `null`
(nunca lança) quando `ANTHROPIC_API_KEY` não está configurada
(`iaDisponivel()`) ou quando a Claude API falha por qualquer motivo — o
webhook cai automaticamente para o fallback Sprint 8. `/menu`, `/ajuda`,
`/fazendas`, `/lotes`, `/estoque`, `/tarefas`(Sprint 8)/`/alertas`,
`/cancelar` continuam disponíveis sem nenhuma chamada de IA.

## 13. Ferramentas novas desta sprint

| Ferramenta | Tabela(s) | Campos espelhados de | riskLevel | Permissão |
| --- | --- | --- | --- | --- |
| `cadastrar_tarefa` | `tarefas` | `EMPTY_TASK` (`TarefasPage.jsx`) | escrita_simples | `tarefas:editar` |
| `cadastrar_item_estoque` | `estoque` | `CadastroItemModal` (`EstoquePage.jsx`) | escrita_simples | `estoque:editar` |
| `dar_baixa_estoque` | `movimentacoes_estoque`, `estoque`, `movimentacoes_financeiras` (condicional) | `registrarSaidaEstoque` (`src/services/movimentacoes.js`) | critica | `estoque:movimentar` |
| `trocar_lote_pasto` | `lote_pastagens_historico`, `lotes` | RPC `mover_lote_para_pasto` (migration `20260619113446`) — reimplementado em vez de chamado (ver nota abaixo) | critica | `lotes:editar` |

**Nota sobre `trocar_lote_pasto`**: a RPC real do app é `SECURITY INVOKER` e
depende de RLS para recusar lote/pasto de outra conta. O webhook usa o
cliente de service role (RLS ignorada) para tudo — chamar a RPC direto
abriria uma movimentação cross-conta silenciosa. A validação foi
espelhada em `src/domain/telegram/acoesPasto.js` (com um comentário
`ponytail:` documentando o porquê e o caminho de upgrade), operando sobre o
`db` já recortado por conta — a mesma garantia que toda outra escrita do bot
já usa.

## 14. Testes

68 casos novos (1197 → 1272, `npm test`), organizados por arquivo:

| Arquivo | Cobre |
| --- | --- |
| `cadastroTarefa.test.js` (7) | Validação, resolução de lote/responsável, defaults, ausência do campo recorrência |
| `cadastroItemEstoque.test.js` (6) | Validação, duplicação de colunas espelhadas, categoria fora do enum |
| `acoesEstoque.test.js` (9) | Saldo insuficiente, ambiguidade, lançamento financeiro condicional por tipo |
| `acoesPasto.test.js` (8) | Lote bloqueado, fazenda divergente, mesmo-pasto-sem-motivo, não altera quantidade |
| `telegramToolsRegistry.test.js` (11) | Contrato de todo item do catálogo, filtro por permissão, adaptadores das ações críticas existentes |
| `contextoIA.test.js` (5) | TTL, limite de turnos, comandos de controle |
| `interpretarMensagemIA.test.js` (15) | Ferramenta alucinada, campo faltando, enum inválido, erro/indisponibilidade do provedor, contexto multi-turno |
| `_anthropicClient.test.js` (2) | Caminho sem chave de API nunca lança exceção |
| `_telegramBotIA.test.js` (5) | Integração real com `/confirmar` existente, idempotência, revalidação de permissão |
| `telegramIASeguranca.test.js` (7) | Injeção de prompt, isolamento cross-conta, campos extras descartados |

Todos os 1272 testes (1197 pré-existentes + 68 novos) passam; nenhum teste
existente foi alterado.

### Tabela intenção → cobertura

| Intenção/Ferramenta | Consulta | Escrita | Confirmação | Permissão | Testada (unitário) | Testada (Telegram real) |
| --- | --- | --- | --- | --- | --- | --- |
| 8 consultas (fazendas/lotes/lote/estoque/financeiro/manejos/pesagens/resumo) | ✅ | — | não exige | leitura da respectiva permissão | ✅ (reusam formatadores já testados) | ❌ (sem chave de API — ver seção 15) |
| `transferir_animais_entre_lotes` | — | ✅ | crítica | `animais:movimentar` | ✅ | ❌ |
| `renomear_lote` | — | ✅ | crítica | `lotes:editar` | ✅ | ❌ |
| `registrar_pesagem` | — | ✅ | simples | `pesagens:editar` | ✅ (via `cadastros.js`, já coberto) | ❌ |
| `cadastrar_despesa`/`cadastrar_receita` | — | ✅ | simples | `financeiro:editar` | ✅ | ❌ |
| `registrar_entrada_estoque` | — | ✅ | simples | `estoque:movimentar` | ✅ | ❌ |
| `cadastrar_tarefa` (novo) | — | ✅ | simples | `tarefas:editar` | ✅ | ❌ |
| `cadastrar_item_estoque` (novo) | — | ✅ | simples | `estoque:editar` | ✅ | ❌ |
| `dar_baixa_estoque` (novo) | — | ✅ | crítica | `estoque:movimentar` | ✅ | ❌ |
| `trocar_lote_pasto` (novo) | — | ✅ | crítica | `lotes:editar` | ✅ | ❌ |

## 15. Validação real no Telegram — pendência real, não concluída

**Não há `ANTHROPIC_API_KEY` configurada nem localmente nem (até onde este
ambiente consegue verificar) no projeto Vercel.** Sem uma chave real, a
Claude API nunca é chamada de verdade — todo o comportamento de linguagem
natural foi validado com um `chamarClaude` **injetado e controlado pelo
teste** (`interpretarMensagemIA.test.js`, `telegramIASeguranca.test.js`),
nunca contra o modelo real.

Isso significa que a arquitetura, a validação, a segurança e a integração
com o mecanismo de confirmação existente estão testadas de ponta a ponta —
mas a qualidade real da interpretação de linguagem natural (typos, frases
informais, ambiguidade semântica genuína) **não foi observada com o modelo
de verdade**, e nenhuma mensagem real foi trocada com o bot no aplicativo
do Telegram nesta sessão.

**Não estou declarando esta sprint "IA completa"** — por construção, essa
declaração exigiria a validação real desta seção, que não pôde ser feita.
Para completar: configurar `ANTHROPIC_API_KEY` (e opcionalmente
`TELEGRAM_IA_MODEL`/`TELEGRAM_IA_MAX_TOKENS`/`TELEGRAM_IA_EFFORT`) no
projeto Vercel, implantar, e repetir os cenários de teste do item 33 do
spec (consultas, cadastros, movimentações, contexto multi-turno, tentativas
de segurança) através do aplicativo real do Telegram com a conta QA já
existente desta sprint bloqueadora anterior.

## 16. Limitações conhecidas (não corrigidas nesta sprint)

- As 30+ escritas citadas no spec original (venda, morte/perda, finalização
  de lote, manejo sanitário completo, suplementação por linguagem natural,
  etc.) **não foram todas implementadas** — só as 4 novas descritas na
  seção 13, escolhidas como fatia representativa (2 cadastros + 2 ações
  críticas, cobrindo tarefas, estoque em ambas direções, e movimentação de
  pasto).
- `dar_baixa_estoque`/`cadastrar_item_estoque` usam `estoque:editar`/
  `estoque:movimentar` conforme a app já distingue esses dois em
  `perfis.js`, mas a UI atual (`EstoquePage.jsx`) checa `estoque:editar`
  para a própria tela de saída — os dois perfis com `estoque:movimentar`
  (gerente/operador) também têm `estoque:editar`, então não há divergência
  prática hoje, mas é um ponto a observar se a matriz mudar.
- Nenhum limite de uso (seção 27: por usuário/chat/conta, fila para
  concorrência) foi implementado — o rate limit existente
  (`telegramRateLimit.js`) se aplica antes de a mensagem chegar ao bot
  determinístico ou à IA, mas não há um limite adicional específico de
  chamadas à Claude API.
- `output_config.effort: 'low'` foi escolhido como padrão (configurável via
  `TELEGRAM_IA_EFFORT`) para controlar custo/latência numa tarefa de
  classificação+extração — não testado contra o modelo real para confirmar
  se é suficiente para a qualidade desejada.
- Sem teste de carga/concorrência (fila para operações concorrentes, seção
  27).

## 17. Próximos recursos sugeridos

- Completar as demais escritas do spec original (venda, morte/perda,
  finalização de lote, sanidade completa, suplementação) seguindo o mesmo
  padrão do catálogo.
- Extrair a fórmula da RPC `mover_lote_para_pasto` para uma function()
  `SECURITY DEFINER` que valide `owner_user_id` explicitamente, permitindo
  chamar a RPC real em vez de espelhar a validação.
- Expor `TELEGRAM_IA_MODEL`/`TELEGRAM_IA_EFFORT` numa tela de configuração
  (hoje só variável de ambiente).
- Rate limit dedicado por conta para chamadas à Claude API, com mensagem
  clara ao usuário quando atingido.
