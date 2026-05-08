# SPRINT20F1_CONVITES_E_USUARIOS_HERDON

## Arquivos alterados
- src/pages/ConfiguracoesPage.jsx

## O que foi implementado
- Separação visual da área de acessos em:
  - Usuários ativos (profiles)
  - Convites pendentes
  - Convites aceitos
  - Convites cancelados/expirados
- Usuários ativos continuam vindo de `profilesRows` (origem `profiles`).
- Convites continuam vindo de `invitesRows` (origem `invites`).
- Correção de ações:
  - Cancelar convite
  - Remover convite pendente
  - Bloqueio para remover convite aceito com mensagem orientativa.
- Após cancelar/remover convite:
  - atualização imediata no estado local
  - refresh da lista via `carregarDadosDeAcesso`

## Regras preservadas
- Sem alterações em funcionários.
- Sem alteração de schema Supabase.
- Sem alterações em Lotes, Animais, Pesagens, Nutrição e Relatórios.

## Validação
- npm run build
- npm run lint

## Pendências conhecidas
- Pode haver divergências de nomenclatura de status vindas do backend além de `pendente/enviado/aceito/cancelado/expirado`; necessário mapear novos status se surgirem.

## Riscos
- Se o backend retornar status inesperado, o convite pode cair fora do agrupamento previsto até ajuste do mapeamento.
