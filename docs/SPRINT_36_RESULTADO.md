# Sprint 36 — Resultado

## Funcionalidade entregue

**Persistência Real de Suplementação.** Escopo reduzido em relação ao
pedido inicial: só a correção da persistência (produto nutricional +
consumo de suplementação) e a documentação técnica correspondente. QA
geral do app (segurança e funcionalidade ponta a ponta) foi
explicitamente deixado para uma sprint separada, por pedido direto.

## 1. Causa raiz

Duas causas, ambas corrigidas:

1. **`SuplementacaoPage.jsx` nunca recebia/usava `session` nem
   `fazendaSelecionada`.** Todas as páginas do app já recebem essas duas
   props via `ActivePage` em `src/App.jsx` — mas a página de
   Suplementação simplesmente não as declarava na assinatura, então os 3
   modais (produto, dieta, consumo) só tinham acesso a `setDb`. Sem
   `session`, não há como chamar `createOperationalRecord`/
   `updateOperationalRecord` (eles exigem a sessão autenticada).
2. **Os builders de payload em `operationalPersistence.js` não
   suportavam essas tabelas corretamente.** O branch de `estoque`
   (`buildOperationalCreatePayload`) não mapeava `produto` (coluna
   `NOT NULL` na tabela real) nem `quantidade_atual` (também
   `NOT NULL`), `fazenda_id`, `subcategoria`, `unidade_medida`,
   `preco_unitario`, `data_validade`, `obs` — um insert real teria
   falhado por violar `NOT NULL`. A tabela `consumo_suplementacao` não
   tinha branch nenhum — cairia no fallback genérico, que espalharia
   campos inexistentes na tabela real (como `cabeças_lote`, com acento,
   que não existe como coluna) e quebraria o insert.

## 2. Dados que antes eram só locais

- Produto nutricional (criar/editar) — só `setDb`, nunca chegava ao
  Supabase.
- Consumo de suplementação (criar/editar) — idem, incluindo a baixa de
  estoque e a despesa financeira automática associadas.
- Dieta — segue só local (ver seção 5).

## 3. Dados que agora persistem

- **Produto nutricional** → tabela `estoque`, com `produto`, `nome`,
  `categoria`, `subcategoria`, `fazenda_id`, `unidade`/`unidade_medida`,
  `quantidade`/`quantidade_atual`, `valor_unitario`/`custo_unitario`/
  `preco_unitario`, `validade`/`data_validade`, `fornecedor`, `obs`/
  `observacoes`, `metadata`, `owner_user_id`.
- **Consumo de suplementação** → tabela `consumo_suplementacao`, com
  `fazenda_id`, `lote_id`, `item_estoque_id`, `dieta_id`, `origem_tipo`,
  `ref_id`, `produto_nome`, `dieta_nome`, `modo`, `quantidade`/
  `qtd_total`/`quantidade_total`, `consumo_por_cabeca_dia`,
  `percentual_peso_vivo`, `peso_medio_usado`, `unidade`, `custo_total`,
  `data`, `obs`, `metadata` (inclui `cabecas_lote`), `owner_user_id`.
- **Efeitos colaterais do consumo** — baixa real em
  `estoque.quantidade_atual` e criação/atualização de uma despesa em
  `movimentacoes_financeiras` (`categoria: 'nutricao'`), vinculada ao
  registro de consumo via `origem_tipo`/`origem_id` com o ID **real**
  retornado pelo Supabase (não um ID local temporário).

## 4. Tabelas usadas

`estoque` e `consumo_suplementacao` — ambas já existiam no Supabase de
produção (confirmado via `list_tables`/`execute_sql` antes de qualquer
mudança). Nenhuma tabela nova, nenhuma migration.

## 5. Dietas — segue pendente

`dietas` **não existe** como tabela no Supabase real. Criar uma exigiria
modelagem (relação dieta↔produtos, unidade de consumo, vínculo opcional a
lote) e uma migration — fora do escopo desta sprint, que tratou
exclusivamente de persistência do que já tinha tabela real. Em vez de
corrigir, a UI agora deixa isso explícito para o produtor:

- No modal de Dieta: "Dietas ficam salvas apenas neste dispositivo por
  enquanto — não sincronizam com a nuvem nem aparecem em outro
  aparelho."
- No modal de Consumo, quando "Dieta" é selecionada como origem:
  "Dietas ainda são um recurso em preparação. Para o piloto, registre o
  consumo diretamente pelo produto nutricional."

