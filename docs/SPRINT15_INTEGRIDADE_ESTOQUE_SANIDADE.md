# Sprint 15 — Integridade entre Lote, Animais, Estoque e Sanidade

## Problema encontrado na Sprint 13

`SanitarioForm.jsx` já oferecia um seletor de produto vindo do estoque (`item_estoque_id`) ao registrar um manejo sanitário, mas nenhum código decrementava o saldo do item — a UI sugeria um vínculo que não existia. O estoque exibido divergia silenciosamente da realidade a cada aplicação.

## Auditoria (Etapa 1) — como era antes

1. **Como Sanidade salvava:** `SanitarioPage.jsx`'s `salvarItem` monta um registro por procedimento e chama `createOperationalRecord('sanitario', ...)`/`updateOperationalRecord('sanitario', ...)`. Nunca tocava em `estoque` ou `movimentacoes_estoque`.
2. **Campo de produto/insumo:** sim — `item_estoque_id`, mas guardado dentro de `sanitario.metadata` (jsonb), não como coluna própria.
3. **Campo de quantidade aplicada (do produto):** **não existia.** `sanitario.qtd` é "quantidade atendida" — número de **cabeças** tratadas no manejo, não quantidade de produto consumida. Confirmado no próprio formulário ("Quantidade atendida") e no card-resumo da página ("Animais Atendidos", soma de `qtd`). Este era o gap real: faltava um campo para "quantas unidades do produto foram usadas".
4. **Como Estoque armazena saldo:** `estoque.quantidade_atual` (numérico, coluna oficial) — mas há também um campo legado `estoque.quantidade`, mantido em paralelo por compatibilidade (ambos atualizados juntos em `EstoquePage.jsx`, mesmo padrão seguido aqui).
5. **Tabela de movimentação de estoque:** sim, `movimentacoes_estoque` já existe, com colunas genéricas de origem **já prontas para reaproveitar**: `origem` (text), `origem_tipo` (text), `origem_id` (bigint) — mesmo padrão já usado por `movimentacoes_animais`/`movimentacoes_financeiras` para registrar de onde veio um lançamento.
6. **Histórico de entrada/saída:** sim, `EstoquePage.jsx` já lê `movimentacoes_estoque` para montar o histórico por item.
7. **O produto do formulário de Sanidade vem do Estoque real:** sim, `SanitarioForm.jsx` recebe `estoque={db?.estoque}` e filtra por palavras-chave sanitárias (vacina, vermífugo etc.), com fallback para mostrar todos os itens se nada casar.
8. **Risco de baixa duplicada ao editar:** sim, era um risco real de design — se a integração fosse feita ingenuamente (baixar de novo a cada salvamento), editar o mesmo registro repetidamente duplicaria a baixa. Resolvido calculando sempre a **diferença** entre a quantidade anterior (guardada no próprio registro) e a nova.
9. **Criação de lote e tabela `animais`:** `LotesPage.jsx` chama `buildGrupoAnimaisAutoPatch` (lotesLogic.js) ao criar/editar um lote com cabeças preenchidas, criando um registro sintético em `animais` — sem ele, Resultado/Decisão de Venda/Manejo (que leem `animais`, não `lotes.qtd`) mostram "dados insuficientes". **Confirmado**: se `createOperationalRecord('animais', ...)` falhasse, o código anterior não fazia **nada** — nem toast, nem log — e ainda assim mostrava "Lote criado com sucesso!".
10. **Menor correção segura:** (a) guardar `quantidade_utilizada` dentro de `sanitario.metadata` (mesmo padrão de `item_estoque_id`, sem migration); (b) reaproveitar `movimentacoes_estoque.origem_tipo/origem_id` (já existem, sem migration); (c) tornar visível a falha do auto-patch lote↔animais com um toast, sem reescrever o modelo.

## Etapa 2 — Decisão técnica

**Reaproveitar `movimentacoes_estoque`**, como já era a preferência da sprint. Cada baixa/devolução sanitária vira um registro com `origem: 'sanidade'`, `origem_tipo: 'sanitario'`, `origem_id: <id do registro sanitário>` — a mesma convenção genérica já usada para vincular movimentações de animais e financeiras à sua origem. **Nenhuma migration foi necessária**: nem para `movimentacoes_estoque` (colunas de origem já existiam) nem para `sanitario` (a nova `quantidade_utilizada` foi guardada em `metadata`, ao lado do já existente `item_estoque_id`, mesmo padrão, sem coluna nova).

