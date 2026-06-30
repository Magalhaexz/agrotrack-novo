# Teste do HERDON como produtor real — Relatório

> Sprint: "Teste completo do HERDON como produtor real"
> Data: 2026-06-29
> Branch: `main` (working tree limpo no início; correções da sprint anterior já commitadas em `8c472b8` e `2dc7311`)

## 1. Método e conta usada

**Importante sobre o método:** o ambiente desta sessão não permite dirigir a UI logada (não há credenciais e a tela de login não deve ser tocada). Portanto o teste foi feito por **auditoria de código de cada fluxo cruzada com o banco Supabase real** (projeto `ljpiszxicmmuefbiixui`): consultas às tabelas, verificação de integridade referencial (órfãos/FK), `owner_user_id`, defaults, RLS e logs do Postgres. Complementado por `lint`, `build` e suíte de testes.

Isso encontra bugs de salvamento, FK, campos que não puxam dados, persistência e cálculo — mas **não** substitui o teste visual/clicável de responsividade e UX, que precisa ser feito por você com uma conta de proprietário real (ver §6).

Conta/dados reais no banco no momento do teste: 18 usuários (todos com profile), 6 fazendas, 9 lotes, 8 animais, 11 pesagens, 2 consumos de suplementação, 1 sanitário, 2 custos, 4 movimentações financeiras, 3 itens de estoque, 1 tarefa, 0 eventos operacionais, 2 cenários.

## 2. Verificação de integridade (ETAPA 18) — OK

| Checagem | Resultado |
|---|---|
| Usuários sem profile | **0** ✅ |
| Lotes com `faz_id` órfão | 0 ✅ |
| Animais com `lote_id` órfão | 0 ✅ |
| Pesagens com `lote_id` órfão | 0 ✅ |
| Consumo suplementação órfão | 0 ✅ |
| Sanitário órfão | 0 ✅ |

As FK violations vistas nos logs do Postgres (sprint anterior) eram **inserts rejeitados** pela constraint — nunca criaram órfãos. A correção da sprint anterior (classificação de erros) parou de mascará-las como "erro de conexão".

## 3. Bugs encontrados

### 🔴 CRÍTICO
Nenhum bug crítico **novo** encontrado nesta auditoria. Os críticos da sprint anterior (falso "erro de conexão" mascarando FK/cast; editar pasto; pesagem não puxar cabeças) já foram corrigidos e validados.

### 🟠 ALTO

**A1 — Calendário Operacional: "Novo evento" salva só localmente e some no reload**
- **Descrição:** o modal `NovoEventoModal` grava o evento apenas no estado local via `setDb` — não chama `createOperationalRecord`. A tabela `eventos_operacionais` tem **0 linhas** e **não é carregada** pelo app (não está na hidratação de `useOperationalData.js`). Resultado: evento criado no calendário desaparece ao recarregar.
- **Gravidade:** Alto (quebra a confiança no calendário; ETAPA 12).
- **Causa provável:** o modal nunca foi ligado à nuvem; a tabela existe mas não é hidratada.
- **Arquivo:** `src/pages/CalendarioOperacionalPage.jsx` (função `NovoEventoModal`, ~linha 410-430).
- **Recomendação:** (1) mapear payload para colunas de `eventos_operacionais` (`titulo`, `tipo`, `data_inicio`, `lote_id`, `funcionario_id`, `status`); (2) persistir via `createOperationalRecord('eventos_operacionais', ...)` checando `persisted`; (3) **adicionar `eventos_operacionais` à hidratação** em `useOperationalData.js`, senão não reaparece no reload. Requer verificar políticas RLS de insert/select da tabela.
- **Status:** **pendente** (correção envolve hidratação + RLS; fora do escopo seguro de correção imediata desta sprint). Tarefas com vencimento já persistem corretamente na página **Tarefas** (ver A-positivo).