## 6. QA geral — propositalmente fora desta sprint

Por pedido explícito, esta sprint não testou o app tela por tela, nem
fez QA completo de segurança/funcionalidade. A verificação feita foi
**mínima e cirúrgica**: criar 1 produto, confirmar no Supabase, criar 1
consumo, confirmar no Supabase, recarregar a página duas vezes e
confirmar que ambos persistem. Detalhes em
[SUPLEMENTACAO_TESTE_MANUAL.md](SUPLEMENTACAO_TESTE_MANUAL.md). QA geral
fica para a próxima sprint.

## 7. Builders de payload corrigidos

Em `src/services/operationalPersistence.js`:

- **`estoque`** (`buildOperationalCreatePayload`): passou a mapear
  `produto`, `fazenda_id`, `subcategoria`, `unidade_medida` (com
  fallback cruzado para `unidade`), `quantidade_atual` (com fallback
  cruzado para `quantidade`), `preco_unitario`, `data_validade` (com
  fallback cruzado para `validade`), `origem`, `numero_nf`,
  `data_entrada`, `alerta_dias_antes`, `obs` (com fallback cruzado para
  `observacoes`) — usando os helpers `toNullableNumber`/
  `toNullableString`/`toNullableDateString`/`toNullableInteger` já
  existentes desde a Sprint 35, sem inventar normalização nova.
- **`consumo_suplementacao`** (branch novo): mapeia todos os campos
  reais da tabela (`fazenda_id`, `lote_id`, `item_estoque_id`,
  `dieta_id`, `origem_tipo`, `ref_id`, `produto_nome`, `dieta_nome`,
  `modo`, `quantidade`, `qtd_total`, `quantidade_total`,
  `consumo_por_cabeca_dia`, `percentual_peso_vivo`, `peso_medio_usado`,
  `unidade`, `custo_total`, `data`, `obs`, `metadata`). O campo local
  `cabecas_lote` (sem acento na implementação atual; o registro local
  antigo usava `cabeças_lote` com acento, que nunca existiu como coluna)
  é guardado dentro de `metadata`, nunca enviado como coluna solta.
- **Update parcial**: ambos os branches reaproveitam o filtro de
  `buildOperationalUpdatePayload` introduzido na Sprint 35 — um patch com
  só `{ quantidade_atual, quantidade }` não envia/zera `produto`,
  `fazenda_id` etc.

## 8. Modais conectados

- **`ProdutoNutricionalModal`** (`src/pages/SuplementacaoPage.jsx`):
  `salvar()` agora é assíncrono, chama `createOperationalRecord`/
  `updateOperationalRecord('estoque', ...)`, só mostra "Suplementação
  registrada com sucesso." quando `persisted === true`, mostra "Não foi
  possível salvar a suplementação. Verifique os dados e tente
  novamente." em caso de falha real do Supabase, e atualiza `setDb` com
  o registro **retornado** pelo Supabase (não um objeto local otimista).
- **`SuplementacaoConsumoModal.jsx`**: mesma mudança — `salvar()`
  assíncrono, persiste o consumo, a baixa de estoque e a despesa
  financeira em sequência, só mostra sucesso quando o consumo persistiu,
  e usa o ID real retornado para vincular a despesa (`origem_id`).
  Mensagens de validação específicas adicionadas: "Cadastre um produto
  nutricional antes de registrar consumo.", "Cadastre um lote antes de
  registrar consumo de suplemento.", "Preencha produto, lote, data e
  quantidade para registrar o consumo." (substituindo mensagens técnicas
  genéricas de campo único).
- **Limpeza correlata**: a função `ConsumoModal` (duplicada, ~200
  linhas, nunca renderizada — `SuplementacaoPage.jsx` sempre usava o
  componente importado `SuplementacaoConsumoModal`, não essa cópia
  local) e os helpers que só ela usava (`normalizeConsumptionSelection`,
  `buildConsumptionInitialData`, `getConsumptionCost`,
  `applyConsumptionChange`) foram removidos — eram código morto desde
  antes desta sprint, identificado ao mapear o arquivo.

## 9. Testes automatizados

**6 testes novos** em `tests/operationalPersistence.test.js`:

1. `createOperationalRecord` em `estoque` envia `produto`, `fazenda_id`,
   `subcategoria` e `quantidade_atual` corretamente.
