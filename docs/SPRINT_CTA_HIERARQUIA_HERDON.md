# Sprint Visual 3 — Hierarquia de CTAs e Ações — HERDON

**Data:** 2026-08-12
**Branch:** `design/cta-action-hierarchy` (a partir de `design/typography-scale-hierarchy` — Sprints 1 e 2 ainda não mergeadas em `main`, ver nota abaixo)
**Escopo:** hierarquia de botões/ações em 4 telas — Lotes, Pastos, Pesagens, Estoque. Sem remoção de funcionalidade, sem mudança de rota/permissão/regra de negócio, sem nova tipografia.

**Nota de base:** a preparação pedia confirmar que as Sprints Visuais 1 e 2 já estavam incorporadas ao `main` antes de criar o branch a partir de `origin/main`. Isso não é verdade — os PRs de `design/typography-visual-audit` e `design/typography-scale-hierarchy` seguem abertos. Como nas sprints anteriores, o branch foi criado empilhado sobre o topo da Sprint 2 (confirmado com o usuário antes de prosseguir), para não perder a base de tipografia que esta sprint depende de não repetir.

---

## 1. Regra definida

> Em cada contexto visual deve existir, preferencialmente, apenas uma ação primária evidente (`ui-button--primary`, verde sólido). As demais usam `secondary`/`outline` (ação relevante mas não principal), `ghost` (auxiliar), `warning`/`danger` (só quando a ação carrega risco real — não para "destacar").

O sistema de botões já existia e já cobria essa hierarquia (`src/components/ui/Button.jsx` — variants `primary/secondary/warning/danger/ghost/outline`); nenhum componente novo foi criado, só a variant usada em cada CTA foi revisada.

## 2. Problemas anteriores (verificados de novo, não só herdados da Sprint 1)

A auditoria da Sprint 1 media botões via `document.querySelectorAll('button')` sem escopo — contava também chrome de navegação (abas do header, sino de notificação, menu de usuário) e, no caso de Lotes, um estado da tela que talvez não fosse o inicial. Antes de corrigir, remedi cada tela ao vivo, escopado a `<main>`, olhando `variant`/`background` real de cada botão. Os problemas confirmados:

- **Lotes:** com o card do lote aberto (estado de preview), a tela mostra 2 botões `primary` ao mesmo tempo — "Cadastrar lote" (header) e "Ver lote completo" (rodapé do preview) — competindo pelo mesmo verde. Dentro do menu de ações do lote (`LoteAcoesMenu`, já agrupado em blocos por uma sprint anterior do próprio repo), a ação "Venda" usava `variant="warning"` (âmbar) igual a "Morte/perda" e "Transferência de saída" — mas venda é o desfecho normal da operação, não um evento de risco.
- **Pastos:** "Cadastrar pasto"/"Novo pasto" aparecia 4× — header, botão de submit do formulário (sempre visível na página, não é modal) e 2 empty states idênticos ("Capacidade dos pastos" e "Pastos cadastrados"), todos `primary`.
- **Pesagens:** "Cadastrar nova pesagem" (header), "Nova pesagem" (aba) e "Registrar pesagem" (empty state) — 3 rótulos para o mesmo destino (`abrirNovaPesagem()`, confirmado no código: os 3 levam ao mesmo `setAbaAtiva('nova')`).
- **Estoque:** "Novo item" (header, `primary`) e "Registrar entrada" (toolbar, também `primary` sem variant declarada — "Registrar saída" ao lado já usava `outline` corretamente, inconsistência entre as duas) apareciam com o mesmo peso visual do cadastro. O empty state repetia "Novo item" em `primary` de novo.

## 3. Mudanças por tela

### Lotes
- `src/pages/LotesPage.jsx`: botão "Ver lote completo" (dentro do preview do lote) ganhou `variant="secondary"` — deixa de competir com "Cadastrar lote".
- `src/components/lotes/loteAcoesConfig.js`: ação "Venda" mudou de `variant: 'warning'` para `variant: 'outline'` — mesma família visual de "Editar"/"Ajuste de lotação"/"Trocar lote de pasto", reservando o âmbar para o que de fato é uma pendência (nenhuma ação do lote usa mais `warning` — "Morte/perda" e "Transferência de saída" seguem `warning` por representarem, respectivamente, uma perda e uma movimentação de saída que merecem um sinal de atenção; `danger` seguiu só em "Finalizar lote", a única ação irreversível).

