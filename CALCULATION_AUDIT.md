# CALCULATION_AUDIT

## Objetivo

Realizar uma auditoria das principais fórmulas de negócio do HERDON para garantir consistência, segurança contra valores inválidos e previsibilidade nos fluxos usados por usuários pagos.

## Fórmulas revisadas

- Dias estimados = `(peso alvo final - peso médio inicial) / GMD esperado`
- Data prevista de saída = `data de entrada + dias estimados`
- Consumo diário por %PV = `((peso inicial + peso final) / 2) * percentual / 100`
- Consumo diário kg/cab/dia = `valor informado`
- Consumo por animal no período = `consumo diário * dias estimados`
- Consumo total do lote = `consumo por animal no período * quantidade de animais`
- Custo estimado total = `consumo total * preço/kg`
- UA animal = `peso vivo kg / 450`
- Capacidade total UA = `área ha * capacidade suporte UA/ha`
- Taxa de lotação UA/ha = `UA total / área total de pastagem`
- Saldo UA = `capacidade total UA - UA demandada`
- Estoque final = `estoque inicial + compras + nascimentos + transferências entrada - vendas - mortes - transferências saída`

## Problemas encontrados

- Cálculos repetidos estavam espalhados entre componentes, páginas e helpers, aumentando risco de divergência.
- Havia uso direto de números e datas sem validação suficiente em múltiplos fluxos.
- Parte da lógica usava arredondamento ou leitura de datas de forma que poderia distorcer resultados em casos limítrofes.
- Algumas telas poderiam quebrar ou calcular incorretamente quando recebiam:
  - valores nulos
  - strings numéricas com separadores brasileiros
  - datas inválidas
  - divisões por zero
  - listas vazias

## Correções aplicadas

- Criei `src/domain/calcHelpers.js` para centralizar:
  - conversão segura de números
  - divisão segura
  - normalização de datas
  - soma de dias em datas válidas
  - cálculo de dias estimados
  - cálculo de consumo diário
  - cálculo de custo estimado
- Removi dependência de fórmulas inline duplicadas nas áreas mais sensíveis:
  - Lotes
  - Animais
  - Pesagens
  - Acompanhamento de Peso
  - Suplementação / consumo_suplementacao
  - Estoque
  - Financeiro
  - Custos
  - Pastagens
  - Evolução do Rebanho
  - Indicadores
  - Dashboard
  - Relatórios Gerenciais
  - Cenários
- Ajustei a fórmula de dias estimados para respeitar a divisão exata da regra de negócio, sem introduzir arredondamento indevido.
- Padronizei o uso da média entre peso inicial e peso final para consumo por `%PV`.
- Tornei o tratamento de datas e números mais robusto em componentes e serviços que exibem métricas ao usuário.
- Mantive a interface em português e sem mudança de comportamento fora dos casos em que a fórmula estava inconsistente ou o valor era inválido.

## Testes adicionados/atualizados

- `tests/calcHelpers.test.js`
  - parse de números em formatos brasileiros e mistos
  - cálculo de dias estimados
  - soma de dias em datas válidas
  - consumo por `%PV` e por `kg/cab/dia`
  - custo estimado
  - UA por animal
  - capacidade total UA
  - diferença entre datas
- `tests/evolucaoRebanho.test.js`
  - atualização para usar entradas com strings numéricas
  - verificação de ignorar movimentos com data inválida sem quebrar o cálculo
  - validação da fórmula de estoque/rebanho

## Riscos restantes

- Ainda podem existir helpers locais menores fora do caminho principal revisado, mas os fluxos centrais de cálculo foram protegidos e os testes cobrem os casos mais críticos.
- Regras de limite ou interpretação de dados de origem externa podem exigir nova auditoria caso novos campos sejam adicionados no futuro.
- Mudanças posteriores em UI ou integrações precisam continuar usando os helpers centralizados para evitar regressões.

## Validação executada

- `npm run lint` ✅
- `npm run build` ✅
- `npm test -- --runInBand` ✅

## Status final

Auditoria concluída com correções aplicadas nos cálculos críticos e validação automatizada aprovada.
