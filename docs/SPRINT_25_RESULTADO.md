# Sprint 25 — Resultado

## Funcionalidade entregue

**Ocupação de Pastos, UA e Alertas de Lotação**

Para cada pasto: lotes ativos, cabeças e peso estimados, e status de lotação (vazio / sem dados suficientes / ok / atenção / acima da capacidade), com alertas e prioridades correspondentes no Dashboard, em Alertas e no Relatório de Pastos.

---

## Como a ocupação foi calculada

`src/domain/ocupacaoPastos.js` (novo) reaproveita a fórmula de Unidade Animal já existente (`calcularUaPorLote()`, peso vivo ÷ 450, em `src/domain/unidadeAnimal.js`) no nível do pasto individual: soma a UA dos lotes ativos vinculados a cada pasto e compara com a capacidade do próprio pasto em UA (`area_ha × capacidade_suporte_ua_ha`) — mesma unidade nos dois lados, sem inventar nenhum cálculo zootécnico novo.

Classificação, em ordem de prioridade: sem lote ativo → `vazio`; com lote mas sem área/capacidade → `sem_dados`; com os dois → `ok` (≤80%), `atencao` (80–100%) ou `acima_capacidade` (>100%). Detalhes e limitações completas em [docs/OCUPACAO_PASTOS_HERDON.md](OCUPACAO_PASTOS_HERDON.md).

## Onde aparece no app

- **Pastos** (`PastagensPage`): nova coluna "Lotação" por pasto — lotes ativos · cabeças estimadas, badge de status, aviso quando acima da capacidade ou faltando área/capacidade.
- **Dashboard / Hoje na Fazenda**: novas prioridades "X pasto(s) está(ão) acima da capacidade" (crítico) e "X pasto(s) precisa(m) de atenção na lotação" (atenção); card "Pastos em uso" atualizado para listar os pastos pelo nome usando o cálculo correto (UA vs. UA, não cabeças vs. UA).
- **Alertas**: 4 alertas novos (`tipo: 'pasto'`) — acima da capacidade (crítico), em atenção (aviso), sem área/capacidade (informativo), lote sem pasto (aviso).
- **Relatório de Pastos**: tabela "Ocupação por pasto" com cabeças/peso estimados, percentual de ocupação e status; lista de lotes sem pasto definido; aviso de estimativa simples.
- **Resumo de Pastos por WhatsApp**: inclui contagem de pastos acima da capacidade e em atenção.

## Alertas criados

| Situação | Nível |
|---|---|
| Pasto acima da capacidade | Crítico |
| Pasto em atenção (80–100% da capacidade) | Aviso |
| Lote ativo sem pasto definido | Aviso |
| Pasto com lote mas sem área/capacidade informada | Informativo |

Pastos vazios não geram alerta.

## Relatórios atualizados

- `docs/RELATORIOS_HERDON.md` — Relatório de Pastos passou a mostrar status de lotação, percentual de ocupação e cabeças/peso estimados (não mais só contagem simples).
- `buildRelatorioPastagens()` (`src/domain/relatorios.js`) agora retorna `ocupacaoPorPasto` com status por pasto, `pastosAcimaCapacidade`, `pastosEmAtencao` e `lotesSemPastoDetalhe`.
- `gerarResumoPastagensTexto()` (`src/domain/whatsappResumo.js`) inclui as novas contagens.

## Arquivos novos

| Arquivo | Descrição |
|---|---|
| `src/domain/ocupacaoPastos.js` | Cálculo de ocupação por pasto: `calcularOcupacaoPastos`, `calcularOcupacaoPasto`, `classificarLotacaoPasto`, `listarLotesSemPasto` (movido de `hojeNaFazenda.js`), `obterLabelStatusLotacao` |
| `tests/ocupacaoPastos.test.js` | 14 testes do domínio de ocupação |
| `docs/OCUPACAO_PASTOS_HERDON.md` | Documentação completa da ocupação, classificação e limitações |
| `docs/OCUPACAO_PASTOS_TESTE_MANUAL.md` | Roteiro de teste manual (com limitação de autenticação documentada) |
| `docs/SPRINT_25_RESULTADO.md` | Este documento |

