# SPRINT11 — Core Data Sync Hardening (Herdon)

## Fluxos revisados
- **Fazendas**: create/update/delete + sync manual por bridge serverless.
- **Lotes**: create/update + sync manual por bridge serverless.
- **Animais**: create/update/delete em fluxo operacional acoplado a lotes.

## O que foi endurecido
1. **Resultado de persistência mais explícito** em `operationalPersistence`:
   - `buildFallback` agora retorna também `syncStatus: "local_only"` e `code` seguro.
   - caminhos de create/update/delete propagam `code` de prontidão (ex.: sessão/nuvem não pronta) e falha de escrita (`WRITE_FAILED`) quando aplicável.
   - sucesso cloud retorna `syncStatus: "cloud_success"`.

2. **Criação de Lote + Animais + Custo** não “finge sync completo”:
   - antes: mesmo com falha de escrita cloud em parte do fluxo, ainda havia toast final de sucesso total.
   - agora: feedback diferencia:
     - sucesso total cloud
     - sincronização parcial
     - salvo apenas local
   - evitando percepção falsa de sincronização completa.

## Como falhas de escrita cloud agora são tratadas
- Escritas que falham continuam preservando dados locais (fallback seguro), mas com status/código explícitos para consumo do app.
- UI de criação de lote exibe mensagens claras em português para parcial/failed local-only, sem mascarar erro como sucesso total.

## Como o fallback local continua seguro e transparente
- Fallback local **foi mantido**.
- Mensagens ao usuário deixam explícito quando a nuvem não foi persistida completamente.
- Não foram adicionados logs com segredos (sem token/JWT/header/chaves/sessão completa).

## O que intencionalmente não foi alterado
- Não houve alteração de schema Supabase.
- Não houve alteração de políticas RLS.
- Não houve alteração de regras de auth.
- Não houve alteração dos cálculos/regras core de negócio.
- Não houve reintrodução de fallback browser REST no fluxo de diagnóstico manual.

## Testes
- `rg -n "^(<<<<<<<|=======|>>>>>>>)" -S .` → sem conflitos.
- `npm run build` → sucesso.
- `npm run lint` → sucesso com warnings preexistentes (sem erros).
