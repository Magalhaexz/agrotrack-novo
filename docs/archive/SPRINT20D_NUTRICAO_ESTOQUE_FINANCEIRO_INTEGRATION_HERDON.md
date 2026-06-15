# SPRINT20D_NUTRICAO_ESTOQUE_FINANCEIRO_INTEGRATION_HERDON

## Arquivos alterados
- src/pages/SuplementacaoPage.jsx

## O que foi implementado
- Reorganização da página Nutrição/Suplementação com abas: Produtos nutricionais, Dietas, Consumo diário, Planejamento por lote e Histórico.
- Header simplificado com botões principais: Cadastrar produto nutricional e Registrar consumo.
- Novo modal de cadastro de produto nutricional com categorias, unidade, embalagem, conteúdo, custos, fornecedor, validade e observação.
- Cálculo automático de estoque total e custo total no cadastro (ex: 20 x 30 = 600).
- Vínculo com estoque: cria item em `estoque` com categoria `Nutrição / Alimentação` ou atualiza item existente sem duplicar.
- Fluxo de dieta (item único nesta sprint) com tipo de consumo e vínculo opcional a lote.
- Fluxo de consumo diário com baixa de estoque, histórico de consumo e lançamento financeiro em `movimentacoes_financeiras` na categoria `nutricao/alimentacao`.
- Planejamento por lote com previsto x realizado, diferença e custo estimado por dia.

## Regras preservadas
- Sem alteração de schema Supabase.
- Sem alterações em Lotes/Rebanho rebuild.
- Sem alterações em Animais/Pesagens simplificação.
- Sem alterações em Login/Auth e relatórios CSV/XLSX.
- Compatibilidade com dados existentes preservada usando coleções atuais (`estoque`, `dietas`, `consumo_suplementacao`, `movimentacoes_financeiras`).

## Validação
- npm run lint
- npm run build

## Pendências conhecidas
- Dieta multi-itens completa ficou como evolução futura (nesta sprint, fluxo simplificado priorizou item principal).
- Edição/exclusão de consumo com reversão transacional estoque+financeiro ainda não implementada.

## Riscos
- Como a integração usa estado operacional local existente, ambientes com dados legados inconsistentes podem exigir normalização adicional de categorias/unidades.
