# Suplementação ligada ao Resultado — HERDON (Sprint 33)

> **Corrigido na Sprint 36 — persistência real implementada.** A Sprint 35
> encontrou o bug crítico: `src/pages/SuplementacaoPage.jsx` nunca chamava
> `createOperationalRecord`/`updateOperationalRecord` — todo o estado era
> mantido só em memória via `setDb(...)`, então qualquer produto/consumo
> "salvo" se perdia ao recarregar a página. A causa raiz tinha duas
> partes: (1) a página nunca recebia/usava `session` nem `fazendaSelecionada`,
> que o `App.jsx` já passa para todas as páginas; (2) mesmo se chamasse a
> persistência, os builders de payload em `operationalPersistence.js`
> estavam incompletos (`estoque`) ou inexistentes (`consumo_suplementacao`)
> e quebrariam o insert real. As duas causas foram corrigidas nesta
> sprint. Ver [SPRINT_36_RESULTADO.md](SPRINT_36_RESULTADO.md) e
> [SUPLEMENTACAO_TESTE_MANUAL.md](SUPLEMENTACAO_TESTE_MANUAL.md) para o
> teste real feito contra o Supabase de produção.
>
> **O que passou a persistir de verdade:**
> - **Produto nutricional** (`ProdutoNutricionalModal`) → tabela `estoque`,
>   via `createOperationalRecord`/`updateOperationalRecord('estoque', ...)`.
> - **Consumo de suplementação** (`SuplementacaoConsumoModal.jsx`) → tabela
>   `consumo_suplementacao`, mais a baixa de estoque (`estoque.quantidade_atual`)
>   e a despesa automática (`movimentacoes_financeiras`), todas via
>   `createOperationalRecord`/`updateOperationalRecord`.
>
> **O que segue como pendência (não persiste):** **Dietas**
> (`DietaModal`) continuam só em `setDb` — não existe tabela `dietas` no
> Supabase real, e criar uma exigiria modelagem e migration, fora do
> escopo desta sprint (que tratou só de persistência, não de features
> novas). A UI agora avisa isso claramente: o modal de Dieta mostra "Dietas
> ficam salvas apenas neste dispositivo por enquanto — não sincronizam com
> a nuvem nem aparecem em outro aparelho", e o modal de Consumo mostra
> "Dietas ainda são um recurso em preparação. Para o piloto, registre o
> consumo diretamente pelo produto nutricional." quando "Dieta" é
> selecionado como origem do consumo.

Leitura simples de custo de suplementação por lote, comparado ao custo por
arroba do lote (Sprint 32) e ao GMD realizado x meta. Não promete
causalidade absoluta — usa termos como "indício", "sinal", "acompanhar",
"comparar", "avaliar". Ver também
[MANEJO_RESULTADO_HERDON.md](MANEJO_RESULTADO_HERDON.md).

## Estrutura existente reaproveitada

Já existiam, antes desta sprint, **duas camadas** de suplementação:

1. **Configuração/meta no lote** (`lotes.supl_nome`, `supl_rkg`,
   `supl_pv_pct`, `supl_meta_dias`, `supl_estoque_kg`) — usada para
   alertas de estoque e projeções (`calcLote`, `src/utils/calculations.js`).
   Sprint 33 **não usa** esses campos — eles são planejamento, não
   consumo real.
2. **Consumo real** (`db.consumo_suplementacao`) — cada registro tem
   `lote_id`, `custo_total`, `quantidade_total`/`quantidade`, `data`, e
   gera automaticamente uma despesa em `movimentacoes_financeiras`
   (`categoria: 'nutricao'`, `subcategoria: 'alimentacao'`) já incluída no
   custo total do lote desde antes desta sprint (`calcularCustoLote`,
   `src/domain/calculos.js`, cai no bucket `custoOutros`).

Sprint 33 lê **somente** a camada 2 (consumo real) para isolar "quanto do
custo do lote foi suplementação" — sem recalcular o custo total do lote,
que já vem de `calcularResultadoLote`/`getResumoLote` (Sprint 32).

## Funções

Em [`src/domain/manejoResultado.js`](../src/domain/manejoResultado.js):

| Função | O que faz |
|---|---|
| `calcularCustoSuplementacaoPorCabeca({ custoSuplementoTotal, qtdCabecas })` | Custo de suplemento ÷ cabeças |
| `calcularCustoSuplementacaoPorArroba({ custoSuplementoTotal, arrobas })` | Custo de suplemento ÷ arrobas de carcaça (mesma base de arrobas da Sprint 32) |
| `analisarSuplementacaoLote({ registros, qtdCabecas, arrobas, dias })` | Soma custo/quantidade dos registros do lote e calcula as duas métricas acima |
| `classificarEficienciaSuplementacao(dados)` | Classificação em 5 categorias (abaixo) |
| `relacionarSuplementoEGmd({ custoSuplementoTotal, gmdAtual, gmdMeta, dias })` | Sinal simples (não causal) entre custo e GMD |

## Classificação (5 categorias)

| Status | Quando aparece | Mensagem |
|---|---|---|
| Sem registro de suplemento | Nenhum `consumo_suplementacao` no período | "Não há registro de suplementação para este lote no período." |
| Sem dados suficientes | Há consumo, mas menos de 30 dias no lote ou sem arrobas calculáveis | "Ainda faltam pesagens suficientes para avaliar o efeito da suplementação." |
| Custo de suplemento elevado | Custo de suplemento por arroba ≥ 40% do custo por arroba **total** do lote | "O custo de suplemento está pesando no custo por arroba deste lote." |
| Suplementação com desempenho positivo | Há meta de GMD configurada e o GMD realizado está na meta ou acima, sem custo alto | "O lote possui custo de suplementação registrado e o GMD está dentro ou acima da meta — indício de que o suplemento está acompanhando o desempenho." |
| Acompanhar GMD | Há custo registrado, dados suficientes, sem custo alto, mas sem confirmar GMD acima da meta | "O lote possui custo de suplementação registrado. Acompanhe se o GMD está compensando esse custo." |

Ordem de prioridade na avaliação: sem registro → dados insuficientes →
custo alto → desempenho positivo → acompanhar GMD (fallback).

## Relação com GMD (`relacionarSuplementoEGmd`)

Sinal independente da classificação de eficiência, pensado para uma frase
curta de insight:

| Sinal | Mensagem |
|---|---|
| `sem_dados` | "Ainda faltam dados de pesagem para relacionar suplementação e ganho de peso." |
| `indicio_positivo` | "Acompanhe se o ganho de peso permanece acima da meta." |
| `indicio_atencao` | "O ganho de peso está abaixo da meta apesar do custo de suplementação — compare e avalie o que pode estar pesando no desempenho." |

## Onde aparece

- Card "Manejo, sanidade e suplementação" no Relatório do Lote — custo
  total, custo/cabeça, custo/@, insight.
- Linha no resumo WhatsApp do lote (`Suplemento: R$ X/cab`).
- Prioridade combinada em Hoje na Fazenda quando o status é "Custo de
  suplemento elevado".
- Sinal complementar na Decisão de Venda (Sprint 32), sem mudar a
  classificação de venda.

## Limitações e pendências

- O limiar de 40% para "custo alto" é uma heurística de primeira versão,
  não configurável.
- Não relaciona consumo por dia/cocho, curva de engorda, comparação entre
  dietas, nem estoque vinculado ao manejo — fora de escopo.
- Modo Curral não ganhou atalho dedicado de "Registrar suplementação" —
  ver justificativa em [MODO_CURRAL_HERDON.md](MODO_CURRAL_HERDON.md).
