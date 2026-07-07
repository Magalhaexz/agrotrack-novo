# Sprint 19 — Exportação de Relatórios (CSV/Impressão)

## Objetivo

Dar ao HERDON capacidade de sair do app: exportar dados de Resultado por Lote, Financeiro/DRE, Estoque, Sanidade e Central de Alertas em CSV e impressão/PDF via navegador, com uma base reutilizável para próximos relatórios.

## Por que era P0

A Sprint 13 apontou que **nenhum relatório do HERDON podia ser exportado** — sem PDF, sem CSV, sem impressão — o que trava uso profissional por produtor, gestor, contador, comprador ou banco. Esse achado virou o item BM-31 do backlog.

## Achado principal desta sprint: BM-31 estava parcialmente desatualizado

Antes de escrever qualquer código, a Etapa 1 (auditoria) encontrou que **BM-31 não estava mais totalmente correto**: em algum momento entre a Sprint 13 e esta sprint, infraestrutura de exportação real já tinha sido construída e conectada, sem que o backlog fosse atualizado:

- `src/utils/exportarPDF.js` — impressão/PDF via `window.open` + `window.print()`, com cabeçalho HERDON, rodapé e CSS de impressão embutido. Já usado por `AcoesRelatorio.jsx`.
- `src/components/relatorios/AcoesRelatorio.jsx` — barra de ações (baixar PDF, copiar resumo, WhatsApp), já plugada em **6 páginas**: `LotesPage`, `RelatorioLotePage`, `RelatorioFinanceiroPage`, `RelatorioPastagensPage`, `RelatorioPesagensPage`, `RelatorioResumoGeralPage`. Gate comercial (`writeGuard`) já aplicado: exportar exige plano ativo.
- `src/utils/exportadores.js` — `exportarCsvCompatExcel`/`exportarExcelXmlCompat`, CSV com BOM UTF-8 e delimitador `;`, mais um formato XLS via XML compatível com Excel (sem biblioteca externa). Já usado por `EstoquePage` (movimentações) e **`ResultadosPage`** — que por sua vez já é um hub completo com filtros (período/fazenda/lote/status), 6 tipos de relatório (lote, fazenda, sanitário, estoque, financeiro, desempenho) e botões "Imprimir"/"Exportar Excel"/"Exportar CSV" já funcionais.

**Conclusão da auditoria:** Resultado por Lote e Financeiro já tinham cobertura real de CSV+impressão via `ResultadosPage`/`RelatorioLotePage`/`RelatorioFinanceiroPage`; Estoque tinha CSV parcial (só movimentações); **Sanidade e Central de Alertas não tinham exportação nenhuma**, em nenhuma página. Isso mudou o escopo real desta sprint: em vez de construir do zero, a sprint reforça pontos fracos, fecha os dois gaps completos e cria uma camada testável para as próximas exportações.

## Decisão de arquitetura: dois helpers de CSV coexistindo (documentado, não é duplicação acidental)

O módulo `src/utils/exportadores.js` (existente) mistura geração de string CSV com o download (chama `document.createElement`/`URL.createObjectURL` direto), o que o torna **não testável** no test runner deste projeto (`node:test`, sem DOM/jsdom configurado). Em vez de arriscar refatorar um helper já usado em produção por `EstoquePage`/`ResultadosPage`, esta sprint criou `src/domain/exportacaoRelatorios.js` — a versão pura e testada (Etapa 3/4 do escopo original), usada por todas as integrações novas desta sprint. `src/utils/exportadores.js` continua existindo e funcionando exatamente como antes, sem nenhuma alteração — ver `docs/HERDON_RELATORIOS_EXPORTACOES.md` para quando usar cada um.

## O que foi criado

| Arquivo | Papel |
|---|---|
| `src/domain/exportacaoRelatorios.js` | Puro: `sanitizarValorExportacao`, `gerarCsv`, `formatarMoedaExportacao`, `formatarNumeroExportacao`, `formatarDataExportacao`, `montarNomeArquivo`, `montarTabelaRelatorio`. |
| `src/domain/exportacaoRelatorios.test.js` | 20 casos — CSV (cabeçalho, aspas, delimitador, quebra de linha, `undefined`/`null`/`NaN`/`Infinity`, accessor, lista vazia), moeda, número, data válida/inválida, nome de arquivo, objeto padronizado. |
| `src/utils/exportacaoArquivos.js` | I/O: `baixarTextoComoArquivo`, `baixarCsv` (BOM UTF-8), `abrirRelatorioParaImpressao` (nova janela com tabela HTML gerada a partir de colunas/linhas — complementa `exportarPDF.js`, que espera um elemento DOM já renderizado). |
| `src/components/ExportActions.jsx` | Botões "Exportar CSV" / "Imprimir / PDF", mesmo gate comercial de `AcoesRelatorio` (`writeGuard`), desabilita quando não há dados. |
| Ícone `Printer` em `src/lucide-react.js` | O projeto não usa o pacote `lucide-react` real — reimplementa os ícones usados via SVG mínimo; faltava um ícone de impressora. |

