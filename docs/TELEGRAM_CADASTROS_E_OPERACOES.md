# Telegram — Cadastros e operações

Cadastros por conversa disponíveis hoje. Todos seguem o mesmo fluxo seguro:

```text
frase natural → extrai o que der → pergunta o que falta (conversa em etapas)
→ valida → resumo → /confirmar → executa no backend → auditoria → resposta
```

A conversa (`telegram_conversas`) só **coleta**. A execução passa por
`telegram_operacoes_pendentes` + `/confirmar` (expira em 5 min; idempotente;
só o mesmo usuário/chat confirma). Permissão é revalidada na execução.

## Cadastros disponíveis

| Cadastro | Permissão | Slots (perguntados se faltarem) |
|----------|-----------|----------------------------------|
| Registrar pesagem | `pesagens:editar` | lote*, peso*, data |
| Cadastrar despesa | `financeiro:editar` | valor*, descrição*, lote, data |
| Cadastrar receita | `financeiro:editar` | valor*, descrição*, lote, data |
| Entrada de estoque | `estoque:movimentar` | item*, quantidade*, data |

`*` obrigatório. Data ausente = hoje. Lote é opcional e perguntado uma vez
("não" pula).

### Exemplos

Mensagem única (todos os dados de uma vez):
```text
> registre pesagem de 425 kg no lote Engorda 02
Confirme a pesagem:
Lote: Engorda 02
Peso médio: 425 kg
Data: 2026-07-10
Responda /confirmar para concluir ou /cancelar para desistir.
```

Conversa em etapas (falta dado):
```text
> cadastrar despesa
Qual o valor da despesa?
> 500 reais
Qual a descrição?
> Compra de sal mineral
Pertence a algum lote? (envie o nome ou "não")
> não
Confirme o lançamento:
Tipo: Despesa
Descrição: Compra de sal mineral
Valor: R$ 500,00
Lote: não vinculado
Data: 2026-07-10
Status: realizado
> /confirmar
Registrado o lançamento.
```

## Ações (sprint anterior, mantidas)
- Selecionar fazenda, transferir animais entre lotes, renomear lote.

## Backend e segurança (Parte 20/21)
- Toda escrita roda no servidor com a service role, sempre filtrando por
  `owner_user_id`; nada depende só do texto da mensagem.
- Regras puras e testáveis (`cadastros.js` monta o "plano de escrita"; o webhook
  aplica). Sem importar serviços acoplados ao navegador.
- Auditoria em `telegram_bot_auditoria` (ação, dados posteriores, sucesso/erro).

## Erros tratados (Parte 20)
Valor/peso/quantidade inválidos, descrição vazia, item/lote não encontrado ou
ambíguo, sem permissão, conversa/operação expirada. Nunca expõe SQL/stack.

## Ainda não disponível (próximas fases)
Cadastro de lote; manejo; saída de estoque; movimentação de animais
(compra/venda/mortalidade); edições (marcar conta paga, reagendar manejo,
ajustar estoque); relatórios PDF/Excel. Ver `TELEGRAM_PARIDADE_FUNCIONAL_HERDON.md`.
