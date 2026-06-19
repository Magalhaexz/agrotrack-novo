# Sprint 22 — Resultado

## Funcionalidade entregue

**Hoje na Fazenda** — o Painel Geral passa a abrir mostrando o que precisa
de atenção agora, em linguagem simples, com ações rápidas para os fluxos
mais comuns. Sem tabela nova, sem mexer em Asaas/planos/importação/offline.

---

## O que foi construído

### Arquivos novos

| Arquivo | Descrição |
|---|---|
| `src/domain/hojeNaFazenda.js` | Domínio puro: prioridades do dia, contas a vencer, lotes sem pesagem/pasto/GMD abaixo da meta, resumo de pastos em uso |
| `src/domain/hojeNaFazenda.test.js` | 16 testes do domínio (conta vazia, operação saudável, cada categoria de prioridade, pastos em uso) |
| `docs/HOJE_NA_FAZENDA_HERDON.md` | Documentação técnica da funcionalidade |
| `docs/HOJE_NA_FAZENDA_TESTE_MANUAL.md` | Roteiro e resultado do teste manual |

### Arquivos modificados

| Arquivo | O que mudou |
|---|---|
| `src/pages/DashboardPage.jsx` | Seção "Hoje na Fazenda", "Ações rápidas", "Pastos em uso"; 7 KPIs honestos (sem variação fabricada); correção do bug de mapeamento de alertas; dois estados vazios distintos |
| `src/styles/dashboard.css` | Grid responsivo `dashboard-action-grid--quick` para as ações rápidas |
| `src/lucide-react.js` | Ícone `Repeat` adicionado (usado em "Mover lote de pasto") |
| `src/components/lotes/LoteDetailsPanel.jsx` | "Pastagem" → "Pasto" no cabeçalho do detalhe do lote |
| `src/components/lotes/LoteOverviewTab.jsx` | "Pastagem atual" → "Pasto atual" |
| `src/components/LoteForm.jsx` | "Pastagem vinculada não encontrada" → "Pasto vinculado não encontrado" |
| `src/pages/PastagensPage.jsx` | "Pastagem"/"pastagem" → "Pasto"/"pasto" em todos os toasts, títulos e estados vazios visíveis ao usuário |
| `docs/UI_UX_HERDON.md` | Tabela de termos substituídos e tabela de estados vazios atualizadas |
| `docs/BETA_PILOTO_READY_HERDON.md` | Nota de continuidade pós-Sprint 21/22 |

Nenhuma migration nova. Nenhuma alteração em `navConfig.js`, Asaas, planos ou
importação.

---

## 1. O que foi criado em "Hoje na Fazenda"

Lista de prioridades em linguagem simples (só aparece o que tem ocorrência):
contas vencidas, lotes sem pesagem recente, contas próximas do vencimento,
lotes sem pasto definido, lotes com GMD abaixo da meta, itens com estoque
baixo, e um item agregado de alertas críticos (sanitário, rotina, saída de
lote — o que não já tem linha própria). Cada item é clicável e leva direto
para a tela relacionada. Detalhes completos em
[HOJE_NA_FAZENDA_HERDON.md](HOJE_NA_FAZENDA_HERDON.md).

## 2. Ações rápidas

8 botões: Nova fazenda, Novo pasto, Novo lote, Registrar pesagem, Lançar
custo/receita, Importar dados, Mover lote de pasto, Ver alertas. Todas
navegam para rotas já existentes (confirmadas no registro de páginas) — "Ver
alertas" troca para a aba interna do próprio Dashboard.

## 3. Bug de alertas corrigido

`buildAlerts()` gera `nivel`/`mensagem`; `DashboardPage.jsx` lia
`prioridade`/`descricao` — campos inexistentes nesses objetos. Resultado:
**nenhum alerta era classificado como crítico, nunca**, independente dos
dados reais (estoque vencido, pesagem muito atrasada, pagamento vencido
etc. nunca apareciam como "crítico" no Painel Geral nem na aba Alertas, e a
contagem "Alta prioridade" da aba Alertas sempre mostrava zero). Corrigido
mapeando `nivel → prioridade` e lendo `alert.mensagem` como descrição.

