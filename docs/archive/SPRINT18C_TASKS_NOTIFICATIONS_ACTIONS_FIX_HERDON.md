# SPRINT18C_TASKS_NOTIFICATIONS_ACTIONS_FIX_HERDON

## Modelo atual encontrado (tarefas/notificações)
- Tarefas já persistiam via `createOperationalRecord`, `updateOperationalRecord` e `deleteOperationalRecord` na coleção `tarefas`.
- Alertas pendentes do header/dashboard já eram derivados de alertas automáticos + legados e removidos por `alertas_resolvidos`.
- Não havia fluxo funcional completo para adiamento de notificações/tarefas com persistência e reclassificação visual por estado.

## Ações implementadas
- Tarefas: adicionadas ações funcionais de:
  - **Marcar como concluída**
  - **Resolver** (avanço rápido de fluxo)
  - **Adiar**
  - **Reabrir** (quando concluída)
- Notificações (header):
  - **Resolver** persiste em `alertas_resolvidos`
  - **Adiar** persiste em `alertas_adiados` com data limite

## Como funciona o adiamento
- Adiamento aceita:
  - amanhã (`1`)
  - `3` dias
  - `7` dias
  - data explícita `YYYY-MM-DD`
- Tarefas: atualiza `data_vencimento` e `status: adiada`.
- Notificações: grava `{ chave, ate }` em `alertas_adiados` e filtra alertas até a data ser atingida.
- Feedbacks em PT-BR:
  - "Tarefa adiada."
  - "Lembrete adiado."

## Como funciona resolver/concluir
- Tarefa concluída:
  - atualização imediata de UI para `status: concluida`
  - persistência por `updateOperationalRecord`
  - feedback: "Tarefa concluída."
- Notificação resolvida:
  - adiciona chave em `alertas_resolvidos`
  - deixa de aparecer como pendente
  - feedback: "Notificação resolvida."

## Estratégia de persistência
- Reuso de padrões existentes de persistência operacional.
- Sem criação de novo schema Supabase.
- Estados de alerta usam listas compatíveis no `db` local/sincronizável (`alertas_resolvidos`, `alertas_adiados`) e mesmas rotas de persistência operacional.

## Comportamento no dashboard após ações
- Alertas resolvidos deixam de aparecer nos blocos de pendência.
- Alertas adiados saem da lista até vencer o `ate` e só então retornam ao fluxo pendente.
- Tarefas são reclassificadas por buckets:
  - Pendentes
  - Vencidas
  - Concluídas
  - Adiadas

## Permissões
- Mantido modelo de permissão existente.
- Ações de mutação bloqueadas sem permissão de edição de tarefas.
- Mensagem padrão preservada:
  - "Você não tem permissão para executar esta ação."

## O que não foi alterado
- Schema Supabase
- RLS
- Auth
- Sync core
- Cloud controls/header architecture
- Cálculos de negócio
- Fórmulas de GMD/consumo
- Persistência de pagamentos
- Persistência IATF
- Exportação de relatórios

## Testes
- `git grep -n -E "^(<<<<<<<|=======|>>>>>>>)" -- .` sem conflitos.
- `npm run build` concluído com sucesso.
- `npm run lint` concluído com sucesso (warnings preexistentes).
