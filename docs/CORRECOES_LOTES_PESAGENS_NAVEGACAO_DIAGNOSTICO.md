# Diagnóstico — Correções em Lotes, Pesagens, Nutrição e Navegação

Diagnóstico por item antes de alterar (mandado pelo sprint). Marca o que já foi
corrigido nesta rodada, o que precisa de trabalho de UI com verificação em
navegador, e o que precisa de confirmação de regra antes de mexer.

## Achado central (raiz de vários P0)

**Dupla contabilidade `lote.*` vs `animais.*`.** As telas leem indicadores de
duas fontes que podiam divergir:
- `calcLote` (`src/utils/calculations.js`) e `getResumoLote` calculavam a partir
  de `animais[].qtd` e `animais[].p_at`.
- `PesagensPage.recalculateLoteFromPesagens` e os fluxos de movimentação
  atualizam `lote.p_at`/`lote.qtd`, **mas não** `animais[].*`.

Resolvido nesta rodada: peso atual segue as pesagens (fonte única); cabeças
ativas seguem `lote.qtd` (fonte canônica), com as médias ponderadas internas
(peso de entrada, dias, GMD por sexo) preservadas sobre a base real dos
registros de `animais` para não ficarem matematicamente erradas quando as duas
fontes divergirem (ver `totalAnimaisRegistrados` em `calculations.js`).

## Status por item

| Item | Prioridade | Causa raiz | Status |
|------|-----------|-----------|--------|
| 3.3 Peso atual travado no de entrada | P0 | `calcLote.pesoAtualMedio` lia só `animais.p_at` | ✅ **corrigido** |
| 3.4 Visão geral divergente | P0 | fontes divergentes (peso e cabeças) | ✅ **corrigido** (peso + cabeças); GMD/arrobas ainda somam sobre `animais` sem sincronizar com `lote.qtd` — ver limitação abaixo |
| 3.5 Centralizar indicadores do lote | P1 | cálculos independentes | ✅ peso e cabeças centralizados em `calcLote`/`pesoMedioAtualDoLote` |
| 3.1 Data padrão na pesagem | P1 | `PesagemForm` iniciava `data: ''` | ✅ **corrigido** |
| 3.2 Primeira pesagem = peso de entrada | P0 | criação de lote não semeava pesagem inicial | ✅ **corrigido** (`buildPesagemInicialPatch`, só na criação) |
| 1.1 Ações inconsistentes entre abas | P0 | `VendaLoteModal.jsx` órfão (import quebrado, não usado); ações reais vivem em `components/lotes/*Modal.jsx` | 🟡 achado documentado; padronização completa do menu segue pendente (precisa browser) |
| 1.2 Padronizar menu do lote | P1 | menu tem Editar/Pesagem/Venda parcial/Morte/Saída/Finalizar; falta "Ajuste de lotação" e "Trocar de pasto" dedicados no header | 🔎 pendente (precisa validação visual) |
| 1.3 Ajuste de lotação não atualiza cabeças | P0 | `calcLote.totalAnimais` lia `animais.qtd`, que vendas/mortes não sincronizavam | ✅ **corrigido** — `totalAnimais` segue `lote.qtd` |
| 1.4 Trocar lote vinculado a encerrar | P0 | `FechamentoLoteModal` tinha título/botão **"Trocar lote"** mas na verdade encerra/vende o lote (`variant="danger"`) | ✅ **corrigido** — rótulo agora "Finalizar lote"; `MoverPastoModal` (troca de pasto real) já era separado |
| 1.5 Remover "Curral" | P1 | módulo inteiro (página, domínio, rota, nav, permissão, CSS) | ✅ **removido por completo** (mantido só o que é compartilhado com Sincronização: `RegistroRapidoModais`, `useRegistroRapido`) |
| 2.1 Simplificar retirada | P1 | formulário com campos além do necessário | 🔎 pendente (precisa decisão de produto sobre quais campos cortar) |
| 2.2 Morte/perda usa formulário correto | P0 | `RetiradaAnimaisModal` recebia a prop `modo` mas nunca a usava — sempre abria com tipo "Venda" | ✅ **corrigido** — mapeamento `modo→tipo` e título dinâmico |
| 2.3 Finalizar lote com validação própria | P1 | já tinha validação própria (data + motivo obrigatórios) | ✅ já estava correto; só o rótulo (1.4) estava errado |
| 5.1/5.2 Sexo não salvo (cadastro/edição) | P0 | `AnimalForm` grava `'femea'` sem acento; `calcLote` comparava com `'fêmea'` com acento — fêmeas nunca eram contadas em `qtdFemeas`/`gmdFemea` | ✅ **corrigido** — comparação alinhada; fixture de teste que mascarava o bug também corrigido |
| 5.3 Incluir sexo em "Editar lote" | P1 | campo não existia no `LoteForm` (mas a coluna e a persistência já suportavam) | ✅ **corrigido** — campo adicionado (Não informado/Macho/Fêmea/Misto) |
| 6.1 Preservar última página | P1 | sem persistência de rota | 🔎 pendente — precisa browser autenticado (sem credenciais nesta sessão) |
| 6.2 Botão voltar derruba app | P0 | não reproduzido | 🔎 pendente — precisa browser autenticado |
| 6.3 Preservar estado de navegação | P1 | idem | 🔎 pendente |
| 7.1 Confirmação após cadastro | P1 | infraestrutura (`useToast`) já existia | ✅ já usada pelos handlers que persistem (LotesPage/PesagensPage) |
| 7.2 Formulário aberto após salvar | P0 | `onSave`/`onSubmit` não eram aguardados; sem loading | ✅ **corrigido** em PesagemForm, LoteForm, RetiradaAnimaisModal, MoverPastoModal, FechamentoLoteModal (`useSubmitOnce`) |
| 7.3 Idempotência / duplo envio | P1 | sem trava de submissão | ✅ **corrigido** — mesmo mecanismo do 7.2 (`criarTravaSubmissao`) |
| 4.1 Duração estimada (Nutrição) | P2 | ver auditoria detalhada abaixo | 📋 **auditado, não implementado** (fórmula ainda não confirmada pelo usuário) |