## 4. Ajustes de linguagem/visual

- Variação percentual fabricada (`getVariation(valor, valor*0.92)`) removida
  dos KPIs — substituída por subtítulos honestos e informativos.
- `db.pastagens` agora é escopado pela fazenda ativa dentro do Dashboard
  (antes só `lotes`/`animais`/etc. eram, via `dbDashboard` em `App.jsx`) —
  evita contar pasto de outra fazenda como "sem lote".
- "Pastagem" → "Pasto" em todos os textos visíveis ao usuário ainda
  pendentes (cabeçalho do lote, visão geral do lote, select de pasto no
  formulário de lote, toasts e estados vazios da página de Pastos).
- Dois estados vazios distintos no Dashboard: conta sem nenhuma fazenda
  (mensagem de boas-vindas + 3 botões) vs. conta com fazenda mas sem lote
  ativo (mensagem específica + 2 botões).

---

## Decisões técnicas

### Domínio puro separado da página

`src/domain/hojeNaFazenda.js` não depende de React nem de rede — recebe
`db` e `alerts` já calculados e retorna dados estruturados. Mesma convenção
de `domain/unidadeAnimal.js`/`domain/resumoLote.js`. Permite testar toda a
lógica de "o que é prioridade hoje" com `node:test`, sem mock de Supabase.

### Reaproveitar o motor de alertas existente para o catch-all

Em vez de recalcular sanitário/rotina/saída-de-lote do zero, o item
"alertas críticos" de Hoje na Fazenda conta os alertas de nível `critical`
que `buildAlerts()` já calcula e que **não** sejam de pesagem, financeiro ou
estoque (esses três já têm linha própria, calculada direto de `db` para
controle exato da frase). Evita duplicar limites/regras (ex.: "45 dias sem
pesar" já vive em um único lugar).

### Indício de excesso de pasto sem cálculo de UA

Comparar cabeças (`lote.qtd`) contra a capacidade do pasto em UA
(`area_ha × capacidade_suporte_ua_ha`) não é uma conversão correta — é uma
aproximação deliberada para dar um sinal simples sem introduzir o cálculo de
UA por animal (`domain/unidadeAnimal.js`) no Dashboard nesta sprint, exatamente
como pedido no plano.

---

## Gates (Sprint 22)

| Gate | Resultado |
|------|-----------|
| `npm test` | ✓ 424 testes, 0 falhas (16 novos) |
| `npm run lint` | ✓ sem erros |
| `npm run build` | ✓ build completo |

## Teste manual

Sem credenciais de login reais neste ambiente — verificação feita via testes
automatizados de domínio (cobrindo todos os cenários do roteiro: conta vazia,
lotes sem pesagem, lotes sem pasto, contas vencidas/próximas, alertas
críticos, pastos em uso) + revisão de código + build limpo. Verificação
visual em navegador (mobile especialmente) registrada como pendência.
Detalhes em [HOJE_NA_FAZENDA_TESTE_MANUAL.md](HOJE_NA_FAZENDA_TESTE_MANUAL.md).

---

## Pendências para a Sprint 23

- Verificação visual real (mobile e desktop) do novo Painel Geral com uma
  conta autenticada — não foi possível nesta sessão.
- "Movimentações recentes de pasto" e "registros importados recentemente"
  como itens de prioridade — adiados por exigirem agregação assíncrona nova
  (hoje o histórico de pasto só é consultado por lote, não por fazenda toda).
- Ocupação por UA real (por animal) em vez do indício simples por cabeças.
- Modo offline, notificações push, lembretes automáticos, agenda de manejo,
  mapa da fazenda, recomendação automática por IA — todas já eram
  pendências futuras conhecidas, não pioraram nem foram resolvidas aqui.
- Página dedicada de "Guia do Criador Piloto" dentro do app — hoje o botão
  do estado vazio leva para Suporte; o PDF do guia vive fora do app.
