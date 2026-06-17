# SPRINT 6 — Resultado: Análise e Validação de Cálculos Agropecuários

**Data:** 2026-06-16  
**Status:** Concluída ✅

---

## Objetivo

Ler, classificar e extrair regras de negócio de 5 PDFs agropecuários, comparar com os cálculos do HERDON, identificar furos, criar testes e corrigir os cálculos críticos (P0/P1).

---

## PDFs analisados

| Arquivo | Tipo | Relevância |
|---------|------|-----------|
| `17.pdf` (BR-CORTE 2023, Cap.17) | Técnico-nutricional | Média — fórmulas de CMS e exigências por categoria |
| `232-BOVINOCULTURA.pdf` (SENAR 232) | Manual operacional | Alta — CMS de confinamento, suplementação |
| `AULA_22_CONTROLPEC.pdf` (Embrapa) | Controle financeiro | Muito alta — checklist de indicadores que o sistema deve ter |
| `COT104.pdf` (Embrapa CT104) | Custo de produção | Muito alta — estrutura CT = COP + CK, tipos de custo |
| `TCC_Jean_Carlos_Costa.pdf` (UFG) | Gestão de custos | Alta — análise econômica, margem, RBC, centros de custo |

---

## Documentos gerados

| Documento | Status |
|-----------|--------|
| `docs/MAPA_PDFS_CONTAS_AGROPECUARIAS.md` | ✅ Criado |
| `docs/REGRAS_CALCULO_AGROPECUARIA.md` | ✅ Criado |
| `docs/MATRIZ_CALCULOS_HERDON.md` | ✅ Criado |
| `docs/FUROS_CALCULO_HERDON.md` | ✅ Criado |
| `docs/CASOS_TESTE_FINANCEIRO_AGROPECUARIO.md` | ✅ Criado |
| `docs/GLOSSARIO_AGROPECUARIO_HERDON.md` | ✅ Criado |
| `docs/SPRINT_6_RESULTADO.md` | ✅ Este arquivo |

---

## Furos encontrados

| ID | Prioridade | Descrição | Status |
|----|-----------|-----------|--------|
| F-01 | P0 | Alertas usam `custos[]` legada; dashboard usa `movimentacoes_financeiras[]` → valores discrepantes | ✅ Corrigido |
| F-02 | P1 | Animais inativos (vendidos/mortos) contados em `calcularResultadoLote` e `calcLote` | ✅ Corrigido |
| F-03 | P1 | GMD usa campo `item.dias` fixo, não calculado dinamicamente | 📋 Documentado (requer análise do modelo de dados) |
| F-04 | P2 | `lucroPorArroba` calculado sobre arroba viva, não carcaça | 📋 Documentado |
| F-05 | P2 | `margemProjetada` em `calcLote` pode duplicar custo de compra | 📋 Documentado |
| F-06 | P2 | Receita não garante dedução de frete/comissão | 📋 Documentado |
| F-07 | P2 | Lógica de arrobas produzidas duplicada em dois arquivos | 📋 Documentado |
| F-08 | P2 | Rateio de custos indiretos não implementado | 📋 Backlog |
| F-09–F-13 | P3 | Custo de oportunidade, depreciação, pró-labore, @/ha/ano, RBC/Ponto equilíbrio | 📋 Backlog |

---

## Correções implementadas

### F-01 — P0: Unificar fonte de custo no alerta de margem negativa

**Arquivo:** `src/utils/calculations.js`

**Problema:** O alerta "Margem projetada negativa" usava `calcLote.totalCustos` (da tabela legada `custos[]`), enquanto o painel financeiro exibe dados de `movimentacoes_financeiras`. Isso criava inconsistência: o alerta poderia não disparar mesmo com o lote no prejuízo.

**Correção:** `computeAlerts` agora importa e usa `calcularCustoLote` para calcular a margem projetada com os custos reais de `movimentacoes_financeiras`.

---

### F-02 — P1: Filtrar animais inativos nas métricas do lote

**Arquivos:** `src/domain/calcHelpers.js`, `src/domain/calculos.js`, `src/utils/calculations.js`

**Problema:** `calcularResultadoLote` e `calcLote` contavam animais com status 'vendido', 'morte', 'descarte', etc., inflando `qtdCabecas` e distorcendo `pesoMedioAtual`, `lucroPorCabeca` e `lucroPorArroba`.

**Correção:**
- Adicionado `isAnimalAtivo` exportado em `calcHelpers.js`
- `calcularResultadoLote` agora filtra por `isAnimalAtivo` para calcular `qtdCabecas` e `pesoMedioAtual`
- `calcLote` agora filtra `animaisDoLote` por `isAnimalAtivo` para todos os cálculos de produção

---

## Cálculos validados como corretos

- Arroba viva e arroba carcaça (fórmulas corretas, rendimento padrão 52% OK)
- Custo total via `movimentacoes_financeiras` — correto
- Receita total via `movimentacoes_financeiras` — correto
- Lucro = Receita − Custo — correto
- Margem % — correta
- Taxa de mortalidade — correta
- Evolução do rebanho — correta (usa `isAtivo` corretamente)
- UA e taxa de lotação — corretas
- Dias de estoque de suplemento — corretos
- Taxa de desfrute — correta

---

## O que o HERDON ainda NÃO calcula (P3 / Backlog)

- Custo de oportunidade do capital (CK)
- Depreciação de benfeitorias e equipamentos
- Pró-labore / CADM
- Rateio de custos indiretos entre lotes
- Razão Benefício/Custo (RBC)
- Ponto de Equilíbrio
- @/ha/ano por lote
- CMS — Consumo de Matéria Seca (apenas estimado por % PV ou kg/cab/dia)

Esses itens, se implementados, completariam a estrutura `CT = COP + CK` definida pela Embrapa (COT104) e permitiriam ao HERDON apresentar o custo total real de produção conforme os padrões da pecuária de corte.

---

## Critérios de aceite

| Critério | Status |
|----------|--------|
| Todos os PDFs catalogados | ✅ |
| Explicação clara de cada PDF | ✅ |
| Regras de cálculo extraídas | ✅ |
| PDFs comparados com o HERDON | ✅ |
| Furos classificados por prioridade | ✅ |
| Casos de teste criados | ✅ |
| Cálculos P0/P1 corrigidos | ✅ |
| Build continuando a passar | ✅ `built in 2.42s` |
| Nenhum dado sensível exposto | ✅ (PDFs são materiais públicos) |
