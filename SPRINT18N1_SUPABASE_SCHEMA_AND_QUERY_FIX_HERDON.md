# SPRINT18N1_SUPABASE_SCHEMA_AND_QUERY_FIX_HERDON

## Escopo aplicado
- `src/services/operationalPersistence.js`
- `src/services/supabaseDiagnostics.js`
- `src/hooks/useOperationalData.js`
- `SUPABASE_SCHEMA_ALERTAS_FAZENDAS_FIX_HERDON.md`

## Parte A — Diagnóstico seguro de 400
Foi reforçado o diagnóstico seguro no fluxo operacional:
- log DEV com:
  - `table`
  - `action`
  - `httpStatus`
  - `errorCode`
  - `safeDetails`
  - `safeHint`
  - `requestStage`
  - `syncStatus`
- classificação de `400` como `schema_error` por padrão.

Nenhum segredo é logado (sem JWT/token/header/sessão completa).

## Parte B — Compatibilidade `alertas_resolvidos` / `alertas_adiados`
### Ajustes aplicados
- detecção/capacidade por tabela com cache em runtime:
  - `tableSupportsOwnerScope(table)`
  - `tableSupportsMetadata(table)`
  - `tableSupportsCreatedAt(table)`
- payloads mínimos dedicados:
  - `alertas_resolvidos`: `chave`, `origem`, `resolved_at`, `observacao` (+ `created_at` só se suportado)
  - `alertas_adiados`: `chave`, `ate`, `snooze_until`, `origem`, `observacao` (+ `created_at` só se suportado)
- `owner_user_id` só é enviado quando suportado.
- retry automático sem owner scope quando erro indica coluna `owner_user_id` ausente.
- fallback local continua preservado (UI não quebra).

### Leitura/hidratação
- `useOperationalData` agora inclui `alertas_adiados` no snapshot.
- leitura de tabelas tenta com owner scope e faz retry sem owner scope quando detecta erro de schema por `owner_user_id`.

## Parte C — Correção de 400 em `fazendas`
### Escrita
- create de `fazendas` agora usa payload progressivo seguro:
  - tentativa `expanded` (campos comuns)
  - fallback `minimal` (campos essenciais)
- isso reduz falhas por coluna inexistente.
- owner scope opcional por capacidade detectada.

### Update/Delete
- `update` e `delete` tentam com owner scope, e em caso de erro de coluna owner fazem retry sem owner scope e atualizam capacidade em cache.

### Leitura
- na hidratação operacional, leitura de `fazendas` também faz fallback sem owner scope se necessário.

## Parte D — Detecção de capacidades
Implementado cache de capacidades por tabela em runtime:
- `ownerScope`
- `metadata`
- `createdAt`

Com atualização dinâmica conforme erros de schema detectados (ex.: coluna `owner_user_id` ausente).

## Parte E — Documento SQL de apoio
Criado:
- `SUPABASE_SCHEMA_ALERTAS_FAZENDAS_FIX_HERDON.md`

Inclui:
- query de inspeção em `information_schema.columns`
- SQL para criar `alertas_adiados` se ausente
- SQL para compatibilizar colunas de `alertas_resolvidos`
- índices opcionais
- políticas RLS opcionais baseadas em `owner_user_id` (somente se coluna existir)

Sem alegação de aplicação automática.

## Parte F — Verificação manual solicitada
1. Exact Supabase 400 root cause if discoverable:
- **Provável causa raiz**: incompatibilidade de schema (especialmente uso de `owner_user_id`/colunas opcionais em tabelas que não possuem esse campo), gerando `400`.

2. Whether alertas_resolvidos has owner_user_id:
- **Não verificado automaticamente** neste ambiente.

3. Whether alertas_resolvidos has created_at:
- **Não verificado automaticamente** neste ambiente.

4. Whether alertas_adiados exists:
- **Não verificado automaticamente** neste ambiente.

5. Whether fazendas has owner_user_id:
- **Não verificado automaticamente** neste ambiente.

6. Whether fazendas read succeeds:
- **Não verificado manualmente** aqui.

7. Whether Fazenda create returns cloud_success:
- **Não verificado manualmente** aqui.

8. Whether Resolver cloud persistence succeeds or remains local fallback:
- **Não verificado manualmente** aqui.

9. If fallback, exact safe code/message:
- Código esperado após correção quando houver 400: `schema_error`
- Mensagem segura: `Registro salvo localmente. Sincronização pendente.`

## Diferença localhost x Vercel (diagnóstico)
- Em localhost com `404` em `/api/cloud-diagnostic`, agora classifica como `local_serverless_unavailable`.
- Mensagem DEV:
  - `Diagnóstico serverless indisponível no localhost. Use Vercel Preview ou vercel dev para testar.`

## O que não foi alterado
- comportamento de clique das notificações
- layout/UI
- dashboard/reports/navigation grouping
- cálculos de negócio
- auth rules do frontend

## Testes
- `git grep -n -E "^(<<<<<<<|=======|>>>>>>>)" -- .`:
  - sem conflitos encontrados
- `npm run build`:
  - OK
- `npm run lint`:
  - OK (warnings preexistentes; sem erros)
