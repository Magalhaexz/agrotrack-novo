# Movimentação de Lotes entre Pastos — Módulo HERDON

Sprint 21. Transforma o vínculo estático `lotes.pastagem_id` em uma operação
real de movimentação, com histórico auditável.

## Visão geral do fluxo

```
Lote (pasto atual = Pasto 1)
  └── usuário escolhe Pasto 3 como destino
        └── mover_lote_para_pasto() [RPC, transacional]
              ├── valida lote, destino, fazenda, data, quantidade
              ├── grava 1 linha em lote_pastagens_historico (origem=Pasto 1, destino=Pasto 3)
              └── atualiza lotes.pastagem_id = Pasto 3
  └── pasto atual do lote agora é Pasto 3, histórico preservado
```

## Tabela `lote_pastagens_historico`

| Coluna | Tipo | Notas |
|---|---|---|
| `id` | uuid | PK, `gen_random_uuid()` |
| `owner_user_id` | uuid | FK `auth.users(id)` ON DELETE CASCADE |
| `lote_id` | bigint | FK `lotes(id)` ON DELETE SET NULL |
| `faz_id` | bigint | FK `fazendas(id)` ON DELETE SET NULL — copiado do lote no momento da movimentação |
| `pastagem_origem_id` | uuid | FK `pastagens(id)` ON DELETE SET NULL — nulo se o lote não tinha pasto atual |
| `pastagem_destino_id` | uuid | FK `pastagens(id)` ON DELETE SET NULL — obrigatório a nível de aplicação (ver nota abaixo) |
| `data_movimentacao` | date | NOT NULL |
| `quantidade_cabecas` | numeric | opcional; `CHECK (> 0)` quando preenchida |
| `motivo` | text | texto livre (frontend oferece lista sugerida + "Outro") |
| `observacoes` | text | texto livre |
| `metadata` | jsonb | NOT NULL, default `{}` |
| `created_at` / `updated_at` | timestamptz | `updated_at` mantido por trigger `set_updated_at` |

**Por que `pastagem_destino_id` é nullable mesmo sendo obrigatório no formulário:**
a coluna precisa aceitar `NULL` para que `ON DELETE SET NULL` funcione quando um
pasto referenciado por um registro histórico antigo é excluído. Se a coluna
fosse `NOT NULL`, excluir esse pasto quebraria a integridade (a constraint
impediria o `SET NULL` automático). A obrigatoriedade no momento da
movimentação é garantida pela função `mover_lote_para_pasto`, não pela coluna.

### RLS

8 policies, mesmo padrão de `lotes`/`pastagens`: dono direto
(`owner_user_id = auth.uid()`) ou mesma conta (`app_is_same_account`), para
SELECT/INSERT/UPDATE/DELETE.

## Função `mover_lote_para_pasto`

```sql
mover_lote_para_pasto(
  p_lote_id              bigint,
  p_pastagem_destino_id  uuid,
  p_data_movimentacao    date,
  p_quantidade_cabecas   numeric DEFAULT NULL,
  p_motivo               text    DEFAULT NULL,
  p_observacoes          text    DEFAULT NULL
) RETURNS lote_pastagens_historico
```

Executa em uma única transação: valida, grava o histórico e atualiza
`lotes.pastagem_id`. Se qualquer validação falhar, nada é gravado (não há
estado intermediário possível).

**`SECURITY INVOKER`, não `SECURITY DEFINER`.** A função roda com os
privilégios de quem a chama, então as policies de RLS já existentes em
`lotes`, `pastagens` e `lote_pastagens_historico` são a própria barreira de
isolamento de conta — a função não duplica essa lógica. Quando o `SELECT` de
um lote ou de um pasto de destino não encontra linha, é porque o RLS já
filtrou (não existe, ou não pertence à conta de quem chamou); a função trata
isso como "não encontrado", sem distinguir os dois casos — isso evita que a
mensagem de erro revele se um registro de outra conta existe.

O pasto de origem **não é um parâmetro**: a função lê o `pastagem_id` atual do
lote no momento da chamada. Isso evita que o frontend precise (ou consiga)
informar uma origem inconsistente com o estado real do banco.

### Validações

| Regra | Mensagem |
|---|---|
| Destino não informado | "Selecione o pasto de destino." |
| Data não informada | "Informe a data da movimentação." |
| Quantidade de cabeças ≤ 0 (quando informada) | "A quantidade de cabeças deve ser maior que zero." |
| Lote não existe ou não é da conta do usuário | "Lote não encontrado ou não pertence à sua conta." |
| Lote sem fazenda vinculada | "O lote não está vinculado a uma fazenda." |
| Pasto de destino não existe ou não é da conta do usuário | "Pasto de destino não encontrado ou não pertence à sua conta." |
| Pasto de destino é de outra fazenda | "O pasto de destino pertence a outra fazenda." |
| Pasto atual do lote pertence a outra fazenda (inconsistência defensiva) | "O pasto atual do lote é inconsistente com a fazenda do lote." |
| Destino igual ao pasto atual **sem motivo** | "O destino é igual ao pasto atual. Informe um motivo para confirmar a movimentação." |
| Destino igual ao pasto atual **com motivo** | Permitido (ex.: reconfirmar lote no mesmo pasto após manejo) |