Modelo de edição: **diferença**, não baixa cega. Cada registro sanitário guarda em `metadata.quantidade_utilizada` a última quantidade de produto que gerou movimentação de estoque; ao editar, comparamos a quantidade nova com essa quantidade anterior e movimentamos só o delta.

## Como ficou o fluxo (Etapa 3-6)

### Domínio puro — `src/domain/estoqueSanidade.js`

- `obterSaldoAtualItemEstoque(item)` — resolve o saldo aceitando as variações de nome de campo já usadas no projeto.
- `calcularBaixaSanitaria({ quantidadeAplicada, quantidadeAnterior, saldoAtual })` — calcula o delta (`quantidadeBaixar`, positivo=consumir/negativo=devolver), se pode aplicar (`podeBaixar`) e o motivo de bloqueio, se houver.
- `validarBaixaEstoqueSanidade({ produtoId, quantidadeAplicada, quantidadeAnterior, saldoAtual })` — gate de mais alto nível: sem produto ou sem alteração de quantidade, `deveBaixar: false`; caso contrário delega para `calcularBaixaSanitaria`.
- `montarMovimentacaoEstoqueSanidade({...})` — monta o objeto pronto para `createOperationalRecord('movimentacoes_estoque', ...)`, com `tipo` derivado do sinal da quantidade (`consumo` para baixa, `ajuste` para devolução — ambos já aceitos pelo projeto).
- `aplicarBaixaAoSaldo(saldoAtual, quantidadeBaixar)` — novo saldo, nunca negativo/NaN.

### Serviço (I/O) — `src/services/estoqueSanidade.js`

- `sincronizarEstoqueSanidade(db, session, {...})` — orquestra os três casos da Etapa 5: mesmo produto (baixa só a diferença), produto trocado (reverte 100% do antigo + baixa 100% do novo) e produto removido (só reverte). Nunca lança erro — devolve `avisos` (para toast) e `estoquePatches`/`movimentacoes` já persistidos (para o chamador mesclar no estado local).
- `reverterEstoqueSanidadeExcluido(db, session, {...})` — devolve 100% da quantidade ao excluir um registro sanitário.

### Integração — `src/pages/SanitarioPage.jsx`

- **Criação:** depois que cada procedimento é salvo com sucesso (já temos o `id` real), se tiver produto + quantidade utilizada, chama `sincronizarEstoqueSanidade` com `quantidadeAnterior: 0`. Mantém uma cópia local do estoque atualizada a cada iteração, para não duplicar/perder baixa quando dois procedimentos do mesmo manejo usam o mesmo produto.
- **Edição:** lê produto/quantidade anteriores de `itemEditando.metadata`, compara com os novos valores do formulário, e deixa `sincronizarEstoqueSanidade` decidir se é diferença simples, troca de produto ou remoção.
- **Exclusão:** se o registro excluído tinha produto + quantidade, devolve 100% via `reverterEstoqueSanidadeExcluido`.
- Em todos os casos, avisos (ex.: saldo insuficiente) aparecem como toast — **o registro sanitário nunca deixa de ser salvo/editado/excluído por causa de um problema no estoque.**

### UI — `src/components/SanitarioForm.jsx`

Novo campo **"Quantidade utilizada"** por procedimento, visível só quando um produto está selecionado, com aviso inline:
- **"Ao salvar, esta quantidade será baixada do estoque."** — quando o saldo é suficiente (checagem local, informativa; a validação real acontece no domínio ao salvar).
- **"Estoque insuficiente para esta aplicação."** — quando a quantidade informada já excede o saldo do produto selecionado.

Nenhuma tela foi redesenhada — só um campo novo e dois textos de aviso.

## Regras contra baixa duplicada

A baixa nunca é "cega" (não existe um "decrementa X sempre que salvar"). Toda operação passa pelo delta entre `quantidade_utilizada` anterior (guardada no próprio registro) e a nova:
- salvar duas vezes sem mudar a quantidade → delta = 0 → nenhuma movimentação.
- aumentar de 2 para 3 → delta = +1 → baixa só 1 unidade adicional.
- reduzir de 3 para 2 → delta = -1 → devolve 1 unidade.
- trocar o produto → reverte 100% do produto antigo, baixa 100% do novo (dois produtos diferentes, cada um com seu próprio delta implícito de "tudo").

## Comportamento com saldo insuficiente