## Corrigido nesta rodada (com teste/validação)

1. **Peso atual médio** segue a pesagem de lote válida mais recente
   (`pesoMedioAtualDoLote`), fallback para o peso dos animais.
2. **Cabeças ativas** seguem `lote.qtd` (fonte canônica); médias ponderadas
   internas preservadas sobre a base real de `animais` para não distorcer
   quando as fontes divergem.
3. **Data de hoje por padrão** na nova pesagem (`PesagemForm`), local, editável.
4. **Primeira pesagem = peso de entrada** — semeada só na criação do lote,
   nunca retroativamente; não cria nada sem `p_ini` informado.
5. **Anti-duplicidade e confirmação (Fase 5)** — `useSubmitOnce`/`submitGuard`
   aplicados a `PesagemForm`, `LoteForm`, `RetiradaAnimaisModal`,
   `MoverPastoModal`, `FechamentoLoteModal`: botão desabilita/mostra loading,
   `onSave` é aguardado, erro mantém o form aberto com dados preservados,
   sucesso fecha (decisão do componente pai, que já só fechava após sucesso).
6. **Módulo Curral removido por completo** — página, domínio, rota, item de
   nav, permissão e CSS exclusivos. `RegistroRapidoModais`/`useRegistroRapido`
   preservados (usados pela Sincronização).
7. **Bug 2.2 corrigido** — `RetiradaAnimaisModal` agora usa a prop `modo` para
   pré-selecionar o tipo (venda/morte/saída) e o título do modal.
8. **Bug 1.4 corrigido** — `FechamentoLoteModal`/botão que o abre renomeados de
   "Trocar lote" para "Finalizar lote" (a lógica já era de encerramento; só o
   rótulo enganava).
9. **Bug 5.1/5.2 corrigido** — `calcLote` comparava `'fêmea'` (com acento);
   valor real gravado pela UI é `'femea'` (sem acento). Teste que mascarava o
   bug (fixture com acento) corrigido junto.
