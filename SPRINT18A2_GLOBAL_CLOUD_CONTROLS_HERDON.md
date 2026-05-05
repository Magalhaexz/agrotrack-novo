# SPRINT18A2_GLOBAL_CLOUD_CONTROLS_HERDON

## Onde os controles de nuvem foram movidos
- Os controles globais de nuvem foram adicionados no `AppHeader` (menu/header principal), junto ao chip de status da nuvem:
  - Testar conexão
  - Sincronizar
  - Reconectar
- O status global de nuvem continua visível no mesmo bloco do header.

## Como FazendasPage foi simplificada
- Foram removidos do topo da `FazendasPage` os botões de nuvem:
  - Sincronizar fazendas e lotes com a nuvem
  - Testar conexão com a nuvem
  - Reconectar à nuvem
- A página mantém foco no cadastro e gestão de fazendas.

## Como as permissões foram preservadas
- As ações globais de nuvem continuam usando as mesmas regras de permissão (`hasPermission('fazendas:editar')`) antes de executar:
  - sincronização
  - diagnóstico
  - reconexão
- Mensagens amigáveis em português foram mantidas para acesso negado.

## Como o diagnóstico serverless foi preservado
- A ação “Testar conexão” continua utilizando `runMinimalCloudDiagnostic`.
- `/api/cloud-diagnostic` permanece como fonte única do diagnóstico manual.
- Não foi reintroduzido fallback REST/browser antigo.

## O que não foi alterado
- Supabase schema
- RLS
- Regras de auth
- Cálculos de negócio
- Financeiro
- Contratos de relatórios
- Persistência de tarefas/notificações

## Resultados dos testes
- `git grep -n -E "^(<<<<<<<|=======|>>>>>>>)" -- .` sem conflitos.
- `npm run build` concluído com sucesso.
- `npm run lint` concluído com sucesso (apenas warnings preexistentes).