## Relatórios contemplados

| Relatório | Antes desta sprint | Depois |
|---|---|---|
| **Resultado por Lote** | CSV existia em `ResultadosPage`, mas só exportava 4 de ~11 colunas (`lote, fazenda, animais, margem`) vs. a tabela em tela | CSV agora inclui todos os indicadores da tabela: lote, fazenda, status, animais, peso médio, GMD, custo total, receita total, lucro, **custo/@ carcaça, lucro/@ carcaça** (labels oficiais da Sprint 14), lucro/cabeça, decisão de venda. Impressão já existia (`window.print()` + `RelatorioLotePage` via `AcoesRelatorio`) |
| **Financeiro/DRE** | `FinanceiroPage` (a página real de DRE) não tinha nenhuma exportação; só `RelatorioFinanceiroPage` (relatório separado) tinha PDF | CSV + impressão adicionados à aba DRE de `FinanceiroPage`: resumo geral, evolução mensal (receita/despesa/saldo por mês) e despesa por categoria — mesmos números de `computeDRE()`, nada recalculado |
| **Estoque** | CSV só para movimentações (`EstoquePage`), sem exportação da lista de itens, sem impressão | CSV + impressão adicionados para a lista de itens: item, categoria, unidade, quantidade atual, mínimo, validade, status. CSV de movimentações mantido como estava |
| **Sanidade** | Nenhuma exportação | CSV + impressão novos: lote, tipo/procedimento, descrição, **produto vinculado** (nome resolvido via `metadata.item_estoque_id`), **quantidade utilizada** (produto, `metadata.quantidade_utilizada`), **cabeças tratadas** (`qtd` — nunca confundido com quantidade utilizada), data de aplicação, próxima aplicação, fim da carência, status |
| **Central de Alertas** | Nenhuma exportação | CSV + impressão novos, a partir de `alertasFiltrados` (mesma lista renderizada na tela — filtros de origem/prioridade/prazo/lote/busca + filtro de tratativa já aplicados, sem duplicar lógica de filtro): título, origem, prioridade, prazo, data de referência, lote, status de tratativa, ação recomendada |

## Formato CSV adotado

- Delimitador `;` (convenção brasileira — Excel PT-BR usa `,` como separador decimal).
- BOM UTF-8 no início do arquivo (acentuação abre corretamente no Excel).
- Quebra de linha `\r\n` entre registros (padrão RFC 4180).
- Aspas duplas escapam célula que contenha `;`, `"` ou quebra de linha; quebra de linha **dentro** de uma célula é substituída por espaço antes disso — o CSV gerado nunca tem uma linha física a mais por causa do conteúdo de uma célula.
- `null`/`undefined`/`NaN`/`Infinity` sempre viram string vazia — nunca aparece a palavra `"undefined"`, `"null"`, `"NaN"` ou `"Infinity"` num arquivo exportado.
- Nome de arquivo: `herdon-<prefixo>[-<fazenda>]-AAAA-MM-DD.csv` (`montarNomeArquivo`).

## Impressão/PDF via navegador

Duas variantes coexistindo, ambas via `window.print()`, nenhuma biblioteca de PDF instalada (decisão consciente — ver seção seguinte):

1. **A partir de um elemento já renderizado** (`src/utils/exportarPDF.js`, pré-existente): usado quando a página já tem uma visão "bonita" pronta para imprimir (`RelatorioLotePage`, `LotesPage` etc., via `AcoesRelatorio`).
2. **A partir de colunas/linhas** (`abrirRelatorioParaImpressao`, novo): usado pelas integrações desta sprint (Sanidade, Central de Alertas, Estoque-itens, Financeiro-DRE) — gera a própria tabela HTML, com cabeçalho HERDON, metadados (ex.: total exportado), rodapé "Relatório gerado pelo HERDON" e data/hora de emissão. Mensagem de aviso se pop-up estiver bloqueado.

`ResultadosPage` mantém seu botão "Imprimir" existente, que usa `window.print()` direto na página atual (com CSS de impressão já existente em `app.css`, ver abaixo) — não foi alterado.

## Por que não foi instalada biblioteca de PDF

