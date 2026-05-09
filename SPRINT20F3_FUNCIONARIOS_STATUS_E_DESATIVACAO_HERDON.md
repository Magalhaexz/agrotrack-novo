# SPRINT20F3_FUNCIONARIOS_STATUS_E_DESATIVACAO_HERDON

## Arquivos alterados
- src/pages/FuncionariosPage.jsx
- src/components/funcionarios/FuncionarioRow.jsx
- src/components/FuncionarioForm.jsx

## Status e ações implementadas
- Status suportados:
  - ativo
  - inativo
  - desligado
- Novo funcionário continua iniciando como ativo por padrão.
- Ações adicionadas na listagem:
  - Desativar
  - Reativar
  - Marcar desligado
- Remoção definitiva deixou de ser ação principal nesta tela; substituída por ações de status com confirmação.
- Confirmações implementadas:
  - "O funcionário continuará no histórico, mas não aparecerá como ativo."
  - "Deseja reativar este funcionário?"
  - "Deseja marcar este funcionário como desligado?"
- Filtros implementados:
  - Ativos
  - Inativos/desligados
  - Todos
- Tabela/listagem com:
  - Nome
  - Cargo
  - Fazenda
  - Status
  - Telefone/e-mail
  - Ações
- Texto de contexto incluído:
  - Funcionário = pessoa vinculada à operação
  - Usuário = pessoa com acesso ao sistema

## Validação build/lint
- npm run build
- npm run lint

## Pendências conhecidas
- Em telas de outros módulos que selecionam responsável, a exclusão de inativos/desligados depende da lógica desses módulos (fora do escopo deste sprint).

## Riscos
- Registros antigos sem status explícito podem depender de fallback para `ativo` até normalização completa dos dados.