**A2 — Cenários: toast de "sucesso" sem checar persistência (perda silenciosa de dados)**
- **Descrição:** `salvarCenario` (criar e editar) e `arquivarCenario` exibem "Cenário criado/atualizado/arquivado" e atualizam o estado local **sem verificar `persisted.persisted`**. Em falha de salvamento, o registro entra com id local (`gerarNovoId`) e o usuário vê "sucesso", mas o dado não está na nuvem → some no reload.
- **Gravidade:** Alto (salvamento/persistência + decisão; ETAPA 15).
- **Causa provável:** ausência da checagem de retorno presente em outras páginas (Estoque, Animais, Lotes etc. checam).
- **Arquivo:** `src/pages/CenariosPage.jsx` linhas ~149-185.
- **Recomendação:** checar `persisted.persisted`, exibir aviso real em falha e usar o id da nuvem.
- **Status:** **CORRIGIDO nesta sprint** (correção segura e isolada — ver §4).

### 🟡 MÉDIO

**M1 — Sanidade não puxa produto/vacina do estoque**
- **Descrição:** `SanitarioForm` usa campo de texto livre `desc`; não há select de produto/vacina vinculado ao estoque (vacina clostridial, vermífugo). ETAPA 11 espera "Selecionar produto/vacina".
- **Arquivo:** `src/components/SanitarioForm.jsx`.
- **Recomendação:** adicionar select/`datalist` opcional de produtos do estoque (mesmo padrão já aplicado em Suplementação/Lote na sprint anterior). Não bloquear o texto livre.
- **Status:** pendente (melhoria).

**M2 — Ações rápidas do Dashboard só navegam (exceto Pesagem)**
- **Descrição:** apenas `PesagensPage` consome `navigationIntent` para abrir o formulário automaticamente. "Novo lote/custo/tarefa/manejo/estoque" navegam para a página certa, mas **não abrem o modal de novo registro**.
- **Arquivos:** `LotesPage.jsx`, `CustosPage.jsx`, `TarefasPage.jsx`, `SanitarioPage.jsx`, `EstoquePage.jsx` (nenhuma lê `navigationIntent`).
- **Recomendação:** ler `navigationIntent.action === 'novo'` em cada página para abrir o form. Baixo risco, mas toca 5 páginas — fazer com teste individual.
- **Status:** pendente.

**M3 — Tabelas duplicadas no schema**
- **Descrição:** existem `custos` **e** `movimentacoes_financeiras` (CustosPage grava nas duas — custo + lançamento no razão), e `consumo_suplementacao` **e** `suplementacao`. O app usa `consumo_suplementacao`; `suplementacao` aparece sem uso nos fluxos atuais.
- **Recomendação:** confirmar a tabela canônica e descontinuar/limpar a não usada para evitar inconsistência futura. **Investigar antes de mexer** (não alterar agora).
- **Status:** precisa investigar.

### 🔵 BAIXO

**B1 — `custos.fazenda_id` nunca é preenchido** — `CustoForm` não envia `fazenda_id`; filtro de custo por fazenda pode ficar incompleto. Arquivo: `src/components/CustoForm.jsx`. Status: pendente (polimento).

**B2 — Responsividade não testada automaticamente** — ver §6.

## 4. Correção aplicada nesta sprint (controlada, ETAPA 20)

Seguindo a regra "corrigir apenas críticos/altos seguros", apliquei **somente a A2 (Cenários)**, por ser isolada e de baixo risco. A A1 (calendário) ficou documentada por exigir mudança de hidratação + RLS.

- **A2 corrigido** em `src/pages/CenariosPage.jsx`: `salvarCenario`/`arquivarCenario` agora checam `persisted.persisted`, avisam o motivo real em falha e usam o id retornado pela nuvem.

## 5. Fluxos auditados — status por módulo