### Pastos
- `src/pages/PastagensPage.jsx`: removido o botão "Cadastrar pasto" do empty state do card "Capacidade dos pastos" — ele ficava imediatamente abaixo do formulário de cadastro, que já está sempre visível na página; repetir o CTA ali não orientava nada, só duplicava. O texto do empty state (título + subtítulo) foi mantido.
- O empty state restante (card "Pastos cadastrados", mais abaixo na página) manteve seu CTA, mas com `variant="secondary"` em vez de `primary` — "Cadastrar pasto" do header segue como o único primário da página.
- O botão de submit do formulário ("Novo pasto") não foi alterado — é a ação de registro do próprio formulário, papel legitimamente primário nesse contexto local.

### Pesagens
- `src/pages/PesagensPage.jsx`: unificada a nomenclatura para **"Registrar pesagem"** nos 3 pontos (header, aba do segmented-control, empty state do histórico) — confirmado antes que os 3 levam ao mesmo estado (`abrirNovaPesagem()` só soma uma checagem de permissão e reset de edição ao que a aba já fazia sozinha). Nenhuma mudança de variant/hierarquia aqui — o problema era só de nomenclatura, não de peso visual.

### Estoque
- `src/pages/EstoquePage.jsx`: "Registrar entrada" ganhou `variant="outline"` (igual a "Registrar saída", ao lado — as duas eram inconsistentes entre si). "Novo item" do empty state ganhou `variant="secondary"`. "Novo item" do header segue como o único `primary` da página — cadastro é a ação primária; entrada/saída são movimentação de item já existente, tratadas como secundárias/agrupadas na mesma toolbar.
- O "Novo item" dentro do modal "Entrada de estoque" (quando não há nenhum item cadastrado ainda) não foi alterado — é uma ação isolada dentro de um modal já aberto, sem nenhum outro primário visível ao mesmo tempo para competir.

## 4. Ações primárias escolhidas

| Tela | Ação primária |
|---|---|
| Lotes | Cadastrar lote |
| Pastos | Cadastrar pasto (header) — o submit do formulário inline segue primário no seu próprio contexto |
| Pesagens | Registrar pesagem |
| Estoque | Novo item |

## 5. Ações secundárias

- Lotes: "Ver lote completo" (secondary), "Registrar pesagem"/"Ajuste de lotação"/"Trocar lote de pasto"/"Venda" (outline), "Editar" (ghost).
- Pastos: "Cadastrar pasto" do empty state restante (secondary).
- Estoque: "Registrar entrada"/"Registrar saída" (outline), "Novo item" do empty state (secondary), "Exportar CSV"/"Imprimir PDF" (outline), "Mostrar apenas críticos" (ghost).

## 6. Nomenclaturas consolidadas

- Pesagens: **"Registrar pesagem"** — substituiu "Cadastrar nova pesagem" (header) e "Nova pesagem" (aba). Confirmado que as 3 formas eram o mesmo destino antes de unificar (seção 2).
- Nenhuma outra tela teve nomenclatura duplicada com fluxo idêntico — Lotes/Pastos/Estoque tinham problema de *peso visual* repetido (mesmo texto, mas ok como texto — "Cadastrar lote"/"Cadastrar pasto"/"Novo item" já eram nomes corretos e únicos por contexto), não de nomenclatura inconsistente.

## 7. Comportamento mobile

Testado em 320×568, 360×800, 390×844 e 412×915 nas 4 telas (Lotes testado com o painel de ações do lote aberto — o cenário mais denso). Nenhum overflow horizontal de `body` em nenhuma combinação. O sistema de botões já quebra linha (`flex-wrap` nos `action-row`/`lote-actions-group`) e o `Button` component não precisou de nenhum ajuste — a redução de primários por tela já reduz a quantidade de blocos coloridos empilhados, que era o risco real de "5–6 botões preenchidos" citado no brief. Mecanismo de abertura da sidebar não foi tocado.

