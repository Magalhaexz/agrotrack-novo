# Decisão — Central de Alertas Única

Contrato oficial para geração, apresentação e tratativa de alertas no HERDON. Motivado pela Sprint 13 (auditoria 360°): o painel de resolver/adiar nunca foi migrado para a Central nova, e 3 sistemas de alerta coexistiam sem clareza de qual era o oficial.

## 1. Motor oficial de geração

`gerarAlertasUnificados` ([`src/domain/alertasUnificados.js`](../src/domain/alertasUnificados.js)) é a fonte oficial. Todo consumidor novo deve chamá-lo — nunca recalcular alertas dentro de uma página/componente.

## 2. Camada de apresentação

`src/domain/centralAlertas.js` é a camada oficial de normalização, filtro, resumo e ordenação — usada pela Central (`AlertasPage.jsx`). Não mexe em tratativa; só organiza o que `gerarAlertasUnificados` já produziu.

## 3. Tratativa — camada nova (Sprint 16)

Resolver/adiar/ignorar/em análise é uma **camada sobre o alerta**, nunca substitui a regra de origem: o alerta continua sendo gerado do zero a cada consulta (não é "apagado"), a tratativa só decide se ele aparece como prioridade ativa.

- Domínio puro: [`src/domain/tratativasAlertas.js`](../src/domain/tratativasAlertas.js) — `STATUS_TRATATIVA` (em_analise/resolvido/adiado/ignorado), `aplicarTratativasAosAlertas`, `deveExibirAlerta`, `criarTratativaAlerta`, `resumirTratativas`.
- Persistência: tabela nova `alertas_tratativas` (migration `20260708090000_alertas_tratativas.sql`, **aplicada no projeto**), serviço [`src/services/tratativasAlertas.js`](../src/services/tratativasAlertas.js).
- Chave: `alerta_id` = o `id` que `gerarAlertasUnificados` já atribui a cada alerta (estável desde a Sprint 12). Uma linha por `(owner_user_id, alerta_id)` — editar não duplica, atualiza.

### Por que uma tabela nova, e não reaproveitar `alertas_resolvidos`/`alertas_adiados`

Auditado antes de decidir (Etapa 1): essas duas tabelas já existiam, mas modelam só "existe linha = resolvido" / "existe linha = adiado" — sem um `status` que cubra também **em_análise** e **ignorado**, e sem uma chave estruturada (usam `chave`/`ack_key`, um texto heurístico montado a partir de campos do alerta **legado** — tipo/título/rota/data —, não do `id` estável que `gerarAlertasUnificados` já tem desde a Sprint 12). Adaptar essas duas tabelas para 4 status exigiria mudar sua estrutura e arriscar o painel legado que já as usa em produção (ver §4). Criar `alertas_tratativas` como uma tabela nova, dedicada à Central, é o caminho que não toca no que já funciona.

## 4. Painel legado (App.jsx + AppHeader) — mantido, não migrado

Localizado: o sino de notificações no header (`AppHeader`, via `App.jsx`'s `marcarAlertaComoFeito`/`adiarAlerta`) e uma aba "Todos os alertas" dentro do próprio `DashboardPage.jsx` **também** usam esse mesmo mecanismo legado — ambos operam sobre `buildAlerts` (`utils/alerts.js`, alertas com forma diferente de `gerarAlertasUnificados`) e persistem em `alertas_resolvidos`/`alertas_adiados` via uma chave heurística (`getAlertAckKey`, `App.jsx`).

**Decisão: não migrado nesta sprint, mantido como está.** Razões:
- É um fluxo já em produção, testado pelo uso real — reescrevê-lo para consumir `alertas_tratativas` exigiria trocar a base inteira de identidade dos alertas ali (de `ackKey` heurístico para `id` de `gerarAlertasUnificados`), risco desproporcional para este sprint.
- A regra da sprint proíbe "reescrever tudo" e exige não quebrar o Dashboard.
- Em vez disso: adicionado um atalho ("Ver Central de Alertas") na aba "Todos os alertas" do Dashboard, apontando para a Central — quem quiser a tratativa completa (em análise/ignorar/histórico) vai para lá. O painel legado continua funcionando exatamente como antes (resolver/adiar simples, sem remover nada).
- Fica documentado como **depreciado em favor da Central**, não removido — uma sprint futura pode migrar de fato o header/Dashboard para `alertas_tratativas`, se decidido.

## 5. Consumidores

| Consumidor | Motor | Tratativa aplicada? |
|---|---|---|
| Central (`AlertasPage.jsx`) | `gerarAlertasUnificados` → `centralAlertas.js` | Sim — completa (em análise/resolver/adiar/ignorar) |
| Dashboard — "Prioridades de hoje" | `gerarAlertasUnificados` | Não nesta sprint (só leitura; link para a Central) |
| Dashboard — aba "Todos os alertas" / Header (sino) | `utils/alerts.js` (legado) | Não — usa `alertas_resolvidos`/`alertas_adiados` (§4) |
| Telegram `/alertas` | `gerarAlertasUnificados` | Sim — filtra por `visivel` antes de responder |
| Telegram relatório diário | `gerarAlertasUnificados` | Sim — mesma filtragem |
| WhatsApp (futuro) | deve usar `gerarAlertasUnificados` + `aplicarTratativasAosAlertas`, mesmo padrão do Telegram | — |

## 6. Proibições (reafirmadas)

- Não criar um novo motor paralelo de geração de alertas.
- Não duplicar lógica de alerta dentro de página/componente — sempre via `gerarAlertasUnificados`.
- Não criar regra de alerta diretamente em JSX.
- Tratativa nunca apaga o alerta gerado — só anota como ele aparece (`visivel`/`statusTratativa`).

## 7. Janelas de prazo

Documentado e parcialmente centralizado em [`src/domain/janelasAlertas.js`](../src/domain/janelasAlertas.js) — **nenhum valor foi alterado**, só nomeado. A divergência 7 dias (financeiro/lote-saída) × 3 dias (carência sanitária) é **intencional**, não um bug: carência é risco de segurança alimentar (janela mais curta e conservadora), o resto é planejamento operacional. Ver comentário no próprio arquivo para a lista completa de janelas existentes em outros módulos (`hojeNaFazenda.js`, `alertasInteligentes.js`), documentadas mas não rewiring — mudar essas exigiria teste dedicado fora do escopo desta sprint.
