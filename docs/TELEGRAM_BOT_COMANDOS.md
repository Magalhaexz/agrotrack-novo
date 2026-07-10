# Bot do Telegram — Comandos (Sprint Bot Interativo)

Interface conversacional do HERDON no Telegram. Só responde a usuários **já
vinculados** (código `HERDON-XXXXXX`). Todo comando respeita a fazenda vinculada
à conexão e as permissões do papel do usuário. Nenhuma IA externa — interpretação
100% por regras (`src/domain/telegram/interpretarComandoTelegram.js`).

## Consultas

| Comando | Frases equivalentes | O que mostra | Permissão |
|--------|--------------------|--------------|-----------|
| `/fazendas` | "mostrar fazendas", "quais fazendas eu tenho?", "minhas fazendas" | Suas fazendas, marcando a selecionada | `fazendas:ver` |
| `/lotes` | "listar lotes", "quais são meus lotes?", "ver lotes" | Lotes ativos da fazenda: nº de animais, peso médio, GMD | `lotes:ver` |
| `/lote NOME` | "ver lote Engorda 02", "detalhes do lote X" | Detalhe: animais, peso, GMD, dias, última pesagem | `lotes:ver` |
| `/estoque` | "como está o estoque?", "estoque baixo", "quanto tenho de sal", "/estoque sal" | Itens em atenção + normais (ou 1 item) | `estoque:ver` |
| `/financeiro` | "contas a vencer", "/financeiro vencidas", "/financeiro semana", "/financeiro lote X" | Contas vencidas e a vencer, com totais | `financeiro:ver` |
| `/alertas` | "ver alertas", "tem vacina atrasada?", "o que está pendente?" | Alertas unificados (mesmo motor da Central) | `dashboard:ver` |
| `/manejos` | "mostrar manejos", "manejos da semana" | Manejos atrasados e próximos | `sanitario:ver` |
| `/pesagens` | "qual lote precisa pesar?" | Últimas pesagens + lotes sem pesagem recente | `pesagens:ver` |
| `/resumo` | "resumo da fazenda" | Contadores da fazenda (lotes, animais, contas, estoque, pesagem) | `dashboard:ver` |
| `/ajuda` | "menu", "comandos", "/start" (vinculado) | Menu de comandos | — |

Quando um dado não existe, o bot responde **"não informado"** ou **"dados
insuficientes"** — nunca inventa números.

## Ações (exigem confirmação)

Toda ação mutável cria uma **operação pendente** (expira em 5 min) e só é
executada após `/confirmar`. `/cancelar` descarta.

| Ação | Exemplos aceitos | Permissão |
|------|------------------|-----------|
| Selecionar fazenda | "usar fazenda Boa Vista", "trocar para fazenda Santa Clara" | `fazendas:ver` |
| Transferir animais | "transferir 10 animais do lote Recria 01 para Engorda 02", "mover 15 cabeças de A para B", "passar 8 animais do lote 12 para o lote 15" | `animais:movimentar` |
| Renomear lote | "renomear lote Recria 01 para Recria Norte" | `lotes:editar` |

A **seleção de fazenda** é aplicada imediatamente (não exige `/confirmar`), mas é
registrada em auditoria. Transferência e renomeação exigem `/confirmar`.

### Fluxo de confirmação

```
> transferir 15 animais do lote Recria 01 para Engorda 02
Confirme a transferência:
Origem: Recria 01
Destino: Engorda 02
Quantidade: 15 animais
Responda /confirmar para concluir ou /cancelar para desistir.

> /confirmar
Transferência concluída.
15 animais de Recria 01 para Engorda 02.
Recria 01: 67 animais
Engorda 02: 79 animais
```

Regras: só o mesmo usuário e o mesmo chat que iniciaram podem confirmar; a
execução é idempotente (uma operação já executada não roda de novo); operações
expiradas não executam. A transferência é **recalculada no momento da execução**
sobre os dados atuais (nunca usa uma quantidade velha).

## Multi-fazenda (Parte 18)

- Conexão vinculada a uma fazenda → todos os comandos usam essa fazenda.
- Conta com **mais de uma fazenda** e nenhuma selecionada → consultas escopadas
  pedem a escolha antes de continuar:

```
Você possui mais de uma fazenda. Escolha uma antes de continuar:
1. Santa Clara
2. Boa Vista
Envie: usar fazenda NOME
```

- O bot **nunca** retorna dados de uma fazenda sem acesso. O `db` é sempre
  recortado por `owner_user_id` (conta) e pela fazenda ativa.

## Mensagens ambíguas (Parte 19)

"trocar lote 1 para lote 2" não vira ação destrutiva — o bot pergunta se é
transferência ou renomeação e não altera nada até o usuário decidir.

## Mensagens de erro (Parte 20)

Sem permissão · fazenda não encontrada/sem acesso · lote não encontrado · nome
duplicado/vazio/igual · quantidade inválida · animais insuficientes · operação
expirada · confirmação por outro usuário · operação já executada · sem operação
pendente · falha temporária. Nunca expõe SQL, stack trace ou detalhes internos.

## Auditoria (Parte 16)

Tabela `telegram_bot_auditoria`: usuário, chat, fazenda, comando original,
intenção, ação, dados anteriores/posteriores, sucesso/erro, origem. Registra
troca de fazenda, transferência, renomeação, cancelamento e permissão negada.
Leitura da própria auditoria liberada ao dono da conta (RLS); escrita só pela
service role.

## Limitações

- Sem inline keyboard/botões ainda (respostas em texto; listas longas são
  resumidas com "+N outro(s)").
- Financeiro mostra contas a vencer/vencidas (caixa); não mistura competência.
- Rate limit por chat é em memória (reseta em cold start).

## Cadastros por conversa (interface operacional)

O bot também **cadastra** por linguagem natural, perguntando o que faltar:

| Cadastro | Exemplo | Permissão |
|----------|---------|-----------|
| Pesagem | "registre pesagem de 425 kg no lote Engorda 02" | `pesagens:editar` |
| Despesa | "gastei 500 reais com sal" | `financeiro:editar` |
| Receita | "recebi 15 mil pela venda" | `financeiro:editar` |
| Entrada de estoque | "adicionar 20 sacos de sal no estoque" | `estoque:movimentar` |

Fluxo: coleta → pergunta o que falta → resumo → `/confirmar`. Detalhes,
entidades e frases em [TELEGRAM_LINGUAGEM_NATURAL.md](TELEGRAM_LINGUAGEM_NATURAL.md)
e [TELEGRAM_CADASTROS_E_OPERACOES.md](TELEGRAM_CADASTROS_E_OPERACOES.md).
Cobertura funcional atual em [TELEGRAM_PARIDADE_FUNCIONAL_HERDON.md](TELEGRAM_PARIDADE_FUNCIONAL_HERDON.md).

## Próximos comandos (arquitetura pronta, fora deste sprint — Parte 24)

Registrar pesagem/manejo, marcar conta como paga, entrada/saída de estoque,
cadastrar despesa/receita, relatório PDF, resumo semanal, cenário de venda
("vale a pena vender este lote hoje?"). Todos seguem o mesmo padrão:
intenção estruturada → permissão → operação pendente → `/confirmar` → auditoria.