## 8. Ícones

Revisados os ícones já usados em cada CTA (`Plus` em cadastro/novo, `ArrowUpCircle`/`ArrowDownCircle` em entrada/saída, `Weight` em pesagem, `DollarSign`/`AlertTriangle`/`Truck`/`MapPinned`/`CheckCircle2`/`Settings` no menu de ações do lote) — já são consistentes entre ações equivalentes e semanticamente claros, sem ruído decorativo. Nenhuma mudança de ícone foi necessária.

## 9. Comparação antes/depois

| Tela | Ações visíveis antes | Primárias antes | Ações visíveis depois | Primárias depois |
|---|---:|---:|---:|---:|
| Lotes (painel do lote aberto) | 11 | 2 | 11 | 1 |
| Pastos | 4 | 4 | 3 | 2 |
| Pesagens (3 nomes p/ mesma ação) | 3 | — (problema era nome, não peso) | 3 | — |
| Estoque | 6 | 3 | 6 | 1 |

**Mantidas:** todas as 8 ações do menu de lote, o botão "Novo pasto" do formulário, os 3 pontos de entrada de pesagem, "Registrar entrada"/"Registrar saída"/exportações do Estoque — nenhuma função saiu do ar.
**Rebaixadas visualmente:** "Ver lote completo" (Lotes), "Venda" (Lotes), CTA restante de empty state (Pastos), "Registrar entrada" e "Novo item" de empty state (Estoque).
**Removidas por duplicidade visual:** 1 CTA "Cadastrar pasto" (Pastos, empty state imediatamente abaixo do formulário já visível) — a ação continua disponível pelo header e pelo próprio formulário, só o botão redundante saiu.
**Nomenclatura unificada:** 3→1 rótulo em Pesagens.

## 10. Pendências

- Estoque tem mais 2 botões (`Exportar CSV`, `Imprimir / PDF`) fora da toolbar principal (dentro de `ExportActions`) que não foram auditados nesta rodada — pareceram consistentes (`outline`) mas não foram formalmente revisados linha a linha.
- Outras telas com o mesmo tipo de problema identificado na Sprint 1 (Alertas — painel de filtro pesado; Sanidade — 3 camadas de vazio) não foram tocadas — fora da lista de 4 telas desta sprint.
- `PesagemForm.jsx` e o modal de pesagem aberto a partir de Lotes usam "Nova pesagem"/"Editar pesagem" como título de modal (padrão novo/editar já estabelecido em todo o app) — não foi alterado, é um padrão diferente do problema de CTA duplicado tratado aqui.
- Itens explicitamente fora de escopo (seção 12 do brief): sidebar, Supabase/banco, cards/radius/shadow, Painel Gerencial, tabela Resultados, modal Novo Lote (estrutura do formulário), Perfil/Assinatura — nada disso foi tocado.

---

## Fechamento

**Arquivos alterados:** `src/pages/LotesPage.jsx`, `src/components/lotes/loteAcoesConfig.js`, `src/pages/PastagensPage.jsx`, `src/pages/PesagensPage.jsx`, `src/pages/EstoquePage.jsx` + novo `docs/SPRINT_CTA_HIERARQUIA_HERDON.md`.

**CTAs antes/depois:** Lotes 2→1 primário simultâneo; Pastos 4→3 ações (4→2 primários); Estoque 3→1 primário; Pesagens 3 nomes→1 nome (peso visual inalterado, não era o problema).

**Ação primária por tela:** Lotes = "Cadastrar lote" · Pastos = "Cadastrar pasto" · Pesagens = "Registrar pesagem" · Estoque = "Novo item".

**Duplicidades removidas:** 1 (CTA "Cadastrar pasto" redundante em Pastos).
**Nomenclaturas consolidadas:** 1 (Pesagens, 3→1).

**Breakpoints testados:** 320×568, 360×800, 390×844, 412×915 (mobile) e 1024×768, 1366×768 (desktop, atenção especial) — sem overflow em nenhuma tela/resolução.

**Lint:** limpo. **Testes:** 1859/1859 passando. **Build:** ok (`vite build`, sem erros).
