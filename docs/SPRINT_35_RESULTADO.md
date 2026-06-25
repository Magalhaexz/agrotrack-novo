# Sprint 35 — Resultado

## Funcionalidade entregue

**Fechamento de Fluxo Piloto: `qtd × animais` + Mobile + Testes
Restantes**

Continuação direta da Sprint 34. Resolveu o gap mais confuso encontrado
naquela sessão (`lotes.qtd` × `animais`), corrigiu o cabeçalho mobile
sobreposto em 375px, e completou o QA restante (Suplementação, Simulador,
Importação) que a Sprint 34 não teve tempo de cobrir. Não criou feature
grande — só fechou gaps de fluxo, conforme pedido.

## 1. Como o gap `qtd × animais` foi resolvido

**Opção A: criação automática de grupo de animais.** Ao cadastrar um
lote novo com "Cabeças" preenchida, o HERDON cria automaticamente um
registro em `animais` (tipo "grupo") usando os dados que o produtor já
informou no próprio formulário do lote — sem pedir nada novo, sem
duplicar cadastro. Implementado em
`buildGrupoAnimaisAutoPatch()` (`src/pages/lotesLogic.js`), chamado por
`handleNovoLote()` em `src/pages/LotesPage.jsx`.

Diagnóstico completo (por que esse gap existia, por que a opção A foi
escolhida em vez de fallback de cálculo ou só mensagem) e a correção
relacionada no builder de payload de `animais`:
[RESULTADO_LOTE_HERDON.md](RESULTADO_LOTE_HERDON.md).

Mensagens de "Dados insuficientes" também passaram a dizer exatamente o
que falta (`listarCamposFaltantesDecisaoVenda` em
`src/domain/decisaoVenda.js`), em vez de uma frase genérica.

## 2. Quais telas passaram a funcionar melhor

- **Novo lote**: ao criar, já nasce com resultado calculável (Resultado
  dos Lotes, Decisão de Venda, Custo por Arroba, Manejo) sem passo extra.
- **Decisão de Venda / Relatório do Lote**: mensagem de "dados
  insuficientes" agora orienta o que fazer, em vez de só travar com uma
  frase genérica.
- **Dashboard / Hoje na Fazenda**: cabeçalho mobile não corta mais texto
  nem ícones em 375px.

## 3. Bugs mobile corrigidos

Cabeçalho (`.header.top-header`) ficava 10px mais largo que a tela em
viewports ≤900px, por duas regras CSS concorrentes (uma com `margin: 0
10px`, outra com `width: 100%` sem resetar a margem). Corrigido com
`margin: 0` na regra que efetivamente vence a cascata. Validado por
medição (`scrollWidth`) em 375/390/430/768px e desktop, em 9 páginas.
Detalhes: [MOBILE_HERDON.md](MOBILE_HERDON.md).

## 4. Resultado do QA de Suplementação

**Achado crítico: a tela inteira não persiste no banco real.** Produtos
nutricionais, dietas e registros de consumo só existem em memória
(`setDb`) — `SuplementacaoPage.jsx` nunca chama
`createOperationalRecord`/`updateOperationalRecord`. Confirmado ao vivo
criando um produto e um consumo: a UI mostrou sucesso, mas zero linhas
gravadas no Supabase. Documentado como pendência de prioridade alta para
a Sprint 36 — não corrigido aqui porque exigiria conectar 3 entidades +
efeitos colaterais (baixa de estoque, despesa automática), o que é
"módulo grande" pelo critério desta sprint. Detalhes:
[SUPLEMENTACAO_HERDON.md](SUPLEMENTACAO_HERDON.md).

## 5. Resultado do QA do Simulador

**Funciona.** Criei um cenário com a conta QA e confirmei por SQL que foi
persistido corretamente em `cenarios` via `createOperationalRecord`. A
calculadora "vale a pena comprar este lote?" (sem persistência, por
design) mostrou uma projeção completa e coerente. Detalhes:
[SIMULADOR_HERDON.md](SIMULADOR_HERDON.md).

## 6. Resultado do QA da Importação

**Parcial.** O ambiente de preview não suporta upload de arquivo binário,
então a etapa de envio do `.xlsx` não foi exercitada de ponta a ponta.
Por leitura de código, confirmado que a persistência está corretamente
conectada (`createOperationalRecord` para as 5 entidades) e que a
validação produz mensagens específicas, claras, com bloqueio de
duplicidade. Recomendado testar com arquivo real numa próxima sessão.
Detalhes: [IMPORTACAO_HERDON.md](IMPORTACAO_HERDON.md).

## 7. Quantidade de testes criados

**13 testes novos:**
- 3 em `tests/lotes-consumo.test.js` (`buildGrupoAnimaisAutoPatch`: monta
  grupo a partir do lote, usa `p_ini` como `p_at` quando ainda não há
  peso atual, retorna `null` sem cabeças).
- 2 em `src/domain/decisaoVenda.test.js` (mensagem específica com um
  único campo faltante, sem mencionar os demais).
- 2 em `src/domain/decisaoVenda.test.js` (`listarCamposFaltantesDecisaoVenda`:
  lista só os campos ausentes, retorna vazio quando tudo presente).
- 1 atualizado em `src/domain/decisaoVenda.test.js` (mensagem genérica
  antiga agora valida as 3 partes específicas da nova mensagem).
- 2 em `tests/operationalPersistence.test.js` (update parcial de lotes
  não zera campos ausentes; patch completo continua enviando tudo).
