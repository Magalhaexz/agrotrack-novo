# SPRINT18A4_HEADER_CLOUD_DROPDOWN_FIX_HERDON

## Escopo executado
- Ajustado **somente** o layout dos controles globais de nuvem no `AppHeader`.
- Mantido o status de nuvem no header com chip compacto (linha principal + detalhe).
- Movidas as ações para um menu dropdown compacto:
  - Testar conexão
  - Sincronizar
  - Reconectar

## Preservações garantidas
- Controles permanecem no header global (não voltaram para `FazendasPage`).
- Handlers preservados:
  - `onTestCloud`
  - `onSyncNow`
  - `onReconnectCloud`
- Estados `disabled/loading` preservados por ação.
- Comportamento de permissão preservado (ações continuam dependendo dos handlers/estado recebidos).
- Fonte manual de diagnóstico preservada: `/api/cloud-diagnostic` (nenhuma alteração no fluxo).
- Sem alterações de schema Supabase, RLS, auth, core sync, cálculos, Financeiro, Relatórios, Dashboard ou Tarefas.
- Texto em português mantido.
- Estilo premium dark HERDON preservado.

## Arquivos alterados
- `src/components/AppHeader.jsx`
- `src/styles/app.css`

## Notas técnicas
- No chip de nuvem, os três botões inline foram substituídos por um botão único de `Ações` com dropdown.
- O dropdown fecha após acionar cada ação.
- Ajustes responsivos adicionados para evitar sobreposição com área de notificações/usuário em larguras menores.

## Validação solicitada
1. `git grep -n -E "^(<<<<<<<|=======|>>>>>>>)" -- .`
- Resultado: `NO_CONFLICT_MARKERS`

2. `npm run build` (executado como `npm.cmd run build` por política local do PowerShell)
- Resultado: **OK**

3. `npm run lint` (executado como `npm.cmd run lint` por política local do PowerShell)
- Resultado: **OK com warnings preexistentes** (`29 warnings`, `0 errors`)
