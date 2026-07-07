# HERDON — Padrão de Exportação de Relatórios

Referência para adicionar exportação (CSV/impressão) a uma página nova. Ver [SPRINT19_EXPORTACAO_RELATORIOS.md](SPRINT19_EXPORTACAO_RELATORIOS.md) para o histórico completo da decisão.

## Dois helpers de CSV — qual usar

O projeto tem **dois** módulos com propósito equivalente, por razões históricas:

| | `src/utils/exportadores.js` (legado) | `src/domain/exportacaoRelatorios.js` + `src/utils/exportacaoArquivos.js` (oficial a partir da Sprint 19) |
|---|---|---|
| Usado por | `EstoquePage` (movimentações), `ResultadosPage` | Sanidade, Central de Alertas, Estoque (itens), Financeiro/DRE |
| Testável | Não (mistura geração de CSV com `document.createElement`, sem DOM no test runner) | Sim — `gerarCsv` é pura, testada em `exportacaoRelatorios.test.js` |
| Delimitador | `;` | `;` (mesmo padrão) |

**Para páginas novas: use sempre `src/domain/exportacaoRelatorios.js` + `src/utils/exportacaoArquivos.js`.** Não migre `EstoquePage`/`ResultadosPage` para o helper novo sem necessidade — funcionam, e trocar exige teste de regressão visual fora do escopo de uma mudança pontual.

## Como adicionar exportação a uma página nova

1. **Importe os 3 blocos:**
   ```js
   import ExportActions from '../components/ExportActions';
   import { formatarDataExportacao, formatarMoedaExportacao, montarNomeArquivo } from '../domain/exportacaoRelatorios';
   import { baixarCsv, abrirRelatorioParaImpressao } from '../utils/exportacaoArquivos';
   ```

2. **Defina as colunas** — array de `{ key, label, accessor? }`. `accessor` é opcional; se ausente, o valor vem de `linha[key]`. Formate moeda/número/data dentro do `accessor`, nunca deixe o valor bruto:
   ```js
   const colunas = [
     { key: 'nome', label: 'Item' },
     { key: 'validade', label: 'Validade', accessor: (linha) => formatarDataExportacao(linha.data_validade) },
     { key: 'valor', label: 'Valor', accessor: (linha) => formatarMoedaExportacao(linha.valor_total) },
   ];
   ```

3. **Escreva os dois handlers**, sempre a partir dos dados **já filtrados/exibidos na tela** (nunca da lista completa por baixo de um filtro):
   ```js
   function exportarCsv() {
     baixarCsv({ colunas, linhas: dadosFiltrados, nomeArquivo: montarNomeArquivo({ prefixo: 'nome-do-relatorio' }) });
   }

   function imprimir() {
     abrirRelatorioParaImpressao({
       titulo: 'Título do Relatório',
       subtitulo: 'Contexto/filtro aplicado, se houver',
       colunas,
       linhas: dadosFiltrados,
       metadados: { 'Total': dadosFiltrados.length }, // opcional
     });
   }
   ```

4. **Renderize o componente**, sempre com `disabled` quando não há dados:
   ```jsx
   <ExportActions
     disabled={dadosFiltrados.length === 0}
     onExportCsv={exportarCsv}
     onPrint={imprimir}
   />
   ```

## Cuidados com dados sensíveis

- **Nunca** inclua nas colunas: `owner_user_id`, token, e-mail de outro usuário, senha, dado de outra conta.
- IDs técnicos (`item_estoque_id`, `alerta_id`, `lote_id`) servem só para *lookup* (achar o nome correspondente via `Map`) — nunca exponha o ID cru como coluna, a menos que seja genuinamente útil para o usuário (ex.: número de protocolo).
- `ExportActions` já aplica o mesmo gate comercial de `AcoesRelatorio` (`services/writeGuard`) — exportar exige plano ativo, consistente com o resto do produto. Não crie um caminho de exportação que pule esse gate.
- RLS do banco já isola por conta (`same_account`) — a exportação lê `db` (já carregado e filtrado por conta), nunca faz uma query própria sem esse filtro.

## Padrão de nome de arquivo

`montarNomeArquivo({ prefixo, fazendaNome, data })` → `herdon-<prefixo>[-<fazenda>]-AAAA-MM-DD.csv`. `prefixo` e `fazendaNome` passam por slug automático (sem acento, minúsculo, hífen). `data` é opcional (usa hoje por padrão) — passe a data de referência do relatório quando fizer sentido (ex.: último dia do período filtrado).

## Padrão de impressão/PDF

- **Página já tem uma visão pronta para imprimir** (preview com cards/gráficos formatados)? Use `AcoesRelatorio` (`src/components/relatorios/AcoesRelatorio.jsx`) com um `containerRef` apontando pro bloco a imprimir — gera PDF via `exportarPDF.js`. Também oferece "copiar resumo" e "compartilhar no WhatsApp" (Sprint 4), então usa uma função `getTexto` além do `containerRef`.
- **Página não tem preview pronto, só uma tabela de dados**? Use `abrirRelatorioParaImpressao` (`ExportActions`), que monta a tabela HTML sozinho a partir de `colunas`/`linhas`.
- Nunca instale biblioteca de PDF (`jsPDF` etc.) sem justificar antes — `window.print()` (o navegador gera o PDF via "Salvar como PDF") já cobre o caso de uso sem dependência nova.
- Todo relatório impresso tem: cabeçalho "HERDON", título, data/hora de emissão, rodapé "Relatório gerado pelo HERDON". Não repita esse HTML manualmente — vem de `abrirRelatorioParaImpressao`/`exportarPDF.js`.

## Estados vazios

Sempre passe `disabled={lista.length === 0}` para `ExportActions`. Não é necessário mostrar uma mensagem própria — o botão desabilitado com `title="Não há dados para exportar."` já comunica isso; se a página já tem um `EmptyState` cobrindo a ausência de dados, isso já é suficiente e não deve ser duplicado.

## CSS de impressão

Já existe em `src/styles/app.css` (`@media print`), genérico para toda a aplicação (esconde sidebar/header/botões, fundo branco). A classe `no-print` (já usada por `ExportActions`) esconde qualquer elemento ao imprimir. Só crie CSS de impressão específico se uma página tiver uma necessidade visual que o bloco genérico não cobre — documente o motivo se isso acontecer.
