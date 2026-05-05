# SPRINT13A — Lotes GMD, Dieta e Consumo

## Campos usados no cadastro de lote
- Peso médio inicial
- Peso alvo final
- GMD esperado
- Data de entrada
- Dieta escolhida
- Produto/suplemento vinculado ao estoque (quando existir)
- Percentual de consumo (% do peso vivo)
- Quantidade inicial (cabeças)

## Fórmula de dias estimados (GMD)
- `dias estimados = (peso alvo final - peso médio inicial) / GMD esperado`
- O cálculo é exibido apenas quando os dados são válidos (GMD > 0 e peso alvo > peso inicial).

## Cálculo de data prevista de saída
- `data prevista de saída = data inicial + dias estimados`
- Quando calculável, a data é projetada automaticamente.

## Fórmulas de consumo de suplemento
- `peso médio do período = (peso inicial + peso alvo) / 2`
- `consumo diário por animal = peso médio do período * percentual em decimal`
  - Ex.: 0,2% = 0,002
- `consumo por animal no período = consumo diário por animal * dias estimados`
- `consumo total estimado do lote = consumo por animal no período * cabeças`

## Vínculo dieta/produto/estoque
- Campo direto no cadastro: “Qual dieta este lote receberá?”
- Se houver itens em estoque, permite selecionar produto/suplemento existente.
- Se não houver vínculo, a UI mostra “Produto não vinculado ao estoque” (fallback seguro sem alterar schema).

## Tratamento seguro de dados ausentes/inválidos
- GMD ausente ou <= 0: “Informe um GMD esperado válido.”
- Peso alvo <= peso inicial: “O peso alvo deve ser maior que o peso inicial.”
- Percentual ausente/inválido: “Informe o percentual de consumo do produto.”
- Sem dados válidos, não exibe valores inventados; apresenta estado neutro/instrutivo.

## O que intencionalmente não foi alterado
- Sem mudanças em schema Supabase, RLS, auth, sync core ou cálculo financeiro de negócio.
- Sem alteração da fonte de verdade do diagnóstico manual serverless.

## Testes
- `rg -n "^(<<<<<<<|=======|>>>>>>>)" -S .` → sem conflitos.
- `npm run build` → sucesso.
- `npm run lint` → sucesso com warnings preexistentes (sem erros).


## Correção aplicada (hotfix)
- Data prevista de saída é calculada automaticamente com base em data de entrada + dias estimados.
- O produtor não informa manualmente data de saída neste fluxo de cadastro.
- O campo `saida` não é gravado como saída real no momento do cadastro; a projeção permanece no nível de planejamento/UI.
- Custos de consumo só são calculados quando existe preço por kg utilizável (direto ou derivado por embalagem/peso).
- Quando não há base de custo por kg: "Custo estimado indisponível: informe o custo do produto no estoque."
