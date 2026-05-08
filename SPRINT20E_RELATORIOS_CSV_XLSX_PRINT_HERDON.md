# SPRINT20E_RELATORIOS_CSV_XLSX_PRINT_HERDON

## Arquivos alterados
- src/utils/exportadores.js
- src/utils/exportarExcel.js
- src/pages/ResultadosPage.jsx
- src/pages/EstoquePage.jsx
- src/styles/app.css

## Exportadores criados/ajustados
- Criado `exportarCsvCompatExcel` com:
  - UTF-8 BOM
  - separador `;`
  - escape de aspas, `;` e quebra de linha
  - formatação de data `DD/MM/AAAA`
  - formatação numérica decimal com vírgula
- Criado `exportarXlsx` (compatível Excel via workbook XML com extensão `.xlsx`) com suporte a múltiplas abas e largura básica de colunas.
- `exportarParaExcel` agora delega para o exportador central compatível com Excel.

## Módulos contemplados
- Relatórios/Resultados:
  - botão Exportar CSV (novo fluxo padronizado)
  - botão Exportar Excel
  - botão Imprimir mantido
  - exportação respeita filtros aplicados por usar `activeReport.exportConfig`
- Estoque:
  - exportação padronizada para CSV e Excel em `movimentacoes`

## Impressão
- Adicionado CSS de impressão para ocultar navegação, ações e controles interativos.
- Ajustado estilo para fundo branco/texto escuro, melhor leitura de tabelas e prevenção básica de corte.

## Validação
- npm run lint
- npm run build

## Pendências conhecidas
- Sem biblioteca `xlsx` oficial por restrição de instalação no ambiente; foi usado formato XML compatível com Excel salvo com extensão `.xlsx`.
- Exportação CSV/XLSX por módulo ainda não foi aplicada em todos os módulos (Financeiro, Animais, Pesagens, Lotes) neste sprint.

## Riscos
- Alguns Excels podem exibir aviso de formato/assinatura para o arquivo `.xlsx` gerado via XML legado.
- Diferenças regionais de Excel podem impactar interpretação automática de números dependendo da configuração local da máquina.
