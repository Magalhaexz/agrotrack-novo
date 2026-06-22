# Sprint 24 — Resultado

## Funcionalidade entregue

**Relatórios e Compartilhamento por PDF/WhatsApp**

Hub de relatórios simples (menu Gestão → Relatórios) com 5 relatórios prontos para baixar em PDF ou enviar por WhatsApp: Lote, Pesagens, Financeiro, Pastos/Ocupação e Resumo Geral da Fazenda.

---

## O que foi construído

### Arquivos novos

| Arquivo | Descrição |
|---|---|
| `src/domain/relatorios.js` | Monta os 5 relatórios combinando funções de cálculo já existentes (sem duplicar lógica) |
| `src/domain/whatsappResumo.js` | Gera o texto de resumo de cada relatório para WhatsApp |
| `src/utils/compartilhar.js` | Copiar texto, Web Share API e link `wa.me` |
| `src/components/relatorios/AcoesRelatorio.jsx` | Barra de ações comum (Baixar PDF / Copiar resumo / Enviar WhatsApp) |
| `src/pages/RelatoriosPage.jsx` | Hub com os 5 cards de acesso |
| `src/pages/RelatorioLotePage.jsx` | Relatório do lote |
| `src/pages/RelatorioPesagensPage.jsx` | Relatório de pesagens |
| `src/pages/RelatorioFinanceiroPage.jsx` | Relatório financeiro simples |
| `src/pages/RelatorioPastagensPage.jsx` | Relatório de pastos/ocupação |
| `src/pages/RelatorioResumoGeralPage.jsx` | Resumo geral da fazenda |
| `tests/relatorios.test.js` | 11 testes do domínio dos relatórios |
| `tests/whatsappResumo.test.js` | 9 testes dos textos de WhatsApp |
| `docs/RELATORIOS_HERDON.md` | Documentação dos relatórios e do reuso de cálculo |
| `docs/RELATORIOS_WHATSAPP_PDF_HERDON.md` | Documentação do PDF e do compartilhamento |
| `docs/RELATORIOS_TESTE_MANUAL.md` | Roteiro de teste manual (com limitação de autenticação documentada) |

### Arquivos modificados

| Arquivo | O que mudou |
|---|---|
| `src/navigation/navConfig.js` | Item "Relatórios" na seção Gestão; `relatoriosGerenciais` renomeado para "Relatórios Gerenciais" para não duplicar o nome |
| `src/App.jsx` | Lazy import + `pageMap` para as 6 novas páginas |
| `src/auth/perfis.js` | Permissão `relatorios:ver` (Gerente, Operador, Visualizador) e mapa `permissoesPorPagina` |
| `src/services/subscriptions.js` | 6 novos `pageId` em `MODULES_BASIC` (sem alteração de preço/limite/Asaas) |
| `src/lucide-react.js` | Ícones `MessageCircle` e `Copy` adicionados ao shim local de ícones |
| `docs/NAVEGACAO_HERDON.md` | Tabela de navegação atualizada com o novo hub |

---

## Decisões técnicas

### PDF por impressão, sem biblioteca nova

O projeto já tinha `exportarRelatorio()` (`src/utils/exportarPDF.js`), que abre uma janela e chama `window.print()`. Reaproveitado integralmente — `jspdf`/`html2canvas` não foram adicionados, pois não havia necessidade que justificasse a dependência extra.

### Reuso máximo de cálculo existente

Nenhuma fórmula foi recalculada. `src/domain/relatorios.js` apenas filtra e combina `getResumoLote()`, `calcularFluxoCaixa()`, `listarContasFinanceiras()`, `construirResumoPastos()`, `construirHojeNaFazenda()` e `buildAlerts()` — todas já existentes no domínio do app (usadas hoje pelo Dashboard/"Hoje na Fazenda").

### Hub novo em vez de reaproveitar `RelatoriosGerenciaisPage`

A página `relatoriosGerenciais` já existente é um resumo executivo (indicadores estratégicos, cenários), diferente do hub operacional pedido na sprint. Foi mantida intacta e apenas renomeada na navegação para "Relatórios Gerenciais", evitando duas entradas de menu chamadas "Relatórios".

---

## Limitações conhecidas

- Pesagens não guardam quantidade de cabeças por registro; o relatório usa a quantidade atual do lote como aproximação.
- Ocupação de pastos é estimativa simples por cabeças, sem cálculo de UA real (mesma limitação documentada em `construirResumoPastos`).
- PDF não é anexado automaticamente ao WhatsApp — fluxo é baixar PDF de um lado e enviar resumo em texto de outro.

## Pendências futuras

- Anexar PDF diretamente via app mobile.
- Relatórios agendados / envio automático por e-mail.
- Relatório com marca do produtor.
- Gráficos avançados, exportação Excel, assinatura digital, link público temporário.

---

## Teste manual

Não foi possível testar com conta autenticada real (sem credenciais de teste disponíveis). Documentado honestamente em `docs/RELATORIOS_TESTE_MANUAL.md`, junto com o roteiro completo para quando houver acesso.

## Resultado dos gates

| Gate | Resultado |
|---|---|
| `npm test` | 474 testes, 0 falhas (20 novos: 11 em `relatorios.test.js`, 9 em `whatsappResumo.test.js`) |
| `npm run lint` | 0 erros |
| `npm run build` | Build de produção concluído com sucesso |
