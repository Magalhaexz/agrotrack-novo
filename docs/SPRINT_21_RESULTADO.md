# Sprint 21 — Resultado

## Funcionalidade entregue

**Movimentação de Lotes entre Pastos**

Primeira versão operacional da movimentação de lotes entre pastagens, com
histórico auditável. O vínculo `lotes.pastagem_id` (estático desde a Sprint
18) passa a ser atualizado por uma operação transacional, com registro de
quem/quando/por quê em cada troca de pasto.

---

## O que foi construído

### Banco de dados

| Item | Descrição |
|---|---|
| `supabase/migrations/20260619000000_lote_pastagens_historico.sql` | Cria a tabela `lote_pastagens_historico`, índices, trigger de `updated_at`, 8 policies de RLS e a função `mover_lote_para_pasto` |
| Tabela `lote_pastagens_historico` | Log de movimentações: origem, destino, data, quantidade, motivo, observações |
| Função `mover_lote_para_pasto` | RPC transacional (`SECURITY INVOKER`) que valida, grava o histórico e atualiza `lotes.pastagem_id` em uma única operação |

### Arquivos novos

| Arquivo | Descrição |
|---|---|
| `src/services/movimentacaoPastos.js` | Serviço frontend: `moverLoteParaPasto`, `listarHistoricoPastos`, `listarMovimentacoesPorFazenda`, `formatHistoricoMensagem`, `getFriendlyErrorMessage` |
| `src/components/lotes/movimentacaoPastoLogic.js` | Lógica pura de validação/filtro do formulário (motivos sugeridos, filtro de pastos por fazenda, validação client-side) |
| `src/components/lotes/MoverPastoModal.jsx` | Modal de movimentação (pasto atual, destino, data, quantidade, motivo, observações) |
| `src/components/lotes/LotePastagensTab.jsx` | Aba "Pasto" do detalhe do lote: pasto atual + botão de mover + histórico |
| `src/components/lotes/movimentacaoPastoLogic.test.js` | 15 testes do domínio de validação |
| `src/services/movimentacaoPastos.test.js` | 8 testes de formatação de histórico e tradução de erros |
| `docs/MOVIMENTACAO_PASTOS_HERDON.md` | Documentação técnica da funcionalidade |
| `docs/MOVIMENTACAO_PASTOS_TESTE_MANUAL.md` | Roteiro e resultado do teste manual |

### Arquivos modificados

| Arquivo | O que mudou |
|---|---|
| `src/components/lotes/constants.js` | Nova aba `pastagem` (label "Pasto") em `LOTE_TABS` |
| `src/components/lotes/LoteDetailsPanel.jsx` | Renderiza `LotePastagensTab`; novos props `onMoverPasto`, `historicoPastos`, `loadingHistoricoPastos` |
| `src/pages/LotesPage.jsx` | Estado e handler da movimentação (`handleMoverPasto`), carregamento do histórico por lote selecionado, renderização do `MoverPastoModal`; **correção de bug** (ver abaixo) |
| `docs/PASTOS_HERDON.md` | Seção "Pendência futura — Histórico de movimentação" atualizada para refletir a implementação |

Nenhuma alteração em `navConfig.js` — a funcionalidade vive dentro do detalhe
do lote existente, sem página ou item de menu novo.

---

## Decisões técnicas

### RPC com `SECURITY INVOKER`, não `SECURITY DEFINER`

A função roda com os privilégios de quem chama, então as policies de RLS já
existentes em `lotes`/`pastagens`/`lote_pastagens_historico` são a barreira
de isolamento de conta — sem duplicar essa lógica dentro da função. Reduz a
superfície de funções `SECURITY DEFINER` do projeto (que já tinha vários
alertas do linter de segurança do Supabase sobre esse padrão antes desta
sprint) em vez de adicionar mais uma.

### Origem da movimentação não é um parâmetro

O "pasto de origem" é lido de `lotes.pastagem_id` no momento da chamada, não
informado pelo frontend. Evita inconsistência entre o que a tela mostra e o
que o banco tem no instante exato da transação.

### `pastagem_destino_id` obrigatório na aplicação, nullable na coluna

A obrigatoriedade é validada dentro de `mover_lote_para_pasto`. A coluna
continua nullable para que `ON DELETE SET NULL` funcione quando um pasto
referenciado por um registro histórico é excluído — uma coluna `NOT NULL`
quebraria esse comportamento.

### Mesmo pasto permitido com motivo

A sprint pedia impedir mover "para o mesmo pasto sem necessidade, salvo se
for permitido com justificativa". Interpretado como: bloqueado se
`motivo` estiver vazio, permitido se houver motivo — cobre casos reais como
reconfirmar a localização do lote após um manejo veterinário.

### Modelo de log em vez de intervalo entrada/saída

`docs/PASTOS_HERDON.md` já tinha uma proposta de tabela da Sprint 18
(`data_entrada`/`data_saida` por pasto). Esta sprint usa um modelo de log
(uma linha por movimentação, com origem e destino) em vez disso — mais
simples de gravar (não exige "fechar" o registro anterior) e mais direto
para a frase de histórico exigida pela sprint.

---

## Bug corrigido

**`src/pages/LotesPage.jsx` — nome do pasto atual sempre errado**

`pastagensMap` era construído com `Number(item.id)` e consultado com
`Number(lote.pastagem_id)`. Como `pastagens.id` é `uuid` desde a Sprint 18.1,
`Number(uuid)` sempre vira `NaN` — e como `NaN` colapsa em uma única chave de
`Map`, **todo** lote com pasto vinculado exibia o nome do último pasto da
lista, nunca o pasto real. Corrigido trocando para `String(...)`, no mesmo
padrão já usado em `LoteForm.jsx`. Encontrado durante o diagnóstico da Etapa
1 — sem essa correção, a aba "Pasto" exibiria o pasto atual errado, o que
contradiz diretamente o objetivo da sprint.

---

## Gates (Sprint 21)

| Gate | Resultado |
|------|-----------|
| `npm test` | ✓ 408 testes, 0 falhas (23 novos) |
| `npm run lint` | ✓ sem erros |
| `npm run build` | ✓ build completo |

## Teste manual

Executado diretamente contra o banco Supabase real (RPC + RLS), impersonando
a sessão autenticada da conta do projeto — sem credenciais de uma segunda
conta de QA disponíveis neste ambiente. Todos os 11 cenários do roteiro
passaram; dados de teste criados e removidos por completo (zero resíduo).
Detalhes em [MOVIMENTACAO_PASTOS_TESTE_MANUAL.md](MOVIMENTACAO_PASTOS_TESTE_MANUAL.md).

---

## Pendências conhecidas

- Indicador de ocupação por pasto (lotes/cabeças por pasto individual) não
  foi adicionado a `PastagensPage` nesta sprint — `PastagensPage` já calcula
  UA agregada por fazenda desde a Sprint 18, mas não por pasto individual.
- Rotação automática, alerta de superlotação por pasto, tempo médio de
  permanência e integração com mapa da fazenda continuam como pendências
  futuras (já estavam registradas em `docs/PASTOS_HERDON.md`).
- Movimentação offline não é suportada (a função é uma RPC online).
- Verificação visual em navegador não foi realizada nesta sessão (sem
  servidor de preview com sessão autenticada disponível) — recomendada antes
  do próximo deploy.
