# SPRINT 7 — Resultado: Correção de Bugs de Cálculo Agropecuário

**Data:** 2026-06-16  
**Status:** Concluída ✅

---

## Objetivo

Corrigir os bugs de cálculo identificados na Sprint 6 (F-03, F-04, F-07, F-08), criar testes automatizados, manter build e lint passando, e atualizar documentação. Sem novas telas.

---

## Bugs corrigidos

### F-03 — P1: GMD dinâmico (GMD usa campo `item.dias` fixo) ✅

**Problema:** `calcGmd` em `calcLote` usava `item.dias` fixo, congelando o GMD no momento de criação do registro.

**Solução:**
- Adicionado `calcularDiasNoLote(dataEntrada, dataReferencia?)` em `src/domain/calcHelpers.js`
- `calcLote` recebe parâmetro `referenceDate` (padrão: hoje) para testes determinísticos
- `calcGmd` usa `item.data_entrada || lote.entrada` + `calcularDiasNoLote()` como fonte primária de dias
- Variável `dias` (média ponderada do tempo no lote) também atualizada dinamicamente
- Fallback para `item.dias` quando nenhuma data disponível (sem quebrar dados legados)

**Arquivos:** `src/domain/calcHelpers.js`, `src/utils/calculations.js`

---

### F-04 — P2: `lucroPorArroba` usa @ carcaça (padrão do mercado) ✅

**Problema:** `calcularResultadoLote` calculava `lucroPorArroba` sobre arrobas vivas (`peso/15`), mas o mercado brasileiro cotiza por @ carcaça (`peso × rendimento / 15`). O erro subestimava `lucroPorArroba` em ~48% para rendimento 52%.

**Solução:**
- `calcularResultadoLote` agora busca `lote.rendimento_carcaca` de `db.lotes` (padrão 52% — zebuínos)
- Calcula `arrobasCarcaca = qtdCabecas × pesoMedioAtual × rendimento / 15`
- `lucroPorArroba = lucroTotal / arrobasCarcaca`
- Campo `arrobaViva` mantido no retorno (backward compatibility e exibição informativa)
- Campo `arrobasCarcaca` adicionado ao retorno

**Arquivo:** `src/domain/calculos.js`

**Pendência de UI:** Labels "Lucro/arroba" nas telas de resultado devem ser atualizados para "Lucro/@ carcaça" (fora do escopo de Sprint 7 — sem novas telas).

---

### F-07 — P2: Deduplicação de `arrobasProduzidas` ✅

**Problema:** Dois cálculos idênticos de arrobas produzidas existiam em paralelo (`calculos.js` e `calculations.js`), podendo divergir se um fosse alterado.

**Solução:** `calcLote` agora importa `calcularArrobasProduzidas` de `src/domain/indicadores.js` e aplica por grupo de animais (mantendo precisão para grupos com pesos iniciais diferentes).

**Arquivos:** `src/utils/calculations.js` (import de `indicadores.js`)

---

### F-08 — P2: Rateio de custos indiretos (funções puras criadas) ✅

**Problema:** Custos comuns (mão de obra, energia, arrendamento) não tinham mecanismo de rateio — o produtor precisava calcular e lançar manualmente em cada lote.

**Solução:** Criado `src/domain/rateio.js` com três estratégias puras:

| Função | Critério | Caso de uso |
|--------|----------|-------------|
| `ratearPorCabecas(custo, lotes)` | Proporcional ao nº de cabeças | Mão de obra direta |
| `ratearPorPeso(custo, lotes)` | Proporcional ao peso total | Ração base |
| `ratearIgualitario(custo, n)` | Partes iguais | Custo fixo de energia |

**Arquivo:** `src/domain/rateio.js` (novo)

**Pendência de integração:** Funções disponíveis mas sem UI de aplicação. Integração futura requer tela de custo compartilhado + seleção de critério + criação automática de movimentações.

---

## Testes criados

| Arquivo | Testes | Cobertura |
|---------|--------|-----------|
| `src/domain/calcHelpers.test.js` | 6 | `calcularDiasNoLote` — datas válidas, inválidas, iguais, invertidas, fallback hoje |
| `src/utils/calculations.test.js` | 8 | GMD dinâmico (F-03), arrobasProduzidas (F-07) |
| `src/domain/calculos.test.js` | +5 | F-04: rendimento 52%, 50%, missing, comparativo, arrobaViva backward compat |
| `src/domain/rateio.test.js` | 11 | Rateio por cabeças, por peso, igualitário — incluindo edge cases (zero) |

**Total geral do projeto: 43 testes, 43 passando ✅**

---

## Verificação final

```
node --test src/**/*.test.js
→ tests 43 | pass 43 | fail 0

npm run build
→ ✓ built in 328ms (196 modules)
```

---

## Documentação atualizada

| Documento | Alteração |
|-----------|-----------|
| `docs/FUROS_CALCULO_HERDON.md` | F-03, F-04, F-07 marcados como corrigidos; F-08 com funções criadas |
| `docs/SPRINT_7_RESULTADO.md` | Este arquivo |

---

## Critérios de aceite

| Critério | Status |
|----------|--------|
| GMD calcula dias dinamicamente a partir de datas reais | ✅ |
| Fallback para `item.dias` quando sem datas (sem regressão) | ✅ |
| `lucroPorArroba` usa @ carcaça com rendimento configurável | ✅ |
| `arrobaViva` mantido no retorno (backward compat) | ✅ |
| `arrobasProduzidas` usa função canônica de `indicadores.js` | ✅ |
| Funções de rateio puras criadas com 3 estratégias | ✅ |
| Nenhuma tela nova criada | ✅ |
| Todos os 43 testes passando | ✅ |
| Build passando sem warnings | ✅ |
| Docs atualizados | ✅ |