10. **Campo sexo adicionado ao `LoteForm`** (5.3).

## Limitações remanescentes documentadas

- **GMD e `arrobasProduzidas`/`qtdMachos`/`qtdFemeas`** ainda somam sobre os
  registros de `animais`, que não são decrementados por vendas/mortes/
  transferências (só `lote.qtd` é). Se uma venda parcial não for refletida em
  `animais`, essas somas absolutas ficam otimistas (as médias em si — GMD,
  peso — continuam corretas, só as somas totais). Corrigir isso exigiria
  sincronizar a escrita (`registrarSaidaAnimal`/`registrarEntradaAnimal` em
  `src/services/movimentacoes.js`) para também atualizar `animais.qtd`, o que
  é um refactor maior, fora do escopo desta rodada.
- **1.1/1.2 (padronizar menu do lote)**: achado concreto documentado
  (`VendaLoteModal.jsx` é código órfão com import quebrado, nunca usado —
  não removido nesta rodada por estar fora do escopo pedido); redesenho
  completo do menu do lote precisa de validação visual.
- **2.1 (simplificar formulário de retirada)**: não simplificado — precisa de
  decisão de produto sobre quais campos cortar, não é um bug per se.
- **6.x (navegação)**: não foi possível reproduzir em navegador autenticado
  nesta sessão (sem credenciais). Ver seção própria.

## Auditoria — 4.1 Duração estimada do ciclo (Nutrição)

**Não implementado — apenas levantamento, conforme mandado pelo sprint.**

### Fórmula atual encontrada
```js
// src/domain/calcHelpers.js
calculateEstimatedDays(pesoInicial, pesoAlvo, gmdEsperado):
  ganho = pesoAlvo - pesoInicial
  return (ganho <= 0 || gmd <= 0) ? 0 : ganho / gmd
```
Ou seja: **dias até atingir o peso alvo**, dado o GMD esperado — uma fórmula de
ciclo de ENGORDA, não de plano de suplementação.

### Onde é usada
- `LoteForm.jsx::calcularPlanejamento` — calcula `dias_estimados` e
  `dataPrevistaSaida = entrada + dias_estimados`, salvos no lote no cadastro/edição.
- `LoteOverviewTab.jsx` — exibe como **"Dias estimados"**.
- `LoteNutricaoTab.jsx` — exibe como **"Meta de dias"**, mas usando
  `lote.dias_estimados || lote.supl_meta_dias` (dois campos diferentes por trás
  do mesmo rótulo, veja abaixo).

### Divergência encontrada
`supl_meta_dias` é um campo **independente** (input próprio no cadastro do
lote, default 30, ou herdado de `dias_estimados` só na criação inicial) —
representa "por quantos dias o produtor planeja fornecer esta dieta", que pode
ser diferente do ciclo de engorda inteiro. Porém `consumo_total_estimado`
(que dirige o **custo estimado total** exibido) é calculado como:
```
consumoTotalEstimado = consumoKgDiaPorAnimal * quantidade * diasEstimados
```
usando **`diasEstimados`** (peso-alvo/GMD), não `supl_meta_dias`. Ou seja: o
produtor pode configurar "planejo suplementar por 45 dias" mas o custo total
estimado exibido é calculado sobre o número de dias do ciclo de engorda
inteiro (que pode ser bem diferente), sem isso ficar claro na tela.

### Achado adicional (duplicação de código)
`src/components/loteFormLogic.js` contém uma **segunda implementação completa**
de `calcularPlanejamento`/`normalizarInitialData`/`validarForm`, com a mesma
lógica de `LoteForm.jsx`, mas **não é importada por nenhum arquivo** — código
órfão, provavelmente de uma tentativa anterior de extrair a lógica do
componente que não foi finalizada. Não removido nesta rodada (fora do escopo
deste item), mas documentado para limpeza futura.

### Decisão necessária (não posso decidir sozinho — regra de negócio)
1. **"Meta de dias" na aba Nutrição deveria mostrar `dias_estimados` (ciclo de
   engorda) ou `supl_meta_dias` (plano de suplementação)?** Hoje mistura os
   dois sob o mesmo rótulo.
