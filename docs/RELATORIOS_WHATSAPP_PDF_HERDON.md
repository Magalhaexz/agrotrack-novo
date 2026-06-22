# Compartilhamento de Relatórios — PDF e WhatsApp (Sprint 24)

## PDF

Não foi adicionada nenhuma biblioteca de PDF (`jspdf`/`html2canvas` continuam fora do projeto). O botão **Baixar PDF** reaproveita a função já existente `exportarRelatorio()` (`src/utils/exportarPDF.js`):

1. Abre uma nova janela com o conteúdo do relatório (cabeçalho HERDON + título + fazenda + data de geração + rodapé).
2. Chama `window.print()`, deixando o usuário escolher "Salvar como PDF" na caixa de impressão do navegador.

Cada página de relatório envolve seu conteúdo num `<div ref={containerRef}>` — é esse elemento que é impresso. Botões de ação ficam fora do `ref` e têm a classe `no-print`, então não aparecem no PDF.

## Resumo por WhatsApp

`src/domain/whatsappResumo.js` gera um texto curto por tipo de relatório (ex.: `gerarResumoLoteTexto()`), no formato:

```
HERDON — Resumo do Lote

Lote: Recria Machos 2026
Fazenda: Fazenda Santa Clara
Cabeças: 80
Peso médio atual: 342,0 kg
GMD: 0,92 kg/dia
Resultado estimado: R$ 18.500,00
Status: Em lucro
```

`src/utils/compartilhar.js` oferece:

- `copiarTexto()` — copia para a área de transferência (Clipboard API, com fallback de `textarea` + `execCommand`).
- `compartilharResumo()` — tenta a Web Share API nativa (`navigator.share`), comum em celulares.
- `abrirWhatsApp()` — abre `https://wa.me/?text=...` com o resumo já preenchido, usado quando a Web Share API não está disponível ou é cancelada.

O componente `AcoesRelatorio.jsx` (`src/components/relatorios/`) é a barra de ações comum a todos os relatórios e decide automaticamente entre Web Share e o link do WhatsApp.

## Por que não anexar o PDF automaticamente

Anexar um arquivo PDF diretamente a uma mensagem do WhatsApp a partir do navegador é instável entre browsers/dispositivos. O comportamento adotado (igual ao escopo da sprint) é: PDF para baixar de um lado, resumo em texto para colar/enviar de outro — dois fluxos simples e previsíveis.

## Pendência futura

Anexar o PDF automaticamente é viável apenas em um app mobile nativo (Share Sheet do sistema), não no navegador. Fica registrado como pendência futura.
