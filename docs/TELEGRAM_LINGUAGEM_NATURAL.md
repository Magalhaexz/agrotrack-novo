# Telegram — Linguagem natural e extração de entidades

Como o bot entende frases livres. Tudo determinístico (regex/aliases), **sem IA
externa**. O usuário não precisa decorar comandos.

## Camadas
1. **Interpretador** (`src/domain/telegram/interpretarComandoTelegram.js`):
   classifica a mensagem em uma intenção estruturada `{intencao, parametros,
   requerConfirmacao}`. Reconhece comandos com barra e frases equivalentes.
2. **Catálogo** (`catalogoIntencoes.js`): referência única de todas as intenções,
   tipo (consulta/ação/cadastro/sistema) e exemplos.
3. **Extração de entidades** (`extrairEntidades.js`): converte texto em valores
   tipados. **Reutilizável por qualquer cadastro.**
4. **Conversa em etapas** (`conversas.js` + tabela `telegram_conversas`): quando
   falta um dado, o bot pergunta; a resposta é interpretada no contexto do slot.

## Entidades reconhecidas
| Entidade | Exemplos que viram valor |
|----------|--------------------------|
| Valor | "500 reais", "R$ 1.234,56", "15 mil", "2 mil reais" |
| Peso | "425 kg", "470 quilos", "pesou 390" |
| Quantidade + unidade | "15 animais", "20 sacos", "10 cabeças", "trinta animais" |
| Data | "hoje", "ontem", "amanhã", "10/07", "dia 15", "na sexta" |
| Período | "este mês", "mês passado", "últimos 30 dias", "esta semana" |
| Nome de lote/fazenda | "no lote Engorda 02", "usar fazenda Santa Clara" |

Normalização: acentos, maiúsculas, pontuação, plural, sinônimos ("cabeças"→
animais, "quilos"→kg), números por extenso (até vinte/dezenas + mil).

## Frases equivalentes (exemplos)
- Consulta: "/lotes" ≡ "quais são meus lotes" ≡ "ver lotes" ≡ "meus lotes".
- Estoque: "/estoque" ≡ "como está o estoque" ≡ "o que está acabando" ≡ "quanto tenho de sal".
- Financeiro: "/financeiro" ≡ "contas a vencer" ≡ "quanto gastei este mês" ≡ "qual meu lucro".

## Regra de segurança na interpretação
- Perguntas ("quanto gastei") são **consulta**; imperativos com valor ("gastei
  500 reais") são **cadastro**. Nunca se confunde uma pergunta com uma ação.
- Correspondência frouxa nunca executa mutação: ação só com dados suficientes e
  sempre com `/confirmar`.
- Um "não" solto **dentro de uma conversa** é resposta a um slot opcional
  (ex.: "pertence a algum lote?"), não cancelamento — cancelar exige
  "/cancelar", "cancelar" ou "desistir".
- Nome nunca é identificador final: é resolvido apenas entre registros da
  fazenda autorizada (com desambiguação numerada quando houver empate).