2. **`consumo_total_estimado`/custo total devem ser calculados sobre
   `dias_estimados` ou sobre `supl_meta_dias`?** Atualmente sempre usa
   `dias_estimados`, ignorando silenciosamente o valor que o produtor
   configurou em "meta de dias" de suplementação.
3. Uma vez confirmada a regra correta, a fórmula deve ser centralizada em um
   único lugar (hoje há duas cópias: `LoteForm.jsx` e o órfão `loteFormLogic.js`).

## Navegação — 6.1/6.2/6.3 (causa raiz encontrada por código; não implementado)

Não foi possível autenticar no app nesta sessão (sem credenciais) para
reproduzir visualmente a queda relatada. Encontrei, por leitura de código, uma
causa raiz concreta e plausível — mas não implementei a correção sem poder
verificá-la visualmente (o padrão é usado por várias páginas; uma correção
parcial e não testada arrisca introduzir uma regressão de navegação maior que
o bug original).

### Causa raiz encontrada
`App.jsx` já trata `popstate` corretamente no nível de PÁGINA
(`window.addEventListener('popstate', ...)` → `setCurrentPage(getPageFromPathname(...))`,
e `navigateWithPermission` já faz `window.history.pushState` a cada troca de
página). O problema é um nível abaixo: dentro de cada página, a seleção de um
item (ex.: `LotesPage.jsx::selectedLoteId`, que controla se a tela mostra a
listagem ou o detalhe de um lote) é um `useState` **puramente local**, nunca
refletido na URL nem no histórico do navegador:

```js
const [selectedLoteId, setSelectedLoteId] = useState(null); // LotesPage.jsx
```

Consequência: abrir o detalhe de um lote **não** empurra uma entrada no
histórico (a URL continua `/lotes`). Se o usuário aperta "voltar" estando na
tela de detalhe, o `popstate` do navegador volta para a página anterior a
`/lotes` (ex.: Dashboard) — pulando inteiramente a listagem de lotes — enquanto
`selectedLoteId` (estado interno do componente) permanece com o valor antigo,
podendo deixar a UI momentaneamente inconsistente com a "página" que o
navegador acha que está mostrando. Isso bate com os sintomas relatados:
"perde o estado", "volta para rota incorreta", "cai numa tela diferente da
esperada".

**Esse mesmo padrão (estado de seleção/aba sem sincronização com a URL) existe
em pelo menos 5 páginas**: `LotesPage.jsx`, `EstoquePage.jsx`,
`CalendarioOperacionalPage.jsx`, `ResultadosPage.jsx`,
`MinhaAssinaturaPage.jsx` — não é específico de Lotes.

### Por que não implementei a correção agora
Corrigir isso corretamente significa sincronizar a seleção com a URL (query
string, ex.: `?lote=123&tab=pesagens`) ou empurrar `pushState` local ao entrar
no detalhe e tratar o `popstate` correspondente. Isso toca a arquitetura de
navegação usada por várias páginas — uma mudança de alto risco para aplicar
"às cegas". Corrigir só em `LotesPage.jsx` seria parcial e inconsistente com o
resto do app, e eu não teria como confirmar visualmente que não quebrei o
próprio botão voltar em outro fluxo.

### Recomendação para quando houver acesso ao navegador autenticado
1. Reproduzir exatamente: abrir um lote → trocar de aba → apertar voltar do
   navegador → confirmar o comportamento (pula a listagem? mostra tela em
   branco? perde a fazenda?).
2. Se confirmado, sincronizar `selectedLoteId`/`activeTab` (e o padrão
   equivalente nas outras 4 páginas) com `URLSearchParams`, tratado por um
   hook único reutilizável (evita reimplementar em cada página).
3. Testar explicitamente: voltar da edição para detalhes, dos detalhes para a
   listagem, entre abas, após salvar, após trocar de fazenda, PWA/mobile.

## Validação visual

Não realizada de forma autenticada nesta sessão (sem credenciais). Validado:
app sobe sem erros de console na tela pública de login; lint, testes (1104) e
build aprovados após cada mudança.
