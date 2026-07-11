# Auditoria — Navegação SPA e Ações dos Lotes

Data: 2026-07-11
Branch: main (working tree, ainda não commitado no início desta auditoria)

## Etapa 0 — estado ao iniciar

`git status --short` mostrava trabalho não commitado de uma sessão anterior que já
havia implementado boa parte do escopo deste sprint, mas sem rodar lint/test/build
nem validação visual:

- `src/components/lotes/loteAcoesConfig.js` + `LoteAcoesMenu.jsx` (config central das
  7 ações) — novos, untracked.
- `src/components/lotes/AjusteLotacaoModal.jsx` — novo, untracked.
- `src/navigation/urlState.js` + `useUrlState.js` — novos, untracked (sincronização
  `loteId`/`tab` do LotesPage com a query string).
- `LoteCard.jsx`, `LoteDetailsPanel.jsx`, `RetiradaAnimaisModal.jsx`, `constants.js`,
  `LotesPage.jsx`, `lotesLogic.js` — modificados para usar a config central.
- `src/components/VendaLoteModal.jsx` — deletado (substituído por
  `RetiradaAnimaisModal` unificado).

Nada foi descartado. Esta auditoria completou o que faltava em cima desse trabalho.

## Etapa 1/2 — auditoria visual e de duplicidade das ações

Verificado por leitura de código (`LoteCard.jsx`, `LoteDetailsPanel.jsx`,
`LoteAcoesMenu.jsx`, `loteAcoesConfig.js`, `constants.js`, `RetiradaAnimaisModal.jsx`)
e confirmado depois visualmente com um lote real:

| Tela | Ação | Situação encontrada |
|---|---|---|
| Card do lote (listagem) | Editar/Ajuste de lotação/Venda/Morte-perda/Transferência de saída/Trocar lote de pasto/Finalizar lote | Já correto — vem de `LOTE_ACOES` via `LoteAcoesMenu`, usado também no detalhe. Nenhuma lista duplicada. |
| Detalhe do lote | mesmas 7 ações | Já correto — mesmo `LoteAcoesMenu`. |
| Dropdown "Tipo" dentro do modal de retirada | "Trocar lote de pasto" / "Finalizar lote" aparecem como opções | Intencional e documentado no código: ao selecionar, chama `onRedirecionar(tipo)` e abre o fluxo próprio — nunca reduz `qtd` como uma retirada. Não é uma duplicata de config, é um atalho para o mesmo handler. |
| Busca global por `"Venda parcial"`, `"Saída do lote"`, `"Trocar lote"` (sem "de pasto") como rótulo de ação | — | Nenhuma ocorrência no código-fonte. Bug já corrigido antes desta sessão. |

Conclusão: os bugs 1.1–1.4 descritos no pedido (rótulos errados, "Trocar lote"
abrindo finalização, falta de "Ajuste de lotação"/"Trocar lote de pasto") **já
estavam corrigidos** no trabalho não commitado. Testes de regressão foram
adicionados/mantidos em `loteAcoesConfig.test.js` para travar isso.

## Etapa 5 — Ações rápidas

Gap real encontrado: nem o painel "Ações rápidas" do Dashboard (desktop) nem o
`MobileFab` (mobile) tinham a opção "Trocar lote de pasto".

Corrigido:
- `src/pages/DashboardPage.jsx` — novo botão "Trocar lote de pasto" no grid de
  Ações rápidas, navega para `lotes` (mesma lista de cards, que já tem a ação real
  usando `MoverPastoModal`). Não foi criado um segundo fluxo.
- `src/components/MobileFab.jsx` — "Trocar Lote de Pasto" adicionado à lista de
  atalhos da página `lotes`. `handleMobileQuickAction` (App.jsx) já roteava por
  substring (`action.includes('lote')`) então nenhuma mudança extra foi necessária
  ali.

## Etapas 6–13 — roteamento SPA e histórico

Arquitetura encontrada: **não** é React Router. É um roteador caseiro em `App.jsx`:
`currentPage` (state) + `navigationIntent` (state), sincronizados com
`window.location.pathname` via `getPageFromPathname`/`getRouteForPage`
(`src/navigation/routes.js`), com `pushState` em `navigateWithPermission` e um
listener de `popstate` que já existia (`App.jsx:348-356`).

