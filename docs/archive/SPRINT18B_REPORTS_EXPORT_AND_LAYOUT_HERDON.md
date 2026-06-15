# SPRINT18B_REPORTS_EXPORT_AND_LAYOUT_HERDON

## Melhorias de layout em Relatórios/Resultados
- Refinado o visual da página de Relatórios para reduzir sensação de peso visual, melhorar hierarquia e leitura em cards e blocos de contexto.
- Ajustado comportamento responsivo para reduzir recortes e overflow em dispositivos menores.
- Melhorias de densidade visual (menos áreas vazias em cards de tipo de relatório e melhor distribuição em grids).
- Preservada identidade visual dark/premium HERDON.

## Refinos de filtros e organização
- Mantida a estrutura de filtros já existente (período, fazenda, lote e status), com foco em clareza e legibilidade no fluxo de aplicação.
- Mantido escopo único entre filtros e conteúdo exibido, refletindo a mesma janela de leitura e os mesmos recortes nas tabelas e resumos.

## Exportação implementada
- Implementada exportação prática em **CSV** para o relatório ativo.
- A exportação usa as abas/datasets já montados pelo `exportConfig` do relatório ativo e respeita os filtros aplicados na tela.
- Cabeçalhos gerados em português (com normalização de campos em camelCase/snake_case para rótulos legíveis).
- Adicionado botão **Exportar CSV** no bloco principal de exportação.
- Adicionado botão **Imprimir** (layout print-friendly simples via CSS).

## Dados incluídos na exportação (por relatório ativo)
- Lote: resumo por lote + sanidade associada.
- Fazenda: consolidação por fazenda + recorte simplificado de lotes.
- Sanitário: agenda sanitária (inclui agenda IATF quando no escopo sanitário de dados).
- Estoque: saldo + movimentações filtradas.
- Financeiro: lançamentos + resumo financeiro.
- Desempenho: ranking de desempenho.

## Reuso de contratos existentes
- Mantido uso dos campos financeiros normalizados já existentes no domínio de relatórios/resumos.
- Mantido uso de metadados de planejamento/lote já parseados e exibidos no bloco de planejamento.
- Mantido uso de pagamentos diários derivados de `movimentacoes_financeiras` categorizadas.
- Mantido uso de dados IATF/Reprodução vindos do sanitário com marcação compatível.

## Estados vazios seguros
- Mantidos/normalizados estados de exportação com mensagens seguras:
  - "Sem dados suficientes"
  - "Estimativa indisponível"
  - "Nenhum registro encontrado"

## O que não foi alterado
- Supabase schema
- RLS
- Regras de auth
- Núcleo de sync
- Fonte de verdade do diagnóstico manual em nuvem
- Controles globais de nuvem no AppHeader
- Fórmulas de negócio (GMD/consumo/custos)
- Persistência de pagamentos diários
- Persistência IATF
- Modelo de permissões

## Testes
- `git grep -n -E "^(<<<<<<<|=======|>>>>>>>)" -- .` sem conflitos.
- `npm run build` concluído com sucesso.
- `npm run lint` concluído com sucesso (apenas warnings preexistentes).
