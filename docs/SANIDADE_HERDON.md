# Sanidade — HERDON (Sprint 33)

Leitura simples de sanidade por lote, criada para alimentar a integração
"manejo ligado ao resultado" — ver
[MANEJO_RESULTADO_HERDON.md](MANEJO_RESULTADO_HERDON.md). Não é um módulo
veterinário: não dá recomendação de medicamento, dose ou protocolo, só
sinaliza recência e tipo da última ocorrência registrada.

## Estrutura existente reaproveitada

A tabela `sanitario` já existia antes desta sprint (Sprint 12b/IATF e
sprints seguintes). Sprint 33 não cria nada novo nela — só lê.

| Campo | Uso na leitura de sanidade |
|---|---|
| `lote_id` | Filtra os registros do lote |
| `data_aplic` | Data realizada — base para "dias desde o último manejo" |
| `tipo` | Tipo do manejo (`vacina`, `vermifugo`, `mortalidade`, etc.) — usado para detectar ocorrências que merecem atenção |
| `proxima` | Próxima data agendada — não usado nesta leitura (já tem seu próprio indicador em `resolveSanitaryStatus`, em `ResultadosPage.jsx`, sobre tarefas vencidas/próximas) |
| `qtd`, `obs`, `desc` | Não usados na classificação — só exibidos onde já apareciam (SanitarioPage, LoteSanitarioTab) |

`owner_user_id` confirma isolamento por conta (RLS já corrigido na Sprint
30.1, sem alteração nesta sprint).

## Função

`analisarSanidadeLote({ registros, dataReferencia })` em
[`src/domain/manejoResultado.js`](../src/domain/manejoResultado.js).

## Classificação (4 categorias)

| Status | Quando aparece | Mensagem |
|---|---|---|
| Sem registro | Lote nunca teve um registro em `sanitario` | "Este lote está sem registro sanitário recente." |
| Em dia | Último manejo há até 60 dias, sem ocorrência crítica recente | "Este lote possui registro sanitário recente." |
| Atenção | Último manejo entre 60 e 120 dias | "Já faz um tempo desde o último manejo sanitário deste lote — vale conferir se está tudo em dia." |
| Revisar manejo | Último manejo há mais de 120 dias, OU há ocorrência de tipo crítico nos últimos 90 dias (`mortalidade`, `doença`/`doenca`, `enfermidade`, `descarte`) | "Há ocorrências sanitárias que merecem acompanhamento." (tipo crítico) ou "Este lote está há muito tempo sem registro sanitário — vale revisar o manejo." (tempo) |

A checagem de tipo crítico tem prioridade sobre a de tempo: um manejo de
ontem do tipo `mortalidade` já entra em "Revisar manejo", mesmo estando
"recente" no sentido de data.

## O que esta leitura NÃO faz

- Não sugere medicamento, dose ou protocolo — linguagem deliberadamente
  neutra, sem alarme.
- Não substitui o indicador de tarefa vencida/próxima já existente
  (`resolveSanitaryStatus` em `ResultadosPage.jsx`), que olha a data
  `proxima` de um registro específico — esta leitura olha o **histórico**
  do lote como um todo.
- Não cria nem altera nenhum registro em `sanitario`.

## Onde aparece

- Card "Manejo, sanidade e suplementação" no Relatório do Lote.
- Linha no resumo WhatsApp do lote.
- Prioridade combinada "N lotes precisam de revisão de manejo ou
  suplementação" em Hoje na Fazenda/Dashboard, quando o status é "Revisar
  manejo".
- Sinal complementar na Decisão de Venda (Sprint 32), sem mudar a
  classificação de venda.

## Limitações e pendências

- Limiares (60/120 dias, lista de tipos críticos) são heurísticas fixas
  desta primeira versão — não configuráveis por usuário ou por sistema de
  produção.
- Não há calendário sanitário, carência ou protocolo por categoria animal
  — fora de escopo desta sprint.
- Modo Curral não ganhou atalho dedicado de "Registrar manejo sanitário"
  — ver justificativa em [MODO_CURRAL_HERDON.md](MODO_CURRAL_HERDON.md).
