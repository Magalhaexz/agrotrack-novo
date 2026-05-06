# SPRINT18N_CLOUD_PERSISTENCE_SCHEMA_COMPATIBILITY_FIX_HERDON

## Escopo aplicado
- `src/services/operationalPersistence.js`
- `src/services/supabaseDiagnostics.js`
- `src/hooks/useOperationalData.js`

## 1) Causa raiz do 400 em `alertas_resolvidos`
Causa provável confirmada por implementação anterior:
- o create genérico sempre incluía `owner_user_id` no payload;
- para tabelas de alerta, isso pode gerar `400 Bad Request` por incompatibilidade de schema (coluna ausente/estrutura diferente).

Além disso, filtros por `owner_user_id` em tabelas de alertas também podiam provocar falhas de compatibilidade na hidratação.

## 2) Compatibilidade de schema para `alertas_resolvidos` / `alertas_adiados`
### Ajuste feito
Em `operationalPersistence` foi adicionada compatibilização por tabela:
- `buildOperationalCreatePayload(table, record, userId)`
- `buildAlertResolvedPayload(...)`
- `buildAlertSnoozedPayload(...)`
- `tableSupportsOwnerScope(table)`

Regras aplicadas:
- `alertas_resolvidos` e `alertas_adiados` agora usam payload mínimo compatível (ex.: `chave`, `ate/snooze_until`, `origem`, `observacao`, datas) e **não dependem obrigatoriamente** de `owner_user_id`.
- `update`/`delete` agora aplicam filtro `.eq('owner_user_id', userId)` apenas quando a tabela suporta escopo por owner.

### Fallback preservado
Se a persistência cloud falhar:
- UI local continua funcionando (Resolver/Adiar não quebra);
- retorno permanece com `syncStatus` de fallback (`pending_sync`/`local_only`);
- localStorage continua como fallback confiável de notificações.

## 3) Classificação segura de erro (cloud save)
Implementado em `operationalPersistence`:
- classificação explícita por status/code:
  - `config_error`
  - `auth_not_ready`
  - `permission_denied`
  - `schema_error` (incluindo HTTP 400)
  - `network_error`
  - `unknown`
- logs DEV de sync enriquecidos com dados seguros:
  - `table`, `action`, `httpStatus`, `errorCode`, `syncStatus`, `safeDetails`, `safeHint`
- sem exposição de JWT/token/header/segredos.

Mensagens de fallback para UI mantidas seguras em português:
- `Registro salvo localmente. Sincronização pendente.`

## 4) Cloud-first para registros principais
O fluxo cloud-first já existente foi mantido e reforçado na camada comum:
- tenta cloud quando `env + sessão + user` estão prontos;
- só retorna `cloud_success` quando write realmente conclui;
- falha retorna fallback com `syncStatus` + `code` seguro.

Prioridades pedidas:
- Fazenda e Estoque continuam consumindo `syncStatus` e já exibem:
  - `Registro salvo na nuvem.`
  - `Registro salvo localmente. Sincronização pendente.`
  - em DEV, motivo/código seguro.

## 5) Diagnóstico localhost vs Vercel (`/api/cloud-diagnostic`)
Em `supabaseDiagnostics`:
- localhost + `404` em `/api/cloud-diagnostic` agora classifica como:
  - `local_serverless_unavailable`
- mensagem DEV aplicada:
  - `Diagnóstico serverless indisponível no localhost. Use Vercel Preview ou vercel dev para testar.`
- isso evita interpretar 404 local como ausência de env do Supabase.

## 6) Hidratação operacional de alertas
Em `useOperationalData`:
- adicionada tabela `alertas_adiados` no snapshot operacional;
- `alertas_resolvidos`/`alertas_adiados` removidas do escopo obrigatório por `owner_user_id` para evitar falha de schema na hidratação.

## 7) Verificação solicitada (status)
### `alertas_resolvidos/alertas_adiados` cloud table support
- Agora com payload compatível e escopo flexível por tabela.
- Se o schema remoto ainda divergir, app mantém fallback local sem quebrar UI, com `syncStatus` e `code` seguros.

### Fazenda create syncStatus
- **Requer validação manual no ambiente com Supabase configurado e sessão ativa**.
- Resultado esperado:
  - `cloud_success` quando write remoto passar;
  - caso contrário `pending_sync/local_only` com `code` seguro.

### Estoque create syncStatus
- **Requer validação manual no ambiente com Supabase configurado e sessão ativa**.
- Resultado esperado igual ao de Fazenda.

## 8) O que não foi alterado
- comportamento de clique das notificações
- schema Supabase, RLS e auth rules
- cálculos de negócio
- relatórios, dashboard layout, agrupamento de navegação

## 9) Testes
- `git grep -n -E "^(<<<<<<<|=======|>>>>>>>)" -- .`:
  - sem conflitos encontrados
- `npm run build`:
  - OK
- `npm run lint`:
  - OK (warnings preexistentes; sem erros)
