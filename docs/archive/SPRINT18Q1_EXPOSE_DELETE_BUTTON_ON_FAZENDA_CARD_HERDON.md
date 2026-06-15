# SPRINT18Q1_EXPOSE_DELETE_BUTTON_ON_FAZENDA_CARD_HERDON

## Objetivo
Expor ação visível de exclusão no card de Fazenda sem alterar a lógica já existente de exclusão em `FazendasPage`.

## Mudanças realizadas
1. `FazendaCard` agora aceita prop `onDelete`.
2. Adicionado botão visível **Excluir** no header do card.
3. Botão usa `type="button"`.
4. Clique no botão executa:
   - `event.preventDefault()`
   - `event.stopPropagation()`
   - `onDelete?.()`
5. Mantido comportamento de clique no card para abrir/selecionar.
6. Texto de fallback permanece com em-dash correto `—` e label `Responsável`.
7. Adicionado estilo dark premium de perigo/outline para o botão de exclusão.

## Comportamento esperado
- Clique no card: abre/seleciona fazenda.
- Clique em **Excluir**: dispara somente fluxo de exclusão existente em `FazendasPage` (com confirmação e validações de vínculo).

## O que não foi alterado
- Lógica `excluirFazenda`.
- Cloud sync queue.
- Google login.
- Notifications.
- Reports/dashboard.
- Schema/RLS/auth do Supabase.
- Cálculos de negócio.

## Validação
- `git grep -n -E "^(<<<<<<<|=======|>>>>>>>)" -- .`
- `git grep -n -E "Ã|â€”|�" -- src/components/fazendas/FazendaCard.jsx`
- `npm run build`
- `npm run lint`