Todas as mensagens são em português e pensadas para exibição direta ao
usuário (ver `getFriendlyErrorMessage` no serviço do frontend).

### Permissões de execução

```sql
REVOKE ALL ON FUNCTION mover_lote_para_pasto(...) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION mover_lote_para_pasto(...) TO authenticated;
```

`anon` não pode nem tentar chamar a função.

## Serviço frontend — `src/services/movimentacaoPastos.js`

| Função | Uso |
|---|---|
| `moverLoteParaPasto(payload)` | chama a RPC; retorna `{ success, data, error }` |
| `listarHistoricoPastos(loteId)` | histórico de um lote, mais recente primeiro, com `pastagem_origem`/`pastagem_destino` embutidos via PostgREST |
| `listarMovimentacoesPorFazenda(fazId)` | histórico de todos os lotes de uma fazenda |
| `formatHistoricoMensagem(item, { loteNome })` | frase amigável (ver Etapa 6) |
| `getFriendlyErrorMessage(error)` | traduz erros de rede/sessão/RLS; repassa direto as mensagens da própria função (já amigáveis) |

Usa a sessão do usuário via `supabase` (`src/lib/supabase.js`). Não usa
`SUPABASE_SERVICE_ROLE_KEY`.

## Interface

**Local:** nova aba **"Pasto"** dentro do detalhe do lote
(`LoteDetailsPanel` → `LotePastagensTab`), entre "Animais" e "Pesagens". Não
foi criada página nova nem item de menu — o menu (`navConfig.js`) não foi
alterado.

**Conteúdo da aba:**
- Card "Pasto atual" com o nome do pasto vinculado e botão **"Mover lote de
  pasto"** (habilitado com a permissão `lotes:editar`, mesma usada para
  "Editar lote").
- Card "Movimentações de Pasto" com o histórico do lote.

**Modal `MoverPastoModal`:** pasto atual (somente leitura), select de pasto de
destino (filtrado pela fazenda do lote — pastos de outras fazendas nunca
aparecem na lista), data, quantidade de cabeças (opcional), motivo (lista
sugerida + "Outro") e observações. Mostra aviso quando o destino selecionado é
igual ao atual. Validação client-side espelha as regras da função (feedback
imediato, sem round-trip) antes de chamar `moverLoteParaPasto`.

Motivos sugeridos: Rotação de pasto, Recuperação do pasto, Manejo
nutricional, Separação de lote, Entrada em confinamento, Saída de
confinamento, Outro.

## Histórico visível

Cada linha do histórico mostra a data, uma frase amigável gerada por
`formatHistoricoMensagem` (ex.: "Em 20/06/2026, o lote Recria Machos 2026 foi
movido do pasto Pasto 1 para o pasto Pasto 3."), quantidade de cabeças (se
informada), motivo e observações. Estado vazio: "Nenhuma movimentação de
pasto registrada para este lote."

## Bug corrigido nesta sprint

`src/pages/LotesPage.jsx` resolvia o nome do pasto atual usando
`pastagensMap.get(Number(lote.pastagem_id))` — mas `pastagens.id` é `uuid`
desde a Sprint 18.1, e `Number(uuid)` sempre retorna `NaN`. Como `NaN` é
tratado como uma única chave igual a si mesma em um `Map`, **todos** os lotes
com pasto vinculado exibiam o nome do último pasto da lista, não o pasto
real. Corrigido trocando as chaves do mapa e da consulta para `String(...)`,
no mesmo padrão já usado em `LoteForm.jsx`. Sem essa correção, a aba "Pasto"
e o cabeçalho do detalhe do lote mostrariam o pasto atual errado.

## Indicadores de ocupação (Etapa 7)

Não alterado nesta sprint. `PastagensPage` já calcula UA por lote e
diagnóstico de capacidade (Sprint 18); cruzar isso com "quantos lotes estão
em cada pasto agora" e "alerta de superlotação por pasto individual" exigiria
agregar `lotes.pastagem_id` por pasto, o que é simples de adicionar mas não
foi feito agora para manter o escopo da sprint restrito à movimentação.
Registrado como pendência futura abaixo.

## Limitações e pendências futuras

- **Indicador de ocupação por pasto** (quantos lotes/cabeças estão em cada
  pasto agora) não foi adicionado a `PastagensPage` nesta sprint.
- **Rotação automática / alerta de superlotação por pasto** não existe.
- **Tempo médio de permanência por pasto** não é calculado.
- **Integração com mapa da fazenda** não existe.
- **Movimentação offline** não é suportada (a função é uma RPC online; não
  há fila local de pendências como a usada para os módulos legados em
  `operationalPersistence.js`).
- **Edição/exclusão de um registro de histórico** não tem interface própria
  (RLS permite via `update_own`/`delete_own`/`*_same_account`, mas não há
  botão na UI — decisão deliberada para a primeira versão, já que alterar o
  histórico depois do fato tende a mascarar erros operacionais reais).
