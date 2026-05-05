# SPRINT14_PREMIUM_REPORTS_HERDON

## Melhorias de relatórios realizadas
- Ampliação do relatório sanitário com quadro dedicado de **Agenda IATF / Reprodução** quando houver registros compatíveis.
- Ampliação do relatório financeiro com:
  - quadro dedicado de **Pagamentos diários**
  - quadro de **Planejamento de lote e estimativas** (GMD/dieta/consumo/projeções)
- Mantida estrutura premium de cards/tabelas com estados vazios seguros em português.

## Contratos de dados reutilizados
- Financeiro consolidado usando campos normalizados já existentes e agregações já presentes no relatório:
  - `receitaTotal`
  - `custoTotal`
  - `lucroTotal`
  - `lucroPorCabeca`
  - `lucroPorArroba`
  - `margemPct`
  - `custoPorCabecaDia`
- Movimentações financeiras a partir de `movimentacoes_financeiras`.
- Sanitário/reprodução a partir de `sanitario`.

## Representação de planejamento de lote / GMD / consumo
- Reaproveitamento de metadados já persistidos em campos compatíveis (`lotes.obs`).
- Parser de leitura no relatório para exibir:
  - GMD esperado
  - dieta/produto
  - tipo e valor de consumo
  - data prevista de saída **como projeção**
  - consumo estimado de suplemento
  - custo estimado de suplemento
- Sem alterar schema e sem converter projeção em evento real de saída.

## Como pagamentos diários são representados
- Pagamentos diários são lidos de `movimentacoes_financeiras` quando categoria = `Pagamento Diário` (ou variante sem acento).
- Exibidos em tabela dedicada no relatório financeiro.

## Como IATF/reprodução é representado
- Reuso de registros `sanitario` marcados como IATF.
- Exibição em tabela dedicada no relatório sanitário com protocolo, lote, fazenda, início, próxima ação e status.
- Sem inferir resultado clínico de diagnóstico de gestação.

## Filtros e layout
- Mantidos e reaproveitados filtros existentes por:
  - data
  - fazenda
  - lote
  - categoria/tipo
- Layout premium escuro preservado com seções limpas e badges de estado.

## Estados vazios seguros
- Implementados/garantidos estados em português:
  - "Nenhum registro encontrado"
  - "Sem dados suficientes"
  - "Estimativa indisponível"

## O que foi intencionalmente não alterado
- Schema Supabase
- Políticas RLS
- Regras de auth
- Núcleo de sync cloud/local
- Source of truth do diagnóstico cloud manual
- Cálculos de GMD/consumo
- Persistência de pagamentos diários
- Persistência de IATF

## Testes
- `rg -n "^(<<<<<<<|=======|>>>>>>>)" -S .` sem conflitos.
- `npm run build` concluído com sucesso.
- `npm run lint` concluído com sucesso (apenas warnings preexistentes).
