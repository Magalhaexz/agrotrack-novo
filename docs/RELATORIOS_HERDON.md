# Relatórios HERDON (Sprint 24)

## O que existe

Um hub "Relatórios" (menu **Gestão**) com 5 relatórios simples, pensados para uso diário do produtor — não é um módulo de BI.

| Relatório | Página | O que mostra |
|---|---|---|
| Relatório do Lote | `RelatorioLotePage.jsx` | Resumo/desempenho/financeiro, **saúde do lote, alertas e decisões sugeridas (Sprint 4)**, decisão de venda e custo por arroba (Sprint 32), manejo/sanidade/suplementação (Sprint 33), últimas pesagens de um lote selecionado |
| Relatório de Pesagens | `RelatorioPesagensPage.jsx` | Histórico de pesagens filtrável por fazenda/lote/período, com variação e GMD entre pesagens |
| Relatório Financeiro | `RelatorioFinanceiroPage.jsx` | Entrou / saiu / saldo, maiores custos, contas vencidas e próximas do vencimento |
| Relatório de Pastos | `RelatorioPastagensPage.jsx` | Pastos com/sem lote, lotes sem pasto, status de lotação, cabeças/peso estimados e percentual de ocupação por pasto (Sprint 25) |
| Resumo Geral da Fazenda | `RelatorioResumoGeralPage.jsx` | Totais de fazendas/pastos/lotes/cabeças, resultado financeiro, alertas críticos e pendências do dia |

Todos têm: ações de baixar PDF, copiar resumo e enviar por WhatsApp (ver `RELATORIOS_WHATSAPP_PDF_HERDON.md`), e estados vazios em linguagem simples quando não há dados.

## Onde está o cálculo (reuso, sem duplicar lógica)

Todo o cálculo já existia no app antes desta sprint. O arquivo novo `src/domain/relatorios.js` apenas combina e filtra:

- `getResumoLote()` (`src/domain/resumoLote.js`) — peso, GMD, custo, receita, lucro, ROI do lote.
- `calcularFluxoCaixa()` (`src/domain/fluxoCaixa.js`) — entrou/saiu/saldo.
- `listarContasFinanceiras()`, `construirResumoPastos()`, `construirHojeNaFazenda()` (`src/domain/hojeNaFazenda.js`) — contas vencidas/próximas, ocupação de pastos, pendências do dia.
- `calcularOcupacaoPastos()` (`src/domain/ocupacaoPastos.js`, Sprint 25) — status de lotação por pasto. Ver [OCUPACAO_PASTOS_HERDON.md](OCUPACAO_PASTOS_HERDON.md).
- `buildAlerts()` (`src/utils/alerts.js`) — alertas críticos.
- `classificarDecisaoVenda()`, `compararVenderOuManter()`, `montarDadosDecisaoVenda()` (`src/domain/decisaoVenda.js`, Sprint 32) — custo/lucro por arroba, ponto de equilíbrio, status de decisão e simulação "vender hoje vs manter por mais dias". Ver [DECISAO_VENDA_HERDON.md](DECISAO_VENDA_HERDON.md) e [CUSTO_POR_ARROBA_HERDON.md](CUSTO_POR_ARROBA_HERDON.md).
- `montarDadosManejoResultado()` (`src/domain/manejoResultado.js`, Sprint 33) — sanidade, suplementação, relação com GMD e risco operacional do lote, lendo `db.sanitario` e `db.consumo_suplementacao`. Ver [MANEJO_RESULTADO_HERDON.md](MANEJO_RESULTADO_HERDON.md).

Os textos de WhatsApp ficam em `src/domain/whatsappResumo.js`, separados da montagem dos relatórios. Desde a Sprint 32, `gerarResumoLoteTexto` também inclui uma linha com custo/@, lucro/@ e status de decisão de venda; desde a Sprint 33, inclui também uma linha de manejo/sanidade/suplementação — ambas só quando o relatório tiver esses dados.

## Limitações conhecidas

- A pesagem não guarda quantidade de cabeças por registro (campo não existe na tabela `pesagens`); o relatório de pesagens mostra a quantidade **atual** do lote, não a quantidade no momento da pesagem.
- A ocupação de pastos (Sprint 25) usa UA estimada (peso vivo ÷ 450) comparada à capacidade do próprio pasto — estimativa operacional, não um cálculo técnico de lotação. Ver limitações completas em [OCUPACAO_PASTOS_HERDON.md](OCUPACAO_PASTOS_HERDON.md).
- Nenhuma tabela nova foi criada nesta sprint.

## Permissões e planos

Novo permission key `relatorios:ver`, concedido a Gerente, Operador e Visualizador (mesma régua de `relatorios_gerenciais:ver`). Os 6 novos `pageId` (`relatorios`, `relatorioLote`, `relatorioPesagens`, `relatorioFinanceiro`, `relatorioPastagens`, `relatorioResumoGeral`) foram adicionados a `MODULES_BASIC` em `src/services/subscriptions.js` — disponíveis em todos os planos, sem alteração de preço/limite/Asaas.

