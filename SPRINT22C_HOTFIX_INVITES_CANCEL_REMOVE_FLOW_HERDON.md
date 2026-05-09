# SPRINT22C_HOTFIX_INVITES_CANCEL_REMOVE_FLOW_HERDON

## Root cause
- O fluxo de atualização de convite usava `.single()` em operação `update`, o que pode falhar quando a atualização não retorna linha conforme esperado no contexto (ex.: retorno vazio/shape diferente), gerando falsa percepção de sucesso parcial e inconsistência no refresh da lista.
- A UI dependia de atualização local parcial e refresh posterior, mas sem remover imediatamente o item da visão de pendentes em todos os cenários.

## Service changes
- `src/services/userAccess.js`
  - `updateInvite` alterado de `.single()` para `.maybeSingle()` para tolerar respostas vazias sem quebrar o fluxo de atualização.

## UI state changes
- `src/pages/ConfiguracoesPage.jsx`
  - `mensagemErroSegura` agora trata `400/406` com mensagem segura:
    - "Não foi possível atualizar o convite. Atualize a lista e tente novamente."
  - `cancelarConvite`:
    - tenta atualizar para `cancelado` com `canceled_at/cancelled_at`;
    - fallback para update apenas de `status` quando necessário;
    - remove imediatamente da lista local de pendentes;
    - recarrega dados do Supabase após sucesso.
  - `removerConvitePendente`:
    - tenta `delete`;
    - se delete falhar, fallback para `cancelado` (com e sem timestamps);
    - remove imediatamente da lista local de pendentes;
    - recarrega dados do Supabase após sucesso.
  - Logs DEV-only adicionados com prefixo `[HERDON_INVITES_DEBUG]` sem dados sensíveis.

## Validation
- `npm run build` ✅
- `npm run lint` ✅

## Manual test checklist
1. Criar convite pendente.
2. Cancelar convite.
3. Confirmar que some de "Convites pendentes" imediatamente.
4. Atualizar/reabrir página.
5. Confirmar que não retorna como pendente.
6. Criar novo convite pendente.
7. Remover convite pendente.
8. Confirmar que some da lista imediatamente.
9. Testar convite aceito: exibe mensagem de proteção e não remove como pendente.
10. Confirmar ausência de erro 406 visível ao usuário.
