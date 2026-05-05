# SPRINT13 — Executive Dashboard Herdon

## Melhorias aplicadas no dashboard
- Reforço da proposta de “command center” com KPIs mais executivos e leitura imediata.
- Cartões principais passaram a destacar melhor:
  - cabeças ativas
  - lotes ativos
  - resultado financeiro consolidado
  - margem consolidada
  - status de nuvem
  - ações pendentes
- Faixa de sinais executivos ampliada com indicadores financeiros úteis para gestão diária.

## Fontes de dados reutilizadas
- Reuso de `getResumoLote` como base de agregação por lote.
- Reuso de campos financeiros normalizados já existentes no projeto:
  - `receitaTotal`
  - `custoTotal`
  - `lucroTotal`
  - `lucroPorCabeca` (consolidado derivado)
  - `lucroPorArroba` (consolidado derivado)
  - `margemPct` (consolidado derivado)
  - `custoPorCabecaDia` (média consolidada)

## Mudanças de KPI/insight
- KPI financeiro principal passou a usar lucro total consolidado dos lotes ativos.
- KPI de margem consolidada incluído para leitura de eficiência.
- KPI de status da nuvem vinculado ao estado verificado do diagnóstico serverless já existente.
- KPI de ações pendentes consolidando pendências operacionais.
- Sinais executivos com foco em rentabilidade por cabeça/arroba e custo diário por cabeça.

## Como métricas não suportadas são tratadas com segurança
- Quando não há base de dados suficiente, a UI exibe estado neutro em português (`Sem base`) em vez de inventar números.
- Não foi adicionada fonte externa nem dado sintético para “preencher” indicadores.

## O que intencionalmente não foi alterado
- Não houve mudanças em schema Supabase, RLS, auth, sync core, diagnóstico manual serverless ou cálculos de negócio base.
- Apenas reorganização/apresentação executiva com reuso de contratos existentes.

## Testes
- `rg -n "^(<<<<<<<|=======|>>>>>>>)" -S .` → sem conflitos.
- `npm run build` → sucesso.
- `npm run lint` → sucesso com warnings preexistentes (sem erros).