---

## Sprint 4 — Relatório bonito do lote (saúde, alertas, decisões, PDF/WhatsApp)

### Objetivo

Dar ao produtor um relatório completo e compartilhável de um lote — clicando em **"Gerar relatório do lote"** — que já traga a inteligência das sprints anteriores (score de saúde, alertas, decisões sugeridas), sem recalcular nada que já existisse.

### O que já existia e foi reaproveitado (nada foi duplicado)

Antes desta sprint, o app já tinha: `RelatorioLotePage.jsx`, `buildRelatorioLote()` (`domain/relatorios.js`), `gerarResumoLoteTexto()` (`domain/whatsappResumo.js`) e `AcoesRelatorio.jsx` (baixar PDF via `utils/exportarPDF.js`, copiar texto e compartilhar no WhatsApp via `utils/compartilhar.js`) — toda a infraestrutura de exportação/compartilhamento já funcionava. O trabalho desta sprint foi **estender**, não recriar.

### Arquivos criados/alterados

| Arquivo | O que é |
|---|---|
| `src/domain/relatorioLote.js` (novo) | `gerarResumoRelatorioLote(db, loteId, options)` — orquestra `buildRelatorioLote()` + `calcularSaudeLote()` (Sprint 3, que por sua vez já reaproveita os detectores do motor de alertas da Sprint 1) e devolve o objeto pronto para a UI, com os campos pedidos (`cabecas`, `pesoInicial/Atual/Alvo`, `gmd`/`gmdEsperado`/`gmdStatus`, `custoTotal/PorCabeca/PorArroba`, `receitaPrevista`, `lucroEstimado`, `saudeLote`, `alertas`, `decisoes`, `dadosInsuficientes`) |
| `src/domain/relatorioLote.test.js` (novo) | 12 testes cobrindo os 8 cenários pedidos |
| `src/components/relatorios/RelatorioLotePreview.jsx` (novo) | Componente de exibição com os 8 blocos do relatório (cabeçalho, resumo, desempenho, financeiro, saúde, alertas, decisões, rodapé) — reaproveita `SaudeLoteCard` (Sprint 3) e as classes de alerta de `decisoes.css` (Sprint 2) |
| `src/domain/whatsappResumo.js` | `gerarResumoLoteTexto` ganhou 3 linhas opcionais (saúde/alerta/ação), só quando o relatório vem de `gerarResumoRelatorioLote` — 100% compatível com quem ainda chama a função com o objeto antigo de `buildRelatorioLote` |
| `src/components/relatorios/AcoesRelatorio.jsx` | Baixar PDF / Copiar resumo / WhatsApp agora checam o paywall de exportação antes de agir |
| `src/App.jsx` | `handleWriteBlocked` aceita uma `message` customizada (usada pelo paywall de exportação) |
| `src/pages/LotesPage.jsx` | Botão "Gerar relatório do lote" abre um modal com `RelatorioLotePreview` + `AcoesRelatorio` |
| `src/components/lotes/LoteDetailsPanel.jsx` | Botão "Gerar relatório do lote" no cabeçalho dos detalhes do lote |
| `src/pages/RelatorioLotePage.jsx` | Passou a usar `gerarResumoRelatorioLote` e a renderizar `RelatorioLotePreview` no topo (substituindo os cards de Identificação/Desempenho, que ficaram redundantes com o preview novo) |
| `src/styles/relatorios.css` | Classes `.relatorio-lote-preview*` para o cabeçalho/rodapé com identidade HERDON |
| `src/utils/exportarPDF.js` | CSS de impressão (cores fixas, já que a janela do PDF não herda as variáveis do app) para `.summary-row`, `.ui-badge`, `.report-note`, `.saude-lote`, `.decisoes-item` e `.relatorio-lote-preview*` |

### Onde o botão aparece

1. **Detalhes do lote** (`LoteDetailsPanel`) — abre um modal com o relatório completo.
2. **Card do lote** (`LoteCard`) — **decidido não adicionar**: o card já tem 6 botões de ação, saúde do lote (Sprint 3) e alerta de GMD; um 7º botão poluiria o card. A própria sprint previa essa exceção ("se não poluir").
3. **Página de Relatórios** (catálogo → "Relatório do Lote") — já existia; agora mostra o relatório enriquecido.

### Como o relatório é gerado

`gerarResumoRelatorioLote(db, loteId)` chama `buildRelatorioLote` (peso/GMD/custo/decisão de venda/manejo — já existente) e `calcularSaudeLote` (Sprint 3), e deriva:
- **Alertas do lote**: os fatores de `calcularSaudeLote` com pontuação negativa (GMD, pesagem, tarefas, sanidade, estoque, custo, mortalidade) — nenhum detector é chamado de novo.
- **Decisões sugeridas**: uma frase por fator negativo (ex.: "Priorizar nova pesagem", "Repor estoque") mais "Avaliar venda deste lote" quando a decisão de venda (já calculada) indicar `pronto_avaliar`.
- **GMD status** (acima/dentro/abaixo/sem_dados): deriva do fator `gmd` de `calcularSaudeLote` (que já sabe se há dado suficiente) + o sinal da diferença já calculada.
- **Receita prevista / lucro estimado**: vêm da simulação "vender hoje" que `buildRelatorioLote` já calcula (`simularVendaHoje`, `decisaoVenda.js`) — `null` (nunca 0 inventado) quando não há dados suficientes para simular.

