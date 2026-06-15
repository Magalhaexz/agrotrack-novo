# SPRINT20F4_GOVERNANCA_ACCESS_MOBILE_POLISH_HERDON

## Arquivos alterados
- src/pages/ConfiguracoesPage.jsx
- src/pages/FuncionariosPage.jsx
- src/styles/app.css

## Melhorias visuais/mobile
- Usuários e Acessos:
  - melhoria de clareza com legenda "Usuário x Funcionário"
  - badges padronizadas para perfis e status
  - empty states revisados (usuário ativo/convite pendente/cancelado)
- Funcionários:
  - empty states específicos por filtro (ativos vs inativos/desligados)
  - ações mantidas com layout mais robusto para mobile
- Polimento mobile/global:
  - botões e controles com mínimo de 44px
  - quebra de linha para ações quando necessário
  - prevenção de corte/overflow horizontal em tabelas via wrapper responsivo
  - ajuste de grid da linha de funcionário para caber melhor em telas pequenas

## Validação build/lint
- npm run build
- npm run lint

## Pendências conhecidas
- Parte da área de acessos ainda usa tabela no mobile; uma evolução futura pode migrar para cards completos para legibilidade máxima.

## Riscos
- Em telas com muitos dados por célula (e-mails longos), pode haver necessidade de truncamento visual adicional para manter ritmo de leitura no mobile.
