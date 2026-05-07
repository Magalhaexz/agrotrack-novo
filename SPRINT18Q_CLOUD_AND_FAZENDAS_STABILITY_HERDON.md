# SPRINT18Q_CLOUD_AND_FAZENDAS_STABILITY_HERDON

## Cloud queue state found (preflight)
- Código auditado em `processPendingSyncQueue`, `createOperationalRecord`, `updateOperationalRecord`, `deleteOperationalRecord`.
- O fluxo já possuía: retry throttling, bloqueio por `blocked_schema_error`, re-normalização de payload em retry e dedupe de hidratação.
- Ajuste aplicado: motivo de bloqueio padronizado para **"Pendência bloqueada por incompatibilidade de dados."** em itens incompatíveis.

## Blocked queue items handling
- Itens incompatíveis passam a manter código `blocked_schema_error` com mensagem segura padronizada.
- Em sync automática, itens bloqueados não entram em loop infinito; em sync manual, rodam 1 ciclo e retornam contagem/erro seguro.

## Fazenda duplication prevention
- Mantida validação idempotente no create em nuvem via:
  - `cloud_id`
  - `metadata.local_id`
  - fallback `nome|cidade|estado`
- Na UI, create agora reconcilia em memória por identidade lógica (não duplica card local ao receber retorno cloud/local).

## Hydration deduplication
- Mantido dedupe de `fazendas` em `normalizeDb` com prioridade de identidade:
  - `cloud_id` / `metadata.cloud_id`
  - `metadata.local_id`
  - fallback `nome|cidade|estado`
- Critério de vencedor: `updated_at`/`created_at` mais recente.

## Edit reliability fix
- Edit agora preserva `metadata.local_id` + `cloud_id` de forma explícita.
- `targetId` de update usa melhor identidade disponível (`cloud_id` -> `id` -> `local_id`).
- Atualização de estado local reconcilia por identidade lógica (incluindo fallback), evitando criação de novo registro.
- Mensagens de retorno ajustadas para:
  - "Fazenda atualizada na nuvem."
  - "Fazenda atualizada localmente. Sincronização pendente."

## Delete flow and safety checks
- Adicionado fluxo seguro de exclusão com:
  - permissão
  - confirmação com texto de risco exigido
  - bloqueio por vínculos locais
- Verificações de relacionamento locais:
  - `lotes`
  - `animais`
  - `movimentacoes_financeiras`
  - `estoque`
  - `sanitario`
- Se houver vínculo: bloqueia e mostra:
  - "Esta fazenda possui registros vinculados. Remova ou transfira os registros antes de excluir."
- Sem vínculos: executa `deleteOperationalRecord` (cloud-first), remove do estado local e informa:
  - sucesso: "Fazenda excluída."
  - fallback: "Exclusão registrada localmente. Sincronização pendente."

## Manual verification results
> Ambiente CLI sem browser interativo nesta execução. Validação funcional abaixo baseada em auditoria de fluxo e build/lint; os cenários de clique/UI devem ser confirmados no app rodando.

1. Pending queue before sprint:
- count: não observável via CLI (localStorage do browser)
- tables/actions: não observável via CLI
- codes: não observável via CLI

2. Create Fazenda:
- syncStatus: coberto por fluxo (`cloud_success`/`pending_sync`)
- cloud row created: não executado em UI nesta sessão
- duplicate created: mitigado por reconciliação de identidade e idempotência cloud

3. Manual sync after create:
- duplicated: mitigado por idempotência + reconciliação
- queue count: retornado por `processPendingSyncQueue` e exibido em toast

4. Edit Fazenda:
- opened modal: não executado em UI nesta sessão
- saved successfully: coberto por fluxo
- created duplicate: mitigado por reconciliação por identidade
- cloud update success: coberto por fluxo

5. Delete Fazenda without links:
- confirmation shown: implementado
- deleted from UI: implementado
- deleted/synced in cloud: coberto por `deleteOperationalRecord`

6. Delete Fazenda with linked records:
- blocked safely: implementado
- warning shown: implementado

7. Hydration after Ctrl+F5:
- duplicate cards visible: mitigado por dedupe em hidratação
- Fazenda count stable: mitigado por dedupe + reconciliação de estado

8. Header cloud state:
- before save: preservado
- after save: preservado
- after manual sync: preservado, com toast de synced/pending + primeiro erro seguro

## Intentionally not changed
- Schema Supabase, RLS, auth rules.
- Notificações (incluindo click behavior).
- Dashboard/reports/nav layout.
- Cálculos de negócio, GMD/consumo, pagamentos, IATF, PRO/pricing.

## Testing results
- `git grep -n -E "^(<<<<<<<|=======|>>>>>>>)" -- .` ✅
- `npm run build` ✅
- `npm run lint` ✅
