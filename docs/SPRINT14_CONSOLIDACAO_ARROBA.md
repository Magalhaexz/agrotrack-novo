# Sprint 14 — Consolidação do Cálculo de Arroba + Reconciliação de Migrations

## Problema encontrado na Sprint 13

Custo por arroba e lucro por arroba eram calculados com bases diferentes: `resumoLote.js` computava `custoPorArroba = custoTotal / arrobasProduzidas` (arroba de **ganho**, sem rendimento de carcaça, vinda de `utils/calculations.js`) e `lucroPorArroba = lucroTotal / arrobasCarcaca` (arroba de **carcaça**, vinda de `calculos.js`) — os dois exibidos lado a lado nas mesmas telas (Resultado de Lote, Financeiro, relatórios) como se fossem comparáveis. Ao todo, 8 arquivos tinham implementações independentes de "arroba"/custo-por-arroba, com pelo menos 3 definições distintas (peso vivo, carcaça, ganho).

## Decisão oficial

Documentada em [DECISAO_CALCULO_ARROBA_HERDON.md](DECISAO_CALCULO_ARROBA_HERDON.md): custo/@ e lucro/@ sempre usam **arroba de carcaça**; arroba de peso vivo e arroba de ganho continuam existindo para leitura técnica/zootécnica, mas nunca para decisão econômica; rendimento de carcaça aceita tanto `52` quanto `0.52`.

## Arquivos auditados

`src/domain/arroba.js`, `src/domain/calculos.js`, `src/domain/indicadores.js`, `src/utils/calculations.js`, `src/domain/resumoLote.js`, `src/domain/decisaoVenda.js`, `src/domain/manejoResultado.js`, `src/domain/indicadoresEstrategicos.js`, `src/domain/projecaoCenario.js`, `src/components/VendaLoteModal.jsx`, `src/components/ArrobaPreview.jsx`, `src/hooks/useArroba.js`, e os pontos de exibição em `RelatorioLotePage.jsx`, `ResultadosPage.jsx`, `RelatorioLotePreview.jsx`, `ComparativoPage.jsx`, `FinanceiroPage.jsx`, `whatsappResumo.js`, `respostasAssistente.js` (55 arquivos no total continham a palavra "arroba" — os acima são os que efetivamente calculam ou exibem custo/lucro/arroba; os demais só recebem valores já calculados como prop/parâmetro).

## Arquivos alterados

- **`src/domain/arroba.js`** — adicionadas as funções consolidadas: `normalizarRendimentoCarcaca`, `calcularArrobasPesoVivo`, `calcularArrobasCarcaca`, `calcularArrobasGanho`, `calcularCustoPorArrobaCarcaca`, `calcularLucroPorArrobaCarcaca`, `calcularPrecoVendaPorArrobaCarcaca`. `calcularIndicadoresArroba` (original) mantida sem alteração.
- **`src/domain/calculos.js`** — `calcularResultadoLote` agora expõe `custoPorArroba` (antes só existia em `resumoLote.js`, com base errada) usando as novas funções de `arroba.js`; `arrobaViva`/`arrobasCarcaca`/`custoPorArroba`/`lucroPorArroba` todos derivam da mesma base de carcaça.
- **`src/domain/resumoLote.js`** — `custoPorArroba` passou a vir de `calculos.js` (carcaça), com fallback `safeDivide(custoTotal, arrobasCarcaca)` — mesmo padrão já usado para `lucroPorArroba`. **Este é o fix central da sprint.**
- **`src/domain/decisaoVenda.js`** — `calcularArrobasEstimadas` agora delega para `calcularArrobasCarcaca` (dedup, mesmo resultado).
- **`src/domain/indicadoresEstrategicos.js`** — `calculateTecnicos` (KPI de arrobas vendidas, nível fazenda) passou a reusar `calcularRendimentoCarcaca` (já existente em `indicadores.js`) em vez de reimplementar a mesma conta inline — mudança mecânica, resultado idêntico.
- **Labels corrigidos** (nenhuma mudança de layout, só texto): `RelatorioLotePage.jsx`, `ResultadosPage.jsx`, `RelatorioLotePreview.jsx`, `ComparativoPage.jsx`, `whatsappResumo.js`, `respostasAssistente.js` — ver lista completa abaixo.
- **Testes**: `src/domain/arroba.test.js` (17 casos novos), `src/domain/calculos.test.js` (2 casos novos), `src/domain/resumoLote.test.js` (**novo arquivo** — o módulo não tinha teste antes desta sprint), `tests/whatsappResumo.test.js` (2 asserts atualizados para o novo texto de label).

## Telas impactadas

Resultado de Lote (`RelatorioLotePage`/`RelatorioLotePreview`), Resultados/Ranking de Lotes (`ResultadosPage`), Comparativo de Lotes (`ComparativoPage`), resumo de WhatsApp/PDF (`whatsappResumo.js`) e respostas do assistente por regras (`respostasAssistente.js`). Dashboard, DRE/Financeiro (tabela de lucro/@), Simulador de Cenários e Central de Alertas **não precisaram de alteração de código** — já liam `resumo.lucroPorArroba`/`resumo.custoPorArroba` (ou já eram consistentes internamente, caso do Simulador) e passaram a receber o valor corrigido automaticamente, sem mudança de interface.

## Labels corrigidos (Etapa 6)