A tentativa de consumir mais do que o saldo disponível **nunca é aplicada silenciosamente e nunca deixa o saldo negativo** — `calcularBaixaSanitaria` recusa (`podeBaixar: false`) e a integração devolve um aviso claro ("Estoque insuficiente para esta aplicação... o manejo foi salvo, mas o estoque não foi baixado"). O registro sanitário **continua sendo salvo** — o animal foi tratado independentemente da contabilidade do estoque; bloquear o registro do manejo por causa disso seria pior do que uma divergência de saldo a ser corrigida manualmente depois. Devoluções (quantidade reduzida numa edição) **nunca são bloqueadas** — estão sempre aumentando o saldo, não consumindo.

## Lote ↔ Animais (Etapa 7)

Não foi feita uma reescrita do modelo (fora de escopo desta sprint). A correção mínima e segura: as duas chamadas a `createOperationalRecord('animais', ...)`/`updateOperationalRecord('animais', ...)` em `src/pages/LotesPage.jsx` (criação e edição de lote) que antes **não faziam nada** quando a persistência do grupo sintético falhava agora disparam um `showToast({ type: 'warning', ... })` explicando que o lote foi salvo mas a sincronização do grupo de animais falhou, e que Resultado/Decisão de Venda/Manejo vão mostrar números desatualizados até uma nova tentativa. O lote continua sendo criado/editado normalmente — só a falha de vínculo deixou de ser silenciosa. Uma correção mais completa (ex.: retry automático, ou um estado de "lote com vínculo pendente" na própria tela de Lotes) fica para um sprint dedicado a esse fluxo, se necessário.

## Impacto nos alertas (Etapa 8)

Nenhum alerta novo foi criado. `alertasInteligentes.js`'s `detectarEstoqueBaixo()` já lê `estoque.quantidade_atual`/`movimentacoes_estoque` diretamente do `db` — como a integração grava exatamente nesses mesmos campos (mesmo padrão de `EstoquePage.jsx`), uma baixa sanitária que leve o saldo abaixo do mínimo passa a refletir no alerta de estoque baixo automaticamente, sem nenhuma mudança na Central de Alertas ou no Telegram.

## Migrations

**Nenhuma migration foi criada.** Auditado via Supabase MCP (schema real) antes de decidir: `movimentacoes_estoque` já tem `origem`/`origem_tipo`/`origem_id`; `sanitario` já guarda `item_estoque_id` em `metadata` (jsonb) sem coluna própria, e `quantidade_utilizada` seguiu o mesmo padrão. Regra da sprint ("não criar migration se os campos já existirem") respeitada.

## Testes executados

- `src/domain/estoqueSanidade.test.js` (novo, 21 casos): aplicação nova com/sem produto, com/sem quantidade, saldo insuficiente, saldo zero, edição aumentando/reduzindo/sem alterar quantidade, valores nulos/inválidos nunca geram NaN/Infinity, objeto de movimentação com origem/tipo corretos.
- `alertasUnificados.test.js`, `centralAlertas.test.js`, `alertasInteligentes.test.js`, `agendaSanitaria.test.js` — rodados isoladamente (84 testes, todos passando) para confirmar que nada relacionado a alertas quebrou.
- Suíte completa: **901/901** (880 da Sprint 14 + 21 novos).

## Validação visual (Etapa 12)

Sem credencial de teste disponível nesta sessão (mesma limitação das sprints 13/14) — login verificado sem erro de console/rede após o build; Sanidade, Estoque e Lotes não puderam ser exercitados ao vivo no navegador. A garantia desta sprint vem dos 21 testes novos do domínio + build/lint limpos, não de inspeção visual.

## Limitações restantes

- A edição de um manejo **composto** (vários procedimentos agrupados por `grupo_manejo_id`) continua editando só o registro individual clicado — a integração de estoque segue esse mesmo escopo (por registro, não por grupo), consistente com o comportamento de edição já existente antes desta sprint.
- Não foi criado retry automático nem um indicador visual persistente para o auto-patch lote↔animais falho — só o aviso pontual no momento da falha (Etapa 7, correção mínima documentada).
- `EstoquePage.jsx`'s `SaidaModal` continua com sua própria implementação de saída (não foi refatorada para reusar `services/estoqueSanidade.js`) — fora de escopo desta sprint ("não reescrever o módulo inteiro"); a duplicação já apontada na Sprint 13 entre `SaidaModal` e `services/movimentacoes.js` segue como dívida registrada no Backlog Mestre, não piorada nem resolvida aqui.