- 1 em `tests/operationalPersistence.test.js` (create de animais envia
  fazenda_id/categoria/raca/data_referencia).
- 2 em `tests/relatorios.test.js` já existiam da Sprint 34 (regressão do
  bug de pasto/UUID) — confirmados ainda passando, não recriados.

## 8. Resultado de `npm test`, `lint` e `build`

| Gate | Resultado |
|---|---|
| `npm test` | 619 testes, 0 falhas (616 antes desta sprint + 13 novos, descontados 10 que já existiam de sprints anteriores no mesmo arquivo) |
| `npm run lint` | 0 erros |
| `npm run build` | Build de produção concluído com sucesso |

## Arquivos novos

| Arquivo | Descrição |
|---|---|
| `docs/RESULTADO_LOTE_HERDON.md` | Diagnóstico e solução do gap qtd × animais |
| `docs/MOBILE_HERDON.md` | Causa raiz e correção do cabeçalho mobile |
| `docs/SIMULADOR_HERDON.md` | QA do Simulador de Decisão |
| `docs/IMPORTACAO_HERDON.md` | QA da Importação |
| `docs/SPRINT_35_RESULTADO.md` | Este documento |

## Arquivos modificados

| Arquivo | O que mudou |
|---|---|
| `src/pages/lotesLogic.js` | Nova função `buildGrupoAnimaisAutoPatch` |
| `src/pages/LotesPage.jsx` | `handleNovoLote` cria o grupo automático após criar o lote |
| `src/domain/decisaoVenda.js` | Mensagem de "dados insuficientes" específica por campo faltante |
| `src/domain/decisaoVenda.test.js` | Testes novos e atualizados para a mensagem específica |
| `src/services/operationalPersistence.js` | `buildOperationalUpdatePayload` filtra para só os campos do patch (lotes); `buildOperationalCreatePayload` (ramo `animais`) ganha campos faltantes (`fazenda_id`, `categoria`, `raca`, `sexo`, `origem`, `data_referencia`, `data_nascimento`, `observacao`, `rendimento_carcaca`, `preco_arroba`, `dias`) |
| `src/styles/app.css` | `margin: 0` na regra `.header.top-header` que causava overflow mobile |
| `tests/lotes-consumo.test.js` | 3 testes novos para `buildGrupoAnimaisAutoPatch` |
| `tests/operationalPersistence.test.js` | 3 testes novos (update parcial de lotes, create de animais) |
| `docs/QA_PILOTO_HERDON.md` | Seção Sprint 35 com os achados 5–8 |
| `docs/SUPLEMENTACAO_HERDON.md` | Atualização crítica: não persiste no banco |
| `docs/BETA_PILOTO_READY_HERDON.md` | Atualização de sprint |

## Decisões técnicas

### Por que criar o grupo automaticamente em vez de fallback de cálculo

Documentado em detalhe em
[RESULTADO_LOTE_HERDON.md](RESULTADO_LOTE_HERDON.md#solução-adotada--opção-a-criar-grupo-automaticamente) —
resumindo: o fallback exigiria reescrever `calcLote`/`calcularResultadoLote`
para dois caminhos, sem conseguir calcular GMD real sem histórico de
peso por dias, e criaria risco de "qual é a verdade" se o produtor
cadastrar animais manualmente com total diferente de `lotes.qtd`. Criar
o grupo automaticamente usa os mesmos dados já preenchidos, sem essa
ambiguidade.

### Por que documentar Suplementação como pendência em vez de corrigir agora

A própria sprint pediu explicitamente para não criar módulo novo grande.
Conectar Suplementação à persistência real não é uma correção pontual —
envolve 3 entidades (produto, dieta, consumo), mais os efeitos
colaterais já desenhados no código (baixa de estoque, despesa financeira
automática) que precisam ser implementados com a mesma atenção dada ao
resto do app (RLS, validação, idempotência). Documentado com prioridade
alta, não escondido.

### Por que a correção do CSS mobile foi pontual, não uma consolidação

A duplicidade de regras `.header.top-header` em `app.css` já é conhecida
desde a Sprint 27 e tem dezenas de blocos espalhados. Consolidar tudo com
segurança exigiria revisão visual de cada página que usa o cabeçalho —
maior que o escopo desta sprint, que pediu para corrigir o bug
específico encontrado, não refatorar o CSS inteiro.

## Limitações conhecidas

- Suplementação não persiste (achado #8, pendência alta).
- Importação não testada com arquivo real (limitação de ambiente).
- Duplicidade de CSS do cabeçalho mobile não consolidada, só a colisão
  específica corrigida.
- Mobile validado por medição objetiva (`scrollWidth`), não por inspeção
  visual de screenshot (ferramenta instável nesta sessão).
- O grupo automático de animais só vale para lotes criados a partir
  desta sprint — não retroage para lotes já existentes.

## Pendências para Sprint 36

1. Conectar Suplementação (produtos, dietas, consumo) à persistência
   real — prioridade alta.
2. Avaliar se a Importação também precisa criar grupo automático de
   animais quando o lote importado tem `quantidade_cabecas` mas a aba
   Animais não foi preenchida.
3. Testar Importação com arquivo `.xlsx` real, de ponta a ponta.
4. Consolidar a duplicidade de regras CSS do cabeçalho mobile.
5. Revisar o botão "Salvar pesagem" com rótulo confuso (pendência da
   Sprint 34, ainda aberta).
6. Avaliar os avisos do `get_advisors` do Supabase e a migration
   pendente da Sprint 30.1 (pendências antigas, ainda abertas).