A regra da sprint pedia justificar antes de adicionar dependência para PDF e preferir impressão via navegador se mais seguro. Como o projeto **já tinha** a abordagem de impressão via navegador funcionando e em produção (`exportarPDF.js`, 6 páginas), e como `window.print()` cobre o caso de uso (usuário salva como PDF pelo próprio navegador, sem custo de bundle nem dependência nova), não havia motivo para avaliar `jsPDF` ou similar. Nenhuma biblioteca nova foi instalada.

## CSS de impressão (Etapa 12)

Não foi necessário criar `src/styles/print.css`. `src/styles/app.css` já tem um bloco `@media print` (fundo branco, texto preto, esconde sidebar/header/botões/`.no-print`, evita quebra de tabela no meio) que cobre genericamente qualquer página — não é específico de uma tela. `ExportActions` usa a classe `no-print` (mesmo padrão de `AcoesRelatorio`), então os próprios botões de exportação já somem ao imprimir sem CSS adicional. A rota `abrirRelatorioParaImpressao` (nova janela) tem estilo 100% inline, independente de `app.css`.

## Estados vazios e segurança (Etapa 13)

- Os 4 botões `ExportActions` recebem `disabled={lista.length === 0}` — nunca é possível gerar um arquivo vazio sem aviso; o botão simplesmente não é clicável (com `title` explicando o motivo).
- `abrirRelatorioParaImpressao` tem um fallback defensivo ("Não há dados para este relatório.") caso seja chamada com lista vazia por outro caminho no futuro.
- Nenhuma coluna exportada inclui `owner_user_id`, token, e-mail ou ID técnico interno (`item_estoque_id`, `alerta_id` etc. são usados só para *lookup* de nome, nunca exportados como coluna).
- Central de Alertas exporta exatamente `alertasFiltrados` — nunca a lista completa por baixo do filtro aplicado, e nunca duplica a lógica de `filtrarAlertasCentral`/`aplicarTratativasAosAlertas` já existente.

## Regras de negócio: nenhuma tocada

- Cálculo de arroba (Sprint 14): não alterado — `custoPorArroba`/`lucroPorArroba` só foram **expostos** no CSV, já vinham prontos de `getResumoLote`.
- Integração Sanidade/Estoque (Sprint 15): não alterada — exportação só lê `metadata.item_estoque_id`/`metadata.quantidade_utilizada`, nunca escreve.
- Tratativas de alerta (Sprint 16): não alteradas — exportação só lê o resultado já filtrado de `aplicarTratativasAosAlertas`.
- Nenhuma migration criada.

## BM-31: status final

**Parcialmente resolvido → resolvido para o escopo desta sprint.** Os 5 relatórios pedidos (Resultado por Lote, Financeiro/DRE, Estoque, Sanidade, Central de Alertas) têm CSV e impressão/PDF funcionais. Relatórios fora do escopo desta sprint (Comparativo de Lotes, Evolução do Rebanho, Pastagens — via `RelatorioPastagensPage`, já coberto) ficam para uma leva futura, usando a mesma base (`exportacaoRelatorios.js`/`exportacaoArquivos.js`/`ExportActions.jsx`).

## Validações executadas

- `npm run lint` — limpo.
- `npm test -- --run` — **942/942** (922 anteriores + 20 novos de `exportacaoRelatorios.test.js`).
- `npm run build` — ok; Dashboard, Resultado por Lote, Financeiro/DRE, Estoque, Sanidade, Central de Alertas e Telegram (`api/`) todos compilam.
- Validação visual: só a tela de Login pôde ser exercitada ao vivo nesta sessão (sem credencial de teste — mesma limitação de todas as sprints anteriores desde a 13). As integrações de exportação foram verificadas por leitura de código e pelos 20 testes do domínio puro, não por clique real nos botões.

## Limitações restantes

- Comparativo de Lotes e Evolução do Rebanho (páginas recém-adicionadas ao menu na Sprint 18) ainda não têm exportação própria.
- Sem validação visual ao vivo dos botões novos (sem credencial de teste nesta sessão) — risco residual: um erro de runtime só apareceria ao clicar de fato em produção/preview com dados reais.
- `src/utils/exportadores.js` (helper legado) e `src/domain/exportacaoRelatorios.js` (helper novo) coexistem por decisão deliberada (ver seção de arquitetura) — uma consolidação futura exigiria migrar `EstoquePage`/`ResultadosPage` para o novo helper com teste de regressão visual, fora do orçamento desta sprint.
- Impressão é sempre "o navegador decide o PDF" (via diálogo de impressão) — não há um PDF gerado no servidor nem customização de layout além do que CSS de impressão permite.
