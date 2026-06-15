# Sprint 7V.4 — Settings / Danger Zone / Secondary Panels Polish

## Objetivo
Refinar o tratamento visual dos painéis secundários de configurações, com foco especial em `Dados e Segurança`, mantendo todas as ações, alertas e regras existentes.

## Arquivos alterados
- `src/pages/ConfiguracoesPage.jsx`
- `src/styles/configuracoes.css`

## Painéis melhorados
- Painel `Dados e Segurança`
- Área de ações de `exportar / importar / limpar`
- Bloco `Zona de perigo`
- Ritmo visual dos painéis administrativos secundários dentro de `Configurações`

## Refinamentos visuais exatos

### Dados e Segurança
- Criação de uma pilha visual mais clara com `config-data-stack`
- Separação entre contexto de manutenção e grupo de ações
- Novo bloco introdutório com kicker para orientar a área de backup/manutenção
- Cluster de ações com wrap e espaçamento mais premium
- Melhor equilíbrio entre botões primários e secundários

### Danger Zone
- Reestilização do bloco com fundo dark-danger mais deliberado
- Borda vermelha suavizada, mantendo semântica de risco
- Adição de `danger-zone-head` para melhor hierarquia
- Inclusão de chip visual de irreversibilidade
- Melhor contraste de título, texto de apoio e destaque de `CONFIRMAR`
- Campo e botão destrutivo agrupados em `danger-zone-controls`
- CTA destrutiva mantida evidente sem parecer crua ou agressiva demais

### Responsividade
- Melhor wrap dos grupos de ação em larguras menores
- Botões da área de dados e da danger zone empilham corretamente em mobile
- Controles permanecem visíveis e acessíveis

## Build e lint
- `npm.cmd run build`: concluído com sucesso
- `npm.cmd run lint`: concluído sem erros
- Estado atual do lint: `30 warnings` já existentes de `react-hooks/exhaustive-deps` no projeto

## Confirmação funcional
- Nenhuma funcionalidade foi removida
- Nenhuma ação de exportar, importar, limpar ou excluir foi removida
- Nenhum módulo, aba ou subtaba foi removido
- Nenhuma regra de negócio foi alterada
- Todos os avisos críticos foram preservados

## Observação sobre validação manual
- A validação manual visual da danger zone não foi executada em navegador nesta sessão
- As validações automáticas de build e lint foram concluídas com sucesso