| Módulo | Persiste na nuvem? | Checa retorno? | Observação |
|---|---|---|---|
| Autenticação/Profile | ✅ | — | 18/18 com profile; trigger `handle_new_user_profile` |
| Fazendas | ✅ | ✅ | dedup na hidratação |
| Pastos | ✅ | ✅ | edição corrigida (sprint anterior) |
| Lotes | ✅ | ✅ | "Trocar lote", GMD, produto via datalist OK |
| Animais | ✅ | ✅ | — |
| Pesagens | ✅ | ✅ | puxa cabeças + balão verde (sprint anterior) |
| GMD/alertas | ✅ | — | alerta no card do lote OK |
| Estoque | ✅ | ✅ | — |
| Suplementação | ✅ | ✅ | puxa produto do estoque (sprint anterior) |
| Financeiro/Custos | ✅ | ✅ | grava em `custos` + `movimentacoes_financeiras` |
| Sanidade | ✅ | ✅ | **sem select de produto (M1)** |
| Tarefas | ✅ | ✅ | persiste em `tarefas` |
| Calendário (evento) | ❌ | ❌ | **A1 — local-only** |
| Cenários | ✅ | ❌→✅ | **A2 corrigido** |

## 6. O que falta validar com conta real (não testável aqui)

Rodar com proprietário real em preview/produção, em 1920×1080, 1366×768 e 390×844:
- Responsividade de menus, modais, tabelas, FAB, formulários (ETAPA 16).
- Fluxo completo cadastro→reload→relogin para confirmar persistência visual (ETAPA 17).
- Conferir que os toasts de erro agora mostram a **causa real** (FK, permissão, campo obrigatório) e não "erro de conexão" — e o console mostra `[HERDON_SAVE_ERROR]`.

## 7. Resultado de qualidade

- **Lint:** limpo.
- **Build:** sucesso.
- **Testes:** 633/633 passando (antes da correção A2; revalidar após — ver §8).

## 8. Conclusão — pronto para piloto?

**Quase.** O núcleo operacional (fazenda, pasto, lote, animal, pesagem, GMD, estoque, suplementação, financeiro, sanidade, tarefas) **persiste corretamente na nuvem, sem órfãos e com mensagens de erro reais**. Recomendação para liberar piloto com tranquilidade:
1. ✅ A2 (Cenários) — corrigido.
2. ⚠️ A1 (Calendário) — decidir: persistir `eventos_operacionais` (hidratação+RLS) **ou** comunicar ao produtor que o calendário hoje agrega eventos de sanidade/pesagem/tarefas e usar a página **Tarefas** para compromissos persistentes.
3. ⚙️ M1/M2 — melhorias de usabilidade desejáveis, não bloqueantes.

Sem A1 resolvido ou comunicado, há risco de o produtor cadastrar um evento no calendário e ele sumir — o que mina a confiança. Os demais fluxos estão prontos para uso de campo.

---

# A1 + A2 — Implementação (sprint "Calendário persistente e Cenários confiáveis")

## A1 — Calendário Operacional agora persiste no Supabase

**Problema:** evento criado no calendário ficava só no estado local e sumia no reload. Causa real: o modal gravava apenas via `setDb` (sem `createOperationalRecord`) **e** a tabela `eventos_operacionais` não era carregada na hidratação — então mesmo persistindo não reapareceria.

**Tabela usada:** `public.eventos_operacionais`.
**Campos usados:** `owner_user_id` (injetado pela sessão), `titulo` (NOT NULL), `tipo`, `descricao`, `data_inicio` (date), `data_fim`, `status`, `lote_id` (bigint FK→lotes), `fazenda_id` (bigint FK→fazendas), `funcionario_id` (bigint FK→funcionarios), `origem`, `metadata` (jsonb, guarda `recorrencia` e `alerta_antes`).

**RLS:** **não alterada.** A tabela já tinha as 4 policies por dono (`owner_user_id = auth.uid()`): SELECT/INSERT/UPDATE/DELETE. **Migration:** nenhuma.

