# SPRINT18A3_HEADER_CLOUD_CONTROLS_LAYOUT_FIX_HERDON

## O que quebrou no layout do header
- Após mover os controles globais de nuvem para o `AppHeader`, os botões longos ("Testar conexão", "Sincronizar", "Reconectar") estavam expandindo o chip de status e gerando quebra/sobreposição com a área de notificações/usuário.
- Em larguras menores, os botões competiam por espaço horizontal e causavam wrapping inadequado.

## Correção aplicada
- Mantido o bloco de controles **no header global**.
- Reestruturado o chip para layout compacto com:
  - ícone de estado
  - cópia de status (label + detalhe)
  - grupo de ações compacto
- Ajustadas labels para leitura curta e compacta:
  - Testar
  - Sync
  - Reconectar
- Mantidos handlers, disabled/loading states e comportamento de permissões já existentes.

## Responsividade
- Em desktop: ações aparecem inline em versão compacta.
- Em larguras intermediárias: labels dos botões compactos são ocultadas, mantendo ícones.
- Em telas menores: o grupo de ações quebra para uma nova linha dentro do próprio chip, evitando sobreposição com notificações/usuário.
- Status e detalhe usam ellipsis para evitar clipping.

## O que não foi alterado
- Schema Supabase
- RLS
- Auth
- Sync core
- Diagnóstico manual via `/api/cloud-diagnostic`
- Regras de negócio
- Financeiro
- Relatórios
- Dashboard
- Tarefas/Notificações

## Testes
- `git grep -n -E "^(<<<<<<<|=======|>>>>>>>)" -- .` sem conflitos.
- `npm run build` concluído com sucesso.
- `npm run lint` concluído com sucesso (warnings preexistentes).