| Arquivo | Antes | Depois |
|---|---|---|
| `RelatorioLotePage.jsx` | "Custo por arroba" | "Custo/@ carcaça" |
| `RelatorioLotePage.jsx` | "Lucro por arroba" | "Lucro/@ carcaça" |
| `RelatorioLotePage.jsx` | "Ponto de equilíbrio da arroba" | "Ponto de equilíbrio da @ carcaça" |
| `RelatorioLotePage.jsx` | "Preço-alvo da arroba" | "Preço-alvo da @ carcaça" |
| `RelatorioLotePage.jsx` | "Custo de suplemento/@" | "Custo de suplemento/@ carcaça" |
| `RelatorioLotePage.jsx` | "Arrobas estimadas" | "Arrobas estimadas (carcaça)" |
| `ResultadosPage.jsx` | "Custo/@" | "Custo/@ carcaça" |
| `ResultadosPage.jsx` | "Lucro/@" | "Lucro/@ carcaça" |
| `RelatorioLotePreview.jsx` | "Custo por arroba" | "Custo/@ carcaça" |
| `ComparativoPage.jsx` | "Arrobas/cabeça" | "Arrobas/cabeça (peso vivo)" |
| `whatsappResumo.js` | "Custo/@: ... Lucro/@: ..." | "Custo/@ carcaça: ... Lucro/@ carcaça: ..." |
| `respostasAssistente.js` | "Custo por arroba: ..." | "Custo/@ carcaça: ..." |

**Não alterado, por já estar correto:** "Lucro/@ carcaça" em `FinanceiroPage.jsx` e `ResultadoLoteCard.jsx` já tinha o label certo antes desta sprint. O modal de venda (`VendaLoteModal.jsx`) usa arroba **viva** deliberadamente para a modalidade "venda no vivo" — já rotulado como "@ viva"/"Preço por @" junto ao campo de peso vivo; tratado como decisão de negócio existente, não como ambiguidade a corrigir (documentado em [DECISAO_CALCULO_ARROBA_HERDON.md](DECISAO_CALCULO_ARROBA_HERDON.md)).

## Testes adicionados

- `arroba.test.js`: peso vivo (450kg = 30@), carcaça (450kg 50% = 15@), rendimento 50 e 0.5 com mesmo resultado, ganho (300→450kg 50% = 5@), custo/lucro/preço-venda por arroba de carcaça, divisão por zero, peso/rendimento nulo ou inválido, nunca NaN/Infinity.
- `calculos.test.js`: `custoPorArroba` e `lucroPorArroba` usam a mesma base (arrobasCarcaca); não quebra sem animais.
- `resumoLote.test.js` (novo): confirma que `custoPorArroba` e `lucroPorArroba` retornados por `getResumoLote` usam a mesma base de arrobas — inclui um teste que **detectaria a regressão** caso a base "arroba de ganho" volte a ser usada por engano; não quebra sem animais.

## Resultado dos testes

`npm test -- --run`: **880/880** (862 da Sprint 13 + 18 novos), suite completa incluindo `arroba.test.js`, `calculos.test.js`, `resumoLote.test.js`, `decisaoVenda.test.js`, `manejoResultado.test.js`, `relatorioLote.test.js`, `whatsappResumo.test.js` executados isoladamente antes da suíte completa — nenhuma regressão.

## Riscos

- **Mudança de valor real exibido**: `custoPorArroba` em Resultado de Lote/Financeiro/Ranking agora reflete arroba de carcaça em vez de arroba de ganho — o número exibido muda (fica menor em termos absolutos na maioria dos casos, já que arroba de ganho tende a ser menor que arroba de carcaça do peso total do lote). Essa mudança é o objetivo da sprint, mas é uma mudança de valor real que produtores acompanhando o histórico visualmente vão notar — vale um aviso no changelog do produto, não só nesta doc técnica.
- **`indicadoresEstrategicos.js` segue sem suíte de testes própria** — a alteração ali foi mecânica e matematicamente equivalente (verificada manualmente linha a linha antes da troca), mas o módulo inteiro (KPIs de fazenda, UA, evolução de rebanho) continua sem cobertura automatizada; não é uma regressão desta sprint, é uma lacuna preexistente (já registrada no Backlog Mestre da Sprint 13) que este sprint não tinha escopo para fechar por completo.
- **Migrations**: reconciliação documentada mas não executada (ver [SPRINT14_RECONCILIACAO_MIGRATIONS.md](SPRINT14_RECONCILIACAO_MIGRATIONS.md)) — o risco de ambiente local/staging divergir do remoto continua até alguém autorizar os passos do plano.

## Limitações restantes

- Validação visual (Etapa 10) ficou limitada à tela de login (sem erro no console, sem requisição de rede falha) — **sem credencial de teste disponível nesta sessão**, não foi possível abrir Dashboard, Resultado de Lote, Simulador ou DRE no navegador para confirmar visualmente ausência de `NaN`/`Infinity` e a clareza dos novos labels. A garantia de correção nesta sprint vem dos testes automatizados (880/880) e da revisão de código, não de inspeção visual ao vivo.
- `calculateTecnicos` (indicadoresEstrategicos.js) e o restante do módulo seguem sem teste automatizado dedicado — fora do escopo mínimo desta sprint (que era consolidar a base de cálculo, não fechar toda a dívida de cobertura de testes da Sprint 13).