**Mudanças:**
- `src/data/operationalTemplate.js` — `eventos_operacionais` adicionado a `createEmptyOperationalDb`, `OPERATIONAL_ARRAY_COLLECTIONS` e `OPERATIONAL_COLLECTIONS_WITH_IDS`.
- `src/hooks/useOperationalData.js` — `eventos_operacionais` adicionado às tabelas hidratadas (carrega filtrado por `owner_user_id`) e às tabelas estratégicas opcionais (não quebra o boot se faltar).
- `src/services/operationalPersistence.js` — novo builder de payload `eventos_operacionais`: mapeia `data`→`data_inicio`, `funcionario_responsavel_id`→`funcionario_id`, e converte string vazia de colunas bigint em `null` (evita 22P02). Não envia `id`.
- `src/pages/CalendarioOperacionalPage.jsx` — CRUD real: criar/editar/excluir via `createOperationalRecord`/`updateOperationalRecord`/`deleteOperationalRecord` com `session`; só mostra sucesso se `persisted.persisted`; botões Editar/Excluir nos eventos operacionais; modal reaproveitado para edição; `normalizeOperationalEvent` lê `data_inicio`/`funcionario_id`. Erros logados com `console.error('[HERDON_CALENDAR_SAVE_ERROR]', { action, error, payload })` e mensagens claras (campo obrigatório / permissão / erro inesperado) — sem "erro de conexão".

**Validação de persistência (round-trip real no banco):** executado INSERT→SELECT→UPDATE→DELETE com o payload exato do app para um proprietário real — todos OK, sem erro de schema/tipo/FK; limpeza confirmada (0 linhas de teste). Prova que o evento persiste e reaparece após reload (a hidratação agora carrega a tabela).

## A2 — Cenários sem falso sucesso

**Problema:** toasts de sucesso apareciam mesmo sem persistência real (perda silenciosa no reload).
**Correção:** `salvarCenario` (criar/editar) e `arquivarCenario` agora checam `persisted.persisted`, preservam o formulário em falha, usam o `id` real da nuvem e logam `console.error('[HERDON_CENARIO_SAVE_ERROR]', { action, error, payload })`. Tabela `public.cenarios` (sem alteração de RLS, sem migration).
**Arquivo:** `src/pages/CenariosPage.jsx`.

## Testes
- `eventos_operacionais` round-trip no banco: OK (insert/select/update/delete).
- Unit tests novos em `tests/operationalPersistence.test.js`: mapeamento `data→data_inicio`, `funcionario_id` null para string vazia, update parcial. **635/635 passando.**
- **Lint:** limpo · **Build:** sucesso.

## Pendências / a validar na UI com proprietário real
- Testar criar/editar/excluir evento no preview e confirmar que reaparece após reload (round-trip já provado no banco; falta o teste visual + responsividade do modal em 390×844).
- Eventos recorrentes: `recorrencia` é salvo em `metadata`, mas a **expansão visual** de recorrência para eventos operacionais ainda não é renderizada (hoje só `rotinas` expandem). Melhoria futura, não bloqueante.

---

# M1 + M2 — Sanidade integrada ao estoque e ações rápidas abrindo formulários

## M1 — Sanidade puxa produto/vacina do estoque

**Problema:** no manejo sanitário o produto era texto livre; o produtor não conseguia vincular vacina/vermífugo/medicamento já cadastrados no estoque.
**Causa:** `SanitarioForm` não recebia `estoque` e não tinha select de produto; a tabela `sanitario` **não tem** coluna `item_estoque_id`/`produto_id`.
**Comportamento antes:** só campo "Descrição" digitado à mão.
**Comportamento depois:** novo select **"Produto / vacina (do estoque, opcional)"** populado com itens do estoque de categoria/sub/nome sanitário (vacina, vermífugo, medicamento, soro, antibiótico, carrapaticida...). Se nada casar mas houver estoque, mostra todos; se vazio, orienta a cadastrar no estoque. Ao escolher um produto, a Descrição é preenchida com o nome (continua editável). O vínculo é salvo em `sanitario.metadata.item_estoque_id` (coluna `metadata` jsonb já existente) — **sem migration, sem nova coluna**. Ao editar, o produto selecionado reaparece (lido de `metadata.item_estoque_id`). Strings vazias viram `null` (sem erro 22P02).

**Tabela sanidade:** `public.sanitario` · **Tabela estoque:** `public.estoque` · **RLS:** não alterada · **Migration:** nenhuma.
**Limitação documentada:** como não há FK para estoque, o vínculo é por id em `metadata` (e o nome em `desc`), não por chave estrangeira. Suficiente para exibir/reabrir; não impõe integridade referencial.
**Arquivos:** `src/components/SanitarioForm.jsx`, `src/pages/SanitarioPage.jsx`.
**Validação (round-trip no banco):** INSERT→UPDATE→DELETE de um `sanitario` com `metadata.item_estoque_id` (vacina clostridial) para proprietário/lote reais — OK, `item_estoque_id` preservado após update; limpeza confirmada (0 linhas de teste).

