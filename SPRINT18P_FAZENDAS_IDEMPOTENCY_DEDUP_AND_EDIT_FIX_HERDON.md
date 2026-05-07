# SPRINT18P_FAZENDAS_IDEMPOTENCY_DEDUP_AND_EDIT_FIX_HERDON

## Root cause of duplication
- Fazendas create flow could enqueue/replay `create` repeatedly without an idempotency lookup in cloud.
- Some local creates lacked stable `metadata.local_id` continuity during retries/edits.
- Hydration displayed raw fazendas arrays without deterministic de-duplication.

## Create replay / idempotency fix
- Added cloud-side idempotency check for `fazendas` create before insert:
  1. match by `cloud_id`/row id
  2. match by `metadata.local_id`
  3. fallback by normalized identity key (`nome|cidade|estado`)
- If match exists, create is treated as already synced and insert is skipped.

## Hydration deduplication
- Added deterministic de-dup for hydrated `fazendas` in `useOperationalData`.
- Identity priority: cloud id -> metadata.local_id -> fallback key (`nome|cidade|estado`).
- In duplicate groups, preferred record is the most recently updated (`updated_at`/`created_at`).

## Edit flow fix
- Edit now targets best available identity (`cloud_id`/metadata.cloud_id/id).
- Edit payload preserves `metadata.local_id` and cloud linkage.
- Local state reconciliation maps by stable identity, reducing accidental re-creates/duplicates.

## Null/trim runtime fix
- Hardened `FazendaModal` string normalization by using `String(value ?? '')` before `trim()`.
- Replaced direct nullable `.trim()` usages in submit/payload conversion.

## Intentionally not changed
- No Supabase schema changes.
- No RLS/auth rule changes.
- No layout redesign.
- No unrelated module/business logic changes.

## Testing results
- `git grep -n -E "^(<<<<<<<|=======|>>>>>>>)" -- .` passed (no conflict markers).
- `npm run build` passed.
- `npm run lint` passed with existing warnings only (no new lint errors).
