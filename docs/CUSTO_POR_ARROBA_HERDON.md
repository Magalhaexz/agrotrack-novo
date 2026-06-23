# Custo por Arroba — HERDON (Sprint 32)

Detalhamento da fórmula central usada pela [Decisão de Venda](DECISAO_VENDA_HERDON.md).

## Fórmula

```
arrobas de carcaça = (cabeças × peso vivo atual × rendimento de carcaça) / 15
custo por arroba    = custo total do lote / arrobas de carcaça
lucro por arroba    = lucro total do lote / arrobas de carcaça
ponto de equilíbrio = custo total do lote / arrobas de carcaça  (= custo por arroba)
```

- **Rendimento de carcaça**: `lote.rendimento_carcaca`, padrão **52%**
  (referência zebuínos/Nelore, decisão já tomada em sprint anterior —
  ver `calcularResultadoLote` em `src/domain/calculos.js`).
- **15**: kg por arroba (padrão do mercado brasileiro).
- **Custo total do lote**: soma de despesas em `movimentacoes_financeiras`
  vinculadas ao lote (`lote_id`) com status que conta para resultado
  (exclui `previsto` e `cancelado` — ver `financeiroStatus.js`), mais
  custos legados não duplicados em `db.custos`.
- Estas três fórmulas **já existiam** em `src/domain/calculos.js` e
  `src/domain/resumoLote.js` antes desta sprint — `decisaoVenda.js` só as
  reaproveita (`montarDadosDecisaoVenda`), sem recalcular.

## Por que "ponto de equilíbrio" é função separada de "custo por arroba"

Matematicamente, para um lote já custeado até hoje, são o mesmo número.
Mantidos como funções distintas (`calcularCustoPorArroba` e
`calcularPontoEquilibrioArroba`) porque o significado para o produtor é
diferente: uma responde "quanto já gastei por arroba produzida" (olhando
para trás), a outra "abaixo de qual preço eu perco dinheiro se vender"
(olhando para a decisão). Isso evita confusão se um dia as fórmulas
precisarem divergir (ex.: ponto de equilíbrio considerando custo
projetado até a venda, não só o já incorrido).

## O que conta como "custo do lote"

Mesma regra de `calcularCustoLote` (calculos.js), nada novo nesta sprint:
despesas com `tipo === 'despesa'`, `lote_id` do lote, status diferente de
`previsto`/`cancelado`. Categorias: `compra_animal`, `compra_estoque`,
outros. Custos legados em `db.custos` somados sem duplicar os que já têm
uma despesa correspondente (`origem === 'custo'`).

**Não incluído no custo do lote:** rateio de custos compartilhados
(`CustosCompartilhadosPage.jsx`) — esses custos são tratados na visão
consolidada da fazenda, não atribuídos automaticamente a um lote
específico. Se o produtor não lançar manualmente uma despesa vinculada ao
lote, ela não entra no custo/@ daquele lote. Documentado como limitação,
não alterado nesta sprint (mexer nisso significaria mudar regra de
rateio, fora do escopo aprovado).

## Preço-alvo da arroba

`lote.preco_arroba`, ou **R$270** se o lote não tiver esse campo
preenchido (mesmo padrão já usado em `calcLote` desde antes desta sprint).
Usado para: receita projetada nas simulações, e como referência para o
limiar de "custo alto" (custo/@ ≥ 85% do preço-alvo).

## Quando o cálculo não é confiável

- **Arrobas = 0** (sem peso atual ou sem cabeças): custo/@ e lucro/@ não
  são calculados — `classificarDecisaoVenda` retorna "Dados
  insuficientes" em vez de mostrar `R$ 0,00` (que pareceria "de graça").
- **Custo total = 0** (nenhuma despesa lançada para o lote): mesma
  situação — sem despesas registradas, custo/@ = R$0,00 seria enganoso,
  não uma informação real. Tratado como dados insuficientes também.
- **Sem rendimento de carcaça configurado**: usa 52% padrão — pode
  divergir do rendimento real do lote (varia por raça, sexo, acabamento).

## Pendências futuras

Ver [DECISAO_VENDA_HERDON.md](DECISAO_VENDA_HERDON.md#pendências-futuras).
