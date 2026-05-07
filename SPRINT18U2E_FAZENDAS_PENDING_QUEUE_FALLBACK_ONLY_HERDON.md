# SPRINT18U2E_FAZENDAS_PENDING_QUEUE_FALLBACK_ONLY_HERDON

## Objetivo
Garantir fila pendente como fallback real para Fazendas, sem duplicar/recriar registros quando cloud_success já ocorreu.

## Ajustes aplicados

1. **Fallback-only mantido**
- Pendência continua sendo adicionada apenas em falhas reais de cloud/readiness (sem pendência em `cloud_success`).
- `cloud_success` mantém limpeza de pendências correlatas já implementada no serviço.

2. **Manual sync e dedupe**
- Replay já usa caminhos corretos por ação (create/update/delete) e remove item quando `persisted`.
- Create de Fazendas já usa idempotência cloud (equivalência) no create path, evitando duplicata/recreate.

3. **Delete pendência não-id-only**
- Delete pendência segue com selector/payload enriquecido (não apenas `{ id }`).

4. **Logs 400 seguros reforçados**
- Em erros de create/update/delete foram adicionados campos seguros no log operacional:
  - `selectorType`
  - `payloadKeys`
  - `safeMessage`
  - além de `safeDetails`/`safeHint`
- Sem exposição de token/JWT/header/sessão completa/segredos.

## Validação manual (nesta execução)
> Ambiente CLI sem UI interativa para confirmar contadores/header em tempo real.

1. Fila antes: não observável via CLI
2. Fila depois de create cloud_success: esperado sem nova pendência; não observável via CLI
3. Fila depois de edit cloud_success: esperado sem nova pendência; não observável via CLI
4. Fila depois de delete cloud_success: esperado sem nova pendência; não observável via CLI
5. Clicar Sincronizar criou duplicata: mitigado por dedupe/idempotência; pendente validação UI
6. Erros 400 restantes: não reproduzido nesta sessão
7. Header voltou para Nuvem ativa: depende do runtime UI/eventos; pendente validação UI

## Não alterado
- UI de Fazendas
- Login
- Notificações
- Dashboard
- Schema/RLS/auth

## Validação
- `git grep -n -E "^(<<<<<<<|=======|>>>>>>>)" -- .` ✅
- `npm run build` ✅
- `npm run lint` ✅ (warnings existentes)
