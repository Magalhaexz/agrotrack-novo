# SPRINT15_ACCESS_CONTROL_AND_PERMISSIONS_HERDON

## Modelo de perfis/roles encontrado
- Perfis identificados no frontend (arquivo de perfis/autorização):
  - PROPRIETARIO
  - GERENTE
  - OPERADOR
  - VISUALIZADOR
- O controle usa `hasPermission(...)` no contexto de autenticação e permissões por módulo/ação na UI.

## Áreas revisadas
- Dashboard
- Fazendas
- Lotes
- Animais
- Estoque/Suplementos
- Financeiro
- Pagamentos Diários
- Sanitário
- IATF/Reprodução
- Relatórios
- Ações de sync/cloud
- Ações de criar/editar/excluir

## Ações de UI protegidas nesta sprint

### Dashboard
- Proteção para criação de tarefa e marcação de tarefa concluída (`tarefas:editar`).
- Botões de ação rápida agora respeitam permissões de edição:
  - nova pesagem
  - novo lote
  - registrar manejo sanitário
  - registrar consumo
- Botão de adicionar tarefa desabilitado para perfil sem permissão.

### Fazendas / ações de nuvem
- Proteção explícita para:
  - sincronizar fazendas/lotes com nuvem
  - testar conexão com nuvem
  - reconectar nuvem
- Botões de nuvem e botão de novo cadastro de fazenda agora desabilitam para usuários sem `fazendas:editar`.
- Mensagens amigáveis em português para acesso negado.

### Financeiro / Pagamentos Diários
- Botão “Salvar pagamento diário” desabilitado quando não há permissão financeira.
- Checkbox de “pago” desabilitado sem permissão de edição financeira.
- Mensagem de orientação visível: “Acesso restrito ao perfil autorizado.”

## Comportamento por perfil (UI)
- VISUALIZADOR: mantém leitura de telas e dados permitidos; ações de edição/cadastro/exclusão ficam bloqueadas/desabilitadas.
- OPERADOR/GERENTE/PROPRIETARIO: seguem regras já existentes em `hasPermission` para cada módulo.

## Limitações (frontend-only)
- Este sprint fortalece **somente o controle de UI**.
- Não substitui segurança de backend/RLS.
- Não há criação de “segurança fake” no servidor.

## O que intencionalmente não foi alterado
- Schema Supabase
- Políticas RLS
- Regras de auth
- Núcleo de sync
- Source of truth do diagnóstico cloud manual
- Cálculos financeiros
- Cálculos de GMD/consumo de lotes
- Persistência de pagamentos diários
- Persistência de IATF
- Contratos de dados de relatórios

## Testes
- `rg -n "^(<<<<<<<|=======|>>>>>>>)" -S .` sem conflitos.
- `npm run build` concluído com sucesso.
- `npm run lint` concluído com sucesso (apenas warnings preexistentes).