### Como funciona a exportação (PDF/impressão)

Reaproveita o mecanismo já existente: `exportarRelatorio()` (`utils/exportarPDF.js`) abre uma janela nova, escreve o HTML do relatório com um `<style>` de impressão embutido e chama `window.print()` — o usuário salva como PDF pelo diálogo de impressão do navegador. Não foi adicionada nenhuma biblioteca de PDF. Esta sprint só ampliou o CSS de impressão para as novas classes (saúde, alertas, decisões) com cores fixas, já que essa janela não herda as variáveis CSS do app.

### Como funciona o compartilhamento no WhatsApp

`gerarResumoLoteTexto(relatorio)` monta um texto curto (nome do lote, cabeças, peso, GMD, meta, saúde do lote, alerta principal, ação sugerida) e `abrirWhatsApp(texto)` (`utils/compartilhar.js`) abre `https://wa.me/?text=...` com o texto já preenchido — mecanismo que já existia, sem mudanças.

### Paywall comercial (Parte 7)

**Visualizar o relatório é sempre livre** — nenhuma tela nova de bloqueio foi criada para o preview. Exportar (Baixar PDF, Copiar resumo, Enviar por WhatsApp) reaproveita o mesmo gate do paywall de escrita (`services/writeGuard.js`, `isWriteAllowed()`/`notifyBlockedWrite()`), tratando "exportar relatório" como uma ação premium equivalente a uma gravação — mesma regra comercial ("conta tem plano ativo?"), aplicada a uma ação diferente. Sem plano ativo, o clique mostra a mensagem *"Escolha um plano para exportar relatórios do HERDON."* e redireciona para Planos e Assinatura (`App.jsx`'s `handleWriteBlocked`, que agora aceita uma mensagem customizada para não usar o texto genérico de "salvar dados").

### Dados insuficientes (Parte 8)

Cada bloco do relatório trata a ausência de dado no lugar, sem inventar zero como se fosse real:
- Sem cabeças/peso: "Cadastre animais neste lote para ver peso e desempenho."
- GMD sem pesagens suficientes: "Este lote ainda não tem pesagens suficientes para calcular o GMD."
- Sem custo: "Custo ainda não informado para este lote." (`custoTotal`/`custoPorCabeca`/`custoPorArroba` ficam `null`, nunca `0`).
- Sem base para simular venda: mensagem explicando que receita prevista/lucro estimado aparecem quando houver peso e custo suficientes (`receitaPrevista`/`lucroEstimado` ficam `null`).
- Um banner no topo (`report-note--warning`) reaproveita a mensagem que `classificarDecisaoVenda` (Sprint 32) já monta, listando exatamente o que falta.

### Testes

12 testes novos em `src/domain/relatorioLote.test.js` (dados completos; poucas pesagens; lote vazio; sem custo; GMD abaixo da meta; saúde em risco/crítico; texto de WhatsApp com/sem enriquecimento; lote inexistente; receita/lucro nunca inventados) + 14 testes existentes de `tests/whatsappResumo.test.js` confirmados intactos (mudança 100% aditiva). `npm test`: **744 testes, 0 falhas** (732 da Sprint 3 + 12 novos).

### Limitações conhecidas

- Verificação manual logada (clicar de fato no botão, ver o modal, gerar o PDF, testar o link do WhatsApp) **não foi possível nesta sessão** — o ambiente de desenvolvimento local não tem as chaves do Supabase configuradas (mesma limitação já registrada nas sprints anteriores). A confiança vem do build de produção (compila todo o grafo de imports/JSX), lint limpo e cobertura total da lógica de dados por teste automatizado.
- O botão "Gerar relatório do lote" não foi adicionado ao `LoteCard` (decisão documentada acima).
- O paywall de exportação reaproveita a mesma flag de "conta pode escrever" do paywall de escrita — não existe hoje uma distinção fina entre "pode salvar dados" e "pode exportar relatórios"; se o produto precisar disso no futuro (ex.: planos que salvam mas não exportam), será necessário um estado comercial próprio.

### Próximos passos sugeridos

- Verificar visualmente o relatório (modal e página) em produção, mobile e desktop, após o deploy.
- Avaliar anexar o PDF gerado diretamente ao compartilhar no WhatsApp (hoje o WhatsApp recebe só o texto-resumo; o PDF é um download separado).
- Se fizer sentido comercial, permitir "Copiar resumo" fora do paywall (hoje tratado como exportação, igual a PDF/WhatsApp) — ver decisão registrada acima.