**Bug raiz encontrado:** `pageRouteMap` só continha 6 das 39 páginas do `pageMap`
(dashboard, minhaAssinatura, termos, privacidade, cobranca, suporte). Para as
outras 33 páginas — incluindo `lotes`, `estoque`, `financeiro`, etc. —
`getRouteForPage` devolvia `null`, então `navigateWithPermission` **nunca chamava
`pushState`** para elas. Resultado: navegar entre a maioria das páginas não criava
entrada de histórico nenhuma, e apertar voltar saía direto para o que estava na
aba do navegador antes do HERDON — exatamente o sintoma relatado ("o botão voltar
sai do aplicativo").

Correção: `src/navigation/routes.js` agora mapeia as 39 páginas para rotas
kebab-case (`/lotes`, `/estoque`, `/calendario-operacional`, etc.), reaproveitando
o mecanismo genérico já existente — nenhuma abstração nova, só preencher o mapa.
`vercel.json` já tinha rewrite catch-all para `index.html`, então as novas rotas
funcionam em produção sem mudança de infraestrutura.

Dentro de `LotesPage`, `loteId`/aba ativa já vivem na query string via
`useUrlState`/`urlState.js` (trabalho da sessão anterior) — `loteId` empilha
histórico (permite voltar do detalhe pra lista), troca de aba só substitui
(não infla o histórico). Testes puros em `urlState.test.js` (já existentes) e
novos em `routes.test.js` (round-trip rota↔página para as 39 páginas, fallback
para `dashboard` em rota desconhecida/corrompida, sem rotas duplicadas).

**Fallback (etapa 10):** `getPageFromPathname` já cai para `'dashboard'` em
qualquer pathname não mapeado — comportamento correto e testado.

**Logout (etapa 11):** `handleLogout` (App.jsx) já limpa sessão/estado local e
faz `window.location.replace('/')` — recarrega o app do zero, sem deixar uma rota
autenticada acessível via voltar. Nenhuma mudança necessária.

**Não migrado nesta sessão** (fora do escopo mínimo, documentado para não
esquecer): `EstoquePage`, `CalendarioOperacionalPage`, `ResultadosPage` e
`MinhaAssinaturaPage` têm o mesmo padrão "lista → detalhe com abas" que `LotesPage`
mas ainda usam `useState` local em vez de `useUrlState` — voltar dentro dessas
páginas não sai do app (a página em si já está no histórico agora), mas perde a
sub-seleção (item/aba). Extensível com o mesmo hook quando houver necessidade.

## Etapa 15 — validação visual autenticada

Feita com login manual do usuário (sem credenciais em código/commit/log), servidor
`npm run dev` local, conta real (2 fazendas, sem lotes ativos no início).

Criado lote temporário `TESTE-NAV-001` (ativo, 10 cabeças) para poder exercitar as
7 ações — apagado ao final via SQL direto (`lotes`/`animais`/`pesagens`, sem deixar
resíduo). Lote pré-existente `teste` (encerrado) confirmou que ações ficam
desabilitadas para lote bloqueado.

Confirmado no navegador:
- Card mostra as 7 ações com os rótulos corretos (`Editar`, `Ajuste de lotação`,
  `Venda`, `Morte/perda`, `Transferência de saída`, `Trocar lote de pasto`,
  `Finalizar lote`) + "Ver detalhes" separado.
- Clique em "Ver detalhes" → `/lotes?loteId=25`, painel de detalhe correto.
- Clique em "Ajuste de lotação" a partir do card → abre exclusivamente o modal
  "Ajuste de lotação" (nunca venda/morte/transferência/finalização).
- Botão voltar do navegador: detalhe → lista (`/lotes?loteId=25` → `/lotes`), e
  Lotes → Dashboard → voltar → volta para Lotes (não sai do app). Antes da
  correção da Etapa 6-13, este segundo caso saía do HERDON.
- Ações rápidas → "Trocar lote de pasto" (desktop, grid do Painel Geral) navega
  para `/lotes`. Mobile (`MobileFab`) tem a mesma opção no menu de atalhos.
- Console do navegador sem erros durante todo o fluxo.

Não testado nesta sessão: gesto de voltar em dispositivo móvel físico (ambiente
de teste é um navegador desktop) e comportamento do botão lateral do mouse
especificamente (equivalente a "voltar" do navegador, mesmo mecanismo).

## Validação final

```
npm run lint   → 0 problemas
npm test       → 1152 passing, 0 failing (19 suites)
npm run build  → build ok (vite)
```

## Resumo de arquivos alterados nesta sessão (além do trabalho herdado)

- `src/navigation/routes.js` — mapa de rotas completo (39 páginas).
- `src/navigation/routes.test.js` — novo, cobre round-trip e fallback.
- `src/pages/DashboardPage.jsx` — botão "Trocar lote de pasto" nas Ações rápidas.
- `src/components/MobileFab.jsx` — "Trocar Lote de Pasto" no FAB mobile de Lotes.

## Critérios de aceite — status

- [x] Card mostra as ações corretas, sem "Venda parcial"/"Saída do lote"/"Trocar lote" solto.
- [x] Existem "Trocar lote de pasto", "Finalizar lote" e "Ajuste de lotação" separados.
- [x] Todas as telas usam a mesma configuração (`loteAcoesConfig.js`).
- [x] Ações rápidas incluem troca de pasto (desktop + mobile).
- [x] Cada botão abre o modal correto (validado visualmente).
- [x] Botão voltar navega pelo histórico interno (corrigido nesta sessão para as 33 páginas que não tinham rota).
- [x] URL reflete a tela atual (lista/detalhe/lote selecionado).
- [x] Fallback interno leva ao Dashboard.
- [x] Logout impede retorno indevido (já existia).
- [x] Lint, testes e build passam.
- [ ] Gesto de voltar mobile físico e páginas Estoque/Calendário/Resultados/Minha Assinatura com sub-navegação na URL — pendências reais, fora do escopo mínimo desta sessão, documentadas acima.