## M2 — Ações rápidas abrem o formulário direto

**Problema:** as ações rápidas do Dashboard navegavam para a página, mas só Pesagem abria o formulário; as demais exigiam um segundo clique.
**Causa:** só `PesagensPage` lia `navigationIntent`.
**Comportamento antes:** "Novo lote/custo/tarefa/manejo/produto" caíam na página sem abrir o form.
**Comportamento depois:** cada página detecta `navigationIntent.page === <id> && action === 'novo'` e abre o formulário/modal correspondente já na montagem. Padrão idêntico ao da Pesagem (estado inicial do `useState`): não reabre em loop nem após reload (o intent é limpo ao navegar pelo menu; o componente só remonta ao trocar de página).

| Ação rápida | Página | Abre |
|---|---|---|
| Nova pesagem | `pesagens` | form de pesagem (já existia) |
| Novo lote | `lotes` | modal de novo lote (`openNovoLote`) |
| Novo custo | `financeiro` | modal de lançamento (`openLanc`) |
| Nova tarefa | `tarefas` | modal de tarefa (`openModal`) |
| Novo manejo/sanidade | `sanitario` | form de manejo (`abrirForm`) |
| Novo produto/estoque | `estoque` | modal de cadastro de item (`openCadastroItem`) |

**Arquivos:** `src/pages/LotesPage.jsx`, `src/pages/FinanceiroPage.jsx`, `src/pages/TarefasPage.jsx`, `src/pages/SanitarioPage.jsx`, `src/pages/EstoquePage.jsx` (App.jsx já repassava `navigationIntent` a todas as páginas).

## Resultados M1 + M2
- **Lint:** limpo · **Build:** sucesso · **Testes:** 635/635 passando.
- **Pendências:** validar no preview com proprietário real os 6 cliques de ação rápida e a seleção de produto na sanidade, em 1920×1080 / 1366×768 / 390×844 (a persistência já foi provada no banco).

---

# M3 — Tabelas operacionais duplicadas (diagnóstico + consolidação segura)

> Diagnóstico completo e decisão em [`docs/DECISAO_M3_TABELAS_DUPLICADAS.md`](DECISAO_M3_TABELAS_DUPLICADAS.md).

**Problema:** suspeita de duplicidade entre `custos`/`movimentacoes_financeiras` e `consumo_suplementacao`/`suplementacao` — risco de valor financeiro contado em dobro e de suplementação salva/lida em tabelas diferentes.

**Tabelas analisadas:** `custos` (2 reg.), `movimentacoes_financeiras` (4 reg.), `consumo_suplementacao` (2 reg.), `suplementacao` (**0 reg.**).

**Causa / achado:**
- **Financeiro:** as duas tabelas têm papéis distintos. `movimentacoes_financeiras` é o livro-caixa/DRE oficial (FinanceiroPage/Dashboard); `custos` é a tabela operacional de custo do lote. Um custo lançado vira também uma movimentação (`origem='custo'`). O resultado do lote (`calcularCustoLote`) **já deduplicava** (usa o livro-caixa como base e só soma custos legados sem espelho). Join de duplicidade no banco: **0 linhas**. Nenhuma tela soma as duas ingenuamente. Risco real: baixo/teórico — agora travado por teste.
- **Suplementação:** `suplementacao` está **vazia e descontinuada** (não hidratada, sem leitura/escrita no app). A fonte usada é `consumo_suplementacao`.

**Decisão:**
- **Financeiro:** manter ambas com papéis claros — `movimentacoes_financeiras` = fonte oficial; `custos` = custo operacional do lote; elo via `origem='custo'`/`origem_id` com dedup em `calcularCustoLote`.
- **Suplementação:** `consumo_suplementacao` = fonte oficial; `suplementacao` = legado (mantida no banco, marcada como legado no código).

