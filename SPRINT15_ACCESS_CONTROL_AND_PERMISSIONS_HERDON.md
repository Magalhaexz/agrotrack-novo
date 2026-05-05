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

### Lotes
- Botões sensíveis agora respeitam permissões na UI:
  - novo lote (`lotes:editar`)
  - registrar movimentação (`animais:movimentar`)
  - nova pesagem (`pesagens:editar`)
  - encerrar lote (`lotes:editar`)
- Fluxos já possuíam validação em handlers; sprint reforçou com botões desabilitados para perfis sem acesso.

### Animais
- Ações de criar/editar/excluir agora também ficam desabilitadas na interface quando o perfil não possui permissão.
- Mantido comportamento de leitura para perfis sem edição.

### Estoque / Suplementos
- Estoque: entradas/saídas e botões operacionais desabilitados sem `estoque:editar`.
- Suplementação: cadastro/edição/exclusão de dieta e registro de consumo diário desabilitados sem permissão.
- Fluxos já possuíam validação de ação; reforço foi aplicado na camada visual.

### Sanitário / IATF-Reprodução
- Botões de novo manejo, salvar protocolo IATF, editar e excluir manejo agora desabilitam sem permissões correspondentes.
- Mantido acesso de visualização dos registros para leitura operacional.

### Relatórios
- Revisão concluída: fluxo atual está focado em leitura e filtros.
- Mantido como leitura sem alteração de contratos de dados e sem bloqueio adicional nesta etapa para evitar regressão de acesso visual.

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
