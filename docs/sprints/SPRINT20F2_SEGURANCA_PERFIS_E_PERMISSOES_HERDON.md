# SPRINT20F2_SEGURANCA_PERFIS_E_PERMISSOES_HERDON

## Arquivos alterados
- src/pages/ConfiguracoesPage.jsx

## Proteções implementadas
- Bloqueio de auto-remoção/auto-desativação com mensagem:
  - "Você não pode remover seu próprio acesso."
- Bloqueio de auto-rebaixamento administrativo com mensagem:
  - "Você não pode rebaixar seu próprio perfil administrativo."
- Bloqueio para remover/desativar/rebaixar o último admin/proprietário com mensagem:
  - "Não é possível remover ou rebaixar o último administrador."
- Confirmação obrigatória antes de alterar perfil de outro usuário:
  - "Alterar o perfil deste usuário pode limitar o acesso dele ao sistema. Deseja continuar?"
- Exibição de badge de perfil atual (Admin/Proprietário, Gerente, Operador, Visualizador).
- Exibição da origem do acesso quando disponível:
  - profile
  - fallback/bootstrap
- Aviso discreto para acesso bootstrap:
  - "Acesso especial de bootstrap."

## Regras preservadas
- Fluxo de convites do Sprint 20F1 mantido.
- Sem alterações em Funcionários.
- Sem alterações em schema Supabase.

## Validação
- npm run build
- npm run lint

## Pendências conhecidas
- Proteções de perfil ativo foram aplicadas ao fluxo fallback/bootstrap existente; ações diretas sobre `profiles` (quando houver edição completa no futuro) devem reutilizar as mesmas regras.

## Riscos
- Ambientes com múltiplas fontes de usuários fora do fallback podem demandar consolidação adicional da contagem de administradores ativos.
