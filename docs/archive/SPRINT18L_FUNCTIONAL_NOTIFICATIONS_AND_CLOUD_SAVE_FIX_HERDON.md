# SPRINT18L_FUNCTIONAL_NOTIFICATIONS_AND_CLOUD_SAVE_FIX_HERDON.md

## Objetivo
Correção funcional de dois bloqueios:
1. Ações de notificação no AppHeader.
2. Persistência cloud-first em gravações novas/editadas/excluídas quando sessão e configuração de nuvem estão prontas.

## Causa raiz — notificações não funcionavam
1. **Filtro de resolvidos inconsistente**:
- O filtro ativo usava `alertas_resolvidos.includes(chave)`.
- Após reload, `alertas_resolvidos` pode vir como objetos persistidos (`{ chave: ... }`) e não apenas string.
- Resultado: alerta reaparecia mesmo após resolver.

2. **Destino de navegação parcial no Abrir**:
- Parte dos alertas usa `acao.rota` ou `pagina` em vez de `route`.
- O handler de abrir validava só `alert.route` em alguns pontos.
- Resultado: `Abrir` podia não navegar e cair em mensagem de destino ausente.

## Estratégia de chave estável (ack)
Implementada/fortalecida em `App.jsx`:
- Prioridade: `alert.ackKey`.
- Fallback: `alert.id`.
- Fallback derivado: `tipo + rota + titulo + dataRef`.
- A rota derivada agora considera: `route`, `rota`, `acao.rota`, `pagina`.
- A mesma chave é usada para renderização, resolver, adiar e filtro.

## Como Resolver funciona
- Persiste em `alertas_resolvidos` via `createOperationalRecord('alertas_resolvidos', { chave }, session)`.
- Atualiza `db.alertas_resolvidos` imediatamente.
- Filtro ativo agora normaliza lista de resolvidos (string **ou** objeto com `chave/ackKey/id`).
- Remove da lista na hora e mantém removido após refresh.
- Feedback: `Notificação resolvida.`

## Como Adiar funciona
- Persiste em `alertas_adiados` com chave e data:
  - `chave`
  - `ate`
  - `snoozeUntil` (compatibilidade)
- Atualiza `db.alertas_adiados` imediatamente.
- Filtro exclui alerta enquanto `ate/snoozeUntil >= hoje`.
- Padrão permanece amanhã (`'1'`) e opções `3` e `7` dias no menu.
- Feedback: `Lembrete adiado.`

## Como Abrir funciona
- Handler unificado agora resolve destino por:
  - `alert.route` -> `alert.rota` -> `alert.acao.rota` -> `alert.pagina`.
- Com rota válida: navega e fecha dropdown.
- Sem rota válida: mostra `Não há destino configurado para este alerta.`

## Causa raiz — salvamentos indo para local
1. **Dashboard gravava com sessão nula**:
- Em `DashboardPage`, criação/conclusão de tarefas chamava persistência com `session = null`.
- Isso força `ensureSupabaseRequestReadiness` a retornar fallback local.

2. **Estado de nuvem não era atualizado por sucesso de escrita**:
- Mesmo com operações cloud bem-sucedidas, o chip podia continuar sem confirmação visual de nuvem validada.

## Correções cloud-first aplicadas
1. `DashboardPage`:
- Passou a receber `session` por props.
- `createOperationalRecord`/`updateOperationalRecord` no Dashboard agora usam sessão real.

2. `App.jsx`:
- `ActivePage` agora recebe `session={session}`.

3. `operationalPersistence.js`:
- Mantido fluxo cloud-first (tenta nuvem primeiro quando pronta).
- Em sucesso de `create/update/delete`, agora dispara evento de saúde cloud:
  - `herdon-cloud-diagnostic-state` com `verified: true`.
- Em falha de escrita cloud, retorno explícito usa `syncStatus: 'pending_sync'` (com fallback local seguro).
- Em sucesso, `syncStatus: 'cloud_success'`.
- Ajustado para preservar erro real do Supabase (`throw error`) em vez de encapsular em `new Error`, melhorando classificação de fallback.

## Fluxos cobertos pela correção
- A correção foi aplicada no mecanismo central (`create/update/deleteOperationalRecord`) e no ponto crítico identificado (`DashboardPage` com sessão nula).
- Assim, os módulos que já usam esse mecanismo com sessão continuam cloud-first:
  - Fazendas, Lotes, Animais, Estoque, Suplementação, Financeiro, Pagamentos Diários, Sanitário, IATF/Reprodução, Tarefas, alertas_resolvidos, alertas_adiados.

## Segurança e logs
- Não houve inclusão de logs com tokens/JWT/headers/segredos.
- Mantido padrão de mensagens seguras e não técnicas para usuário.

## O que foi intencionalmente não alterado
- Sem mudanças de schema Supabase, RLS, auth rules, cálculos de negócio, fórmulas GMD/consumo, relatórios, layout de dashboard, agrupamento de navegação.
- Sem redesign visual amplo (sprint funcional).

## Arquivos alterados
- `src/App.jsx`
- `src/pages/DashboardPage.jsx`
- `src/services/operationalPersistence.js`

## Validação executada
- `git grep -n -E "^(<<<<<<<|=======|>>>>>>>)" -- .`:
  - sem conflitos (sem matches).
- `npm run build`:
  - sucesso.
- `npm run lint`:
  - sucesso sem erros; warnings preexistentes de hooks.

## Verificação manual solicitada
- Necessária validação manual em ambiente com sessão cloud ativa para confirmar o checklist:
1. Testar conexão no header e observar estado do chip.
2. Criar Fazenda e verificar `cloud_success` quando nuvem pronta.
3. Criar item de Estoque e verificar persistência.
4. Resolver notificação, atualizar página e confirmar que não retorna.
5. Adiar notificação, atualizar página e confirmar ocultação até a data.
6. Confirmar ausência de tokens/headers/JWT/secrets no console.