## Arquivos modificados

| Arquivo | O que mudou |
|---|---|
| `src/domain/hojeNaFazenda.js` | `listarLotesSemPasto` agora importado de `ocupacaoPastos.js` (re-exportado para compatibilidade); `construirResumoPastos()` expõe `ocupacao`, `pastosEmAtencao`, `pastosAcimaCapacidade`, `pastosSemDadosLotacao`; `construirHojeNaFazenda()` gera 2 novas prioridades |
| `src/utils/alerts.js` | Nova seção "Alertas de Ocupação de Pastos" com os 4 alertas `tipo: 'pasto'` |
| `src/pages/PastagensPage.jsx` | Nova coluna "Lotação" na tabela de pastos cadastrados |
| `src/pages/DashboardPage.jsx` | Card "Pastos em uso" passou a usar `pastosAcimaCapacidade`/`pastosEmAtencao` em vez do indício antigo (cabeças vs. UA, unidades diferentes) |
| `src/domain/relatorios.js` | `buildRelatorioPastagens()` usa `calcularOcupacaoPastos()` e `listarLotesSemPasto()` |
| `src/pages/RelatorioPastagensPage.jsx` | Tabela de ocupação por pasto com status/percentual; card de lotes sem pasto; aviso de estimativa |
| `src/domain/whatsappResumo.js` | `gerarResumoPastagensTexto()` inclui pastos acima da capacidade/em atenção |
| `docs/PASTOS_HERDON.md`, `docs/RELATORIOS_HERDON.md` | Pendência de ocupação por pasto marcada como resolvida; referências cruzadas para `OCUPACAO_PASTOS_HERDON.md` |
| `tests/relatorios.test.js`, `tests/whatsappResumo.test.js`, `src/domain/hojeNaFazenda.test.js`, `src/utils/alerts.test.js` | Testes novos/ajustados para os campos e comportamentos desta sprint |

## Decisões técnicas

### UA real em vez de cabeças vs. UA

A Sprint 24 já tinha um "indício de excesso" que comparava cabeças (uma unidade) com capacidade em UA (outra unidade) — dependia do peso médio do rebanho coincidir com 450 kg para fazer sentido. Esta sprint usa a fórmula de UA que já existe e já é testada no HERDON (`calcularUaPorLote`, peso ÷ 450) dos dois lados da comparação. Não é um cálculo zootécnico avançado — é a mesma fórmula simples já usada na página de Pastos, aplicada agora por pasto individual em vez de só no nível da fazenda.

### `listarLotesSemPasto` movido para `ocupacaoPastos.js`

Evita duplicar a mesma lógica em dois arquivos de domínio. `hojeNaFazenda.js` reexporta para não quebrar o import existente em `hojeNaFazenda.test.js`.

## Limitações conhecidas

- Não é cálculo zootécnico de lotação (sem categoria animal, fase produtiva, estação do ano).
- Depende do produtor preencher área e capacidade do pasto.
- `cabecasEstimadas` usa `lote.qtd`, não soma dinâmica de `animais.qtd`.
- Nenhuma tabela nova foi criada.

## Pendências para Sprint 26

- Cálculo técnico de UA por categoria/peso (ajustado por faixa etária e fase produtiva).
- Suporte por estação do ano.
- Integração com mapa da fazenda.
- Taxa de lotação por período (histórico).
- Histórico de ocupação por pasto.
- Recomendação automática de rotação de pastos.

## Teste manual

Não foi possível testar com conta autenticada real (sem credenciais de teste disponíveis). Documentado honestamente em `docs/OCUPACAO_PASTOS_TESTE_MANUAL.md`, com roteiro completo para quando houver acesso.

## Resultado dos gates

| Gate | Resultado |
|---|---|
| `npm test` | 500 testes, 0 falhas (26 novos: 14 em `tests/ocupacaoPastos.test.js`, 5 em `src/utils/alerts.test.js`, 4 em `src/domain/hojeNaFazenda.test.js`, 2 em `tests/relatorios.test.js`, 1 em `tests/whatsappResumo.test.js`) |
| `npm run lint` | 0 erros |
| `npm run build` | Build de produção concluído com sucesso |
