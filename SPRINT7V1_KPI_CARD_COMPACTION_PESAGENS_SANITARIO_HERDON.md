# Sprint 7V.1 — KPI/Card Compaction for Pesagens and Sanitário

## Objetivo
Refinar a densidade visual das páginas de `Pesagens` e `Manejo Sanitário`, reduzindo a altura excessiva dos cards-resumo e aproximando o início das tabelas sem alterar fluxos, módulos, navegação ou lógica.

## Arquivos alterados
- `src/pages/PesagensPage.jsx`
- `src/pages/SanitarioPage.jsx`
- `src/styles/app.css`

## Componentes e seções refinados

### Pesagens
- Cabeçalho da página (`título`, `subtítulo` e ação `+ Nova pesagem`)
- Grade de KPIs (`kpi-grid-3`)
- Cards de resumo (`kpi-card`)
- Ritmo entre cabeçalho, ação principal, KPIs e tabela

### Manejo Sanitário
- Cabeçalho com `PageHeader`
- Botão `+ Novo Manejo`
- Grade de cards-resumo
- Cards de resumo do sanitário
- Espaçamento antes da tabela principal

## Melhorias exatas de spacing e compactação

### Pesagens
- Redução do padding interno dos KPI cards para `14px 16px`
- Redução do `gap` interno dos cards para `10px`
- Redução visual da altura mínima dos cards com `min-height: 0`
- Ajuste da tipografia do label para `0.72rem` com melhor hierarquia
- Ajuste do valor principal para `clamp(1.35rem, 1.8vw, 1.82rem)`
- Ajuste do texto de apoio (`kpi-sub`) para `0.8rem` com `line-height: 1.4`
- Redução do espaço entre cabeçalho e bloco de KPI para `16px`
- Redução do `margin-top` do subtítulo do cabeçalho para `6px`
- Redução do espaço abaixo da grade de KPIs para `14px`

### Manejo Sanitário
- Criação de uma grade compacta de resumo com `3 colunas` e `gap: 12px`
- Redução do padding dos summary cards para `16px 18px`
- Redução do espaçamento do header interno dos cards para `8px`
- Valor principal dos cards ajustado para `clamp(1.5rem, 2vw, 2rem)`
- Títulos dos cards em uppercase com leitura mais técnica e compacta
- Redução do espaço entre `PageHeader` e a grade de KPIs para `16px`
- Ajuste fino do espaço antes da tabela com `margin-top: 2px`
- Botão `+ Novo Manejo` preservado e mantido proeminente com `min-height: 42px`

### Regras visuais preservadas
- Identidade dark premium mantida
- Acentos verdes preservados
- Legibilidade mantida
- Nenhum módulo, aba, subtaba, tabela ou ação foi removido

## Resultado do build
- `npm.cmd run build`: concluído com sucesso

## Resultado do lint
- `npm.cmd run lint`: concluído sem erros
- Estado atual: `30 warnings` preexistentes de `react-hooks/exhaustive-deps` em múltiplas páginas do projeto
- Nenhum erro novo bloqueante foi introduzido por este sprint

## Validação funcional
- `Nova pesagem` permanece visível e funcional
- `+ Novo Manejo` permanece visível e funcional
- Tabelas de ambas as páginas foram preservadas
- Nenhuma regra de negócio foi alterada
- Nenhuma navegação foi alterada
- Nenhuma funcionalidade foi removida

## Observação
Este sprint foi executado como ajuste exclusivamente visual/layout, conforme solicitado.
