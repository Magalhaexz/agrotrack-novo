# Sprint 7V.2 — Table and Action Polish for Pesagens, Sanitário, Suplementação e Funcionários

## Objetivo
Aplicar polimento visual nas tabelas, colunas de ação, chips de status/variação e distribuição de linhas nas páginas operacionais, mantendo toda a lógica, módulos, abas, subtabs e rotas intactos.

## Arquivos alterados
- `src/pages/PesagensPage.jsx`
- `src/pages/SanitarioPage.jsx`
- `src/pages/SuplementacaoPage.jsx`
- `src/pages/FuncionariosPage.jsx`
- `src/components/funcionarios/FuncionarioRow.jsx`
- `src/styles/app.css`

## Páginas melhoradas
- `Pesagens`
- `Manejo Sanitário`
- `Suplementação`
- `Funcionários`

## Refinamentos aplicados

### Pesagens
- Melhor alinhamento visual na tabela `Histórico de pesagens`
- Coluna de variação convertida para célula semântica de chip
- Espaçamento mais consistente entre `Editar` e `Excluir`
- Melhor leitura de hover e ritmo de linha

### Manejo Sanitário
- Tabela com leitura mais organizada e melhor densidade vertical
- Melhor equilíbrio visual entre colunas numéricas, status e ações
- Ações preservadas e alinhadas em pills menores e mais regulares
- Status chips com ritmo visual mais consistente

### Suplementação
- Polimento dos dois blocos principais de tabela
- Melhoria da hierarquia visual em `Dietas vinculadas por lote`
- Melhoria da leitura em `Projeção de consumo de estoque`
- Chips de diferença e de dias restantes mais consistentes
- Colunas de ação padronizadas também dentro do modal de itens da dieta

### Funcionários
- Rebalanceamento da linha com grid visual para avatar, conteúdo, telefone e status
- Avatar com visual mais estável e premium
- Melhor separação entre nome, cargo/fazenda e telefone
- Status pills mais equilibradas em largura, altura e alinhamento
- Lista preservada sem alteração no comportamento de filtros

### Polimento compartilhado
- Padronização visual de `row-actions`
- Criação/refino visual de `action-btn`
- Normalização de chips `badge-g`, `badge-r`, `badge-a`, `badge-n` e `b-blue`
- Melhora de hover, borda, respiração vertical e leitura de linhas
- Manutenção do visual preto premium com acentos verdes

## Build e lint
- `npm.cmd run build`: concluído com sucesso
- `npm.cmd run lint`: concluído sem erros
- Estado atual do lint: `30 warnings` existentes de `react-hooks/exhaustive-deps` em arquivos já presentes no projeto

## Confirmação funcional
- Nenhuma funcionalidade foi removida
- Nenhum módulo foi removido
- Nenhuma aba ou subtaba foi removida
- Nenhuma rota foi alterada
- Nenhuma regra de negócio foi alterada
- Todas as ações relevantes permanecem visíveis no código
- Os chips de status continuam semanticamente corretos

## Observação sobre validação manual
- A validação manual em navegador não foi executada nesta sessão
- As validações automáticas de build e lint foram concluídas com sucesso