**Arquivos alterados:**
- `docs/DECISAO_M3_TABELAS_DUPLICADAS.md` (novo — diagnóstico/decisão)
- `src/domain/calculos.js` (comentário declarando a fonte oficial e a lógica anti-dobro)
- `src/domain/calculos.test.js` (2 testes de regressão: custo espelhado não duplica; custo legado conta uma vez)
- `src/data/operationalTemplate.js` (comentário marcando `suplementacao` como legado)

**Schema/RLS/dados:** **nenhuma** alteração de schema, **nenhuma** mudança de RLS, **nenhum** dado apagado, **nenhuma** migration. Nenhuma tabela dropada.

**Testes:** 637/637 passando (2 novos de dedup financeiro). **Lint:** limpo · **Build:** sucesso.

**Pendências (futuro, exige autorização):** eventual `DROP TABLE suplementacao` após período de confirmação; backfill opcional dos 2 custos de aquisição legados para o DRE; possível unificação da entrada de custo em `movimentacoes_financeiras` (refator maior).

---

# Manejo sanitário com múltiplos procedimentos

**Problema:** o "Novo manejo sanitário" só permitia **um** tipo por lançamento (Vacina **ou** Vermífugo...). No campo, o produtor faz vários procedimentos no mesmo manejo (ex.: vacinação + vermifugação).

**Solução adotada (sem migration):** o formulário ganhou a seção **"Procedimentos realizados"** — começa com 1 procedimento e o produtor adiciona/remove quantos quiser. Lote, quantidade, data, próxima dose, responsável e observação são **compartilhados**; cada procedimento tem **tipo + produto do estoque + descrição** próprios. Ao salvar, é criado **um registro em `sanitario` por procedimento**, todos com o mesmo lote/data/qtd/obs, e ligados por `metadata.grupo_manejo_id` (id gerado no client).

**Houve migration?** **Não.** A tabela `sanitario` tem `tipo` único; a composição é resolvida criando N registros + `grupo_manejo_id` no `metadata` (jsonb já existente). RLS inalterada.

**Como salva no banco / usa metadata:**
- N registros `sanitario`, cada um com `tipo`, `desc` próprios.
- `metadata.item_estoque_id` = produto do estoque do procedimento (opcional, vira `null` se vazio — sem erro de tipo).
- `metadata.grupo_manejo_id` = liga os procedimentos do mesmo manejo (para agrupamento futuro na UI).
- Tarefa automática (próxima dose): criada **uma vez por manejo** (não por procedimento), ligada ao 1º registro, com descrição combinada.

**Salvamento controlado / erros (sem mascarar conexão):**
- Valida: "Adicione pelo menos um procedimento." / "Selecione o tipo do procedimento." / lote, data, quantidade obrigatórios.
- Em falha de um procedimento: loga `console.error('[HERDON_SANITARIO_SAVE_ERROR]', …)` e mostra "Parte do manejo foi salva, mas N procedimento(s) falharam." (parcial) ou "Não foi possível salvar um dos procedimentos do manejo." (total) — nunca "erro de conexão" para validação.

**Edição:** edita o registro **individual** (com seu produto reaberto via `metadata.item_estoque_id`); edição do grupo inteiro fica como **pendência** documentada. Listagem: cada procedimento aparece como sua própria linha (Vacina — Lote — 118; Vermífugo — Lote — 118).

**Arquivos alterados:** `src/components/SanitarioForm.jsx` (UI de procedimentos), `src/pages/SanitarioPage.jsx` (`salvarItem` multi-registro + grupo + parcial), `src/styles/app.css` (layout responsivo dos procedimentos).

**Validação (round-trip no banco):** INSERT de 2 procedimentos (vacina + vermífugo) com `grupo_manejo_id` compartilhado e `metadata.item_estoque_id` para owner/lote reais → 2 registros no grupo; DELETE → 0 (limpeza confirmada). **Lint:** limpo · **Build:** sucesso · **Testes:** 637/637.

**Pendências:** validação visual no preview (1920×1080 / 1366×768 / 390×844: adicionar/remover procedimento no mobile); agrupamento visual por `grupo_manejo_id` na listagem; edição do manejo composto inteiro de uma vez.