2. `createOperationalRecord` em `estoque` não descarta o `id` local —
   guarda em `metadata.local_id`.
3. `updateOperationalRecord` em `estoque` só envia os campos do patch,
   sem zerar o resto.
4. `createOperationalRecord` em `consumo_suplementacao` envia `lote_id`,
   `produto_nome`, `qtd_total` e `custo_total`.
5. `createOperationalRecord` em `consumo_suplementacao` não envia o
   campo inexistente `cabeças_lote` (com acento) como coluna.
6. `updateOperationalRecord` em `consumo_suplementacao` só envia os
   campos do patch, sem zerar o resto.

## 10. Resultado dos gates

| Gate | Resultado |
|---|---|
| `npm test` | 625 testes, 0 falhas (619 antes desta sprint + 6 novos) |
| `npm run lint` | 0 erros |
| `npm run build` | Build de produção concluído com sucesso |

## Arquivos novos

| Arquivo | Descrição |
|---|---|
| `docs/SUPLEMENTACAO_TESTE_MANUAL.md` | Verificação mínima real contra o Supabase de produção |
| `docs/SPRINT_36_RESULTADO.md` | Este documento |

## Arquivos modificados

| Arquivo | O que mudou |
|---|---|
| `src/services/operationalPersistence.js` | Branch `estoque` completado; branch `consumo_suplementacao` criado |
| `src/pages/SuplementacaoPage.jsx` | Recebe `session`/`fazendaSelecionada`; `ProdutoNutricionalModal` persiste em `estoque`; aviso de pendência no modal de Dieta; remoção de `ConsumoModal` morto e seus helpers exclusivos |
| `src/components/SuplementacaoConsumoModal.jsx` | Persiste em `consumo_suplementacao` + baixa de `estoque` + despesa em `movimentacoes_financeiras`; mensagens de validação específicas; aviso de pendência de Dietas |
| `tests/operationalPersistence.test.js` | 6 testes novos de regressão para os builders de `estoque`/`consumo_suplementacao` |
| `docs/SUPLEMENTACAO_HERDON.md` | Atualizado: bug corrigido, o que persiste, o que segue pendente (Dietas) |
| `docs/BETA_PILOTO_READY_HERDON.md` | Atualização de sprint |

## Decisões técnicas

### Por que não criar tabela `dietas`

Modelar Dietas exigiria decidir relação dieta↔produtos (1:N? N:N?),
unidade de consumo por dieta, e se dieta é por lote ou reutilizável entre
lotes — decisões de produto, não só técnicas. Misturar isso com a
correção de persistência (escopo explícito desta sprint) arriscaria
entregar uma modelagem apressada. Documentado como pendência clara, com
aviso na UI em vez de promessa silenciosa.

### Por que a baixa de estoque e a despesa usam o ID real do consumo

Antes (versão só-local), a despesa em `movimentacoes_financeiras` era
vinculada a um `id` gerado localmente (`gerarNovoId`) que nunca existia
no banco. Persistindo o consumo primeiro e usando
`consumoPersist.data.id` (o ID real retornado pelo Supabase) para a
despesa, o vínculo `origem_id` continua correto mesmo depois de reload —
evita o mesmo tipo de inconsistência de "dado que parece linkado mas não
é" encontrado em sprints anteriores.

## Limitações conhecidas

- Dietas seguem sem persistência real (pendência documentada, com aviso
  na UI).
- QA geral (mobile, edição/exclusão, integração visual com Relatório/
  WhatsApp/Decisão/Hoje na Fazenda) propositalmente não foi feito nesta
  sprint — fica para a próxima.
- O produto e o consumo de teste criados durante a verificação ficaram
  na conta QA (mesma prática de sprints anteriores).

## Pendências para a próxima sprint

1. QA geral de segurança e funcionalidade do app (escopo formalmente
   adiado por esta sprint).
2. Decidir e modelar Dietas com tabela real, se for prioridade para o
   piloto.
3. Verificar visualmente a integração do novo dado real de
   Suplementação com Relatório do Lote, WhatsApp, Decisão de Venda e
   Hoje na Fazenda (a leitura já existia desde a Sprint 33, não foi
   re-testada agora).
4. Avaliar se a Importação também deve criar grupo automático de animais
   (pendência já registrada na Sprint 35).
5. Testar Importação com arquivo `.xlsx` real (pendência já registrada
   na Sprint 35).
