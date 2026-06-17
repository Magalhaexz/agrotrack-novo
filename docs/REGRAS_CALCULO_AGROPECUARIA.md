# Regras de Cálculo Agropecuário — Referência para o HERDON

> Extraído dos PDFs de referência analisados na Sprint 6. Fontes: BR-CORTE 2023, SENAR 232, Embrapa CONTROLPEC, Embrapa COT104, TCC UFG 2014.

---

## 1. Animais e peso

### 1.1 Quantidade de animais

```
Estoque Inicial = qtd de animais no início do período
Entradas = compras + nascimentos + transferências de entrada
Saídas = vendas + mortes + descartes + transferências de saída
Estoque Final = Estoque Inicial + Entradas − Saídas
Variação Inventário = Estoque Final − Estoque Inicial
```

**Regra crítica:** O estoque deve ser contado apenas por animais **ativos** (não vendidos, não mortos, não descartados). Animais com status de saída não devem entrar no numerador de indicadores como peso médio ou GMD do lote ativo.

### 1.2 Ganho de Peso

```
Ganho de Peso Individual (kg) = Peso Final − Peso Inicial
Ganho de Peso do Lote (kg) = Σ (Peso Final_i − Peso Inicial_i) × Qtd_i
```

### 1.3 Peso Médio

```
Peso Médio (kg) = Σ (Peso_i × Qtd_i) / Σ Qtd_i
```

**Regra crítica:** Usar apenas animais ativos no cálculo de peso médio atual.

### 1.4 GMD — Ganho Médio Diário

```
GMD (g/dia) = [(Peso Final − Peso Inicial) / Dias de Trato] × 1000
GMD (kg/dia) = (Peso Final − Peso Inicial) / Dias de Trato
```

**Fontes:** BR-CORTE 2023, SENAR 232, CONTROLPEC.

**Referências de desempenho (SENAR 232):**
- Seca (pasto): 300 g/dia
- Águas (pasto): 700 g/dia
- Confinamento cruzados Angus×Nelore: 1.400 g/dia (meta)
- Zebuínos em confinamento: tipicamente menor

**Regra crítica:** O período de dias deve ser calculado dinamicamente pela diferença entre a data de pesagem (ou data atual) e a data de entrada do animal no lote. Não usar um campo `dias` fixo que não seja atualizado.

### 1.5 Taxa de Mortalidade

```
Taxa de Mortalidade (%) = (Qtd Mortes / Qtd Entrada) × 100
```

---

## 2. Arroba

### 2.1 Conversão peso → arroba

```
1 arroba = 15 kg de peso vivo
Arroba Viva = Peso Vivo (kg) / 15
```

### 2.2 Rendimento de carcaça

```
Peso Carcaça (kg) = Peso Vivo (kg) × (Rendimento% / 100)
Rendimento padrão Brasil: 52% (zebuínos); 54–56% (cruzados europeus)
```

### 2.3 Arroba de carcaça

```
Arroba Carcaça = Peso Carcaça (kg) / 15
              = [Peso Vivo × (Rendimento% / 100)] / 15
```

**Regra crítica:** O mercado de carne bovina brasileira precifica pela **arroba de carcaça**, não pela arroba viva. Custo/arroba, receita/arroba e lucro/arroba devem ser calculados sobre **arroba carcaça**.

### 2.4 Arrobas produzidas (ganho no ciclo)

```
Arrobas Produzidas = Σ (Peso Final_i − Peso Inicial_i) × Qtd_i / 15
```

Representa o ganho de peso do lote convertido em arrobas. Mede eficiência de produção.

### 2.5 Receita por arroba

```
Receita por Arroba = Receita Total de Venda / Arrobas Carcaça Vendidas
```

Ou, na estimativa/projeção:

```
Receita Projetada = Arrobas Carcaça Totais × Preço/Arroba
```

---

## 3. Custos

### 3.1 Estrutura hierárquica de custos (COT104/Embrapa)

```
CT = COP + CK

COP = DES + DEP + CADM

onde:
  CT   = Custo Total
  COP  = Custo Operacional
  CK   = Custo de Oportunidade do Capital (juros sobre capital investido)
  DES  = Desembolsos (saídas de caixa efetivas)
  DEP  = Depreciações (desgaste de bens de capital: instalações, equipamentos)
  CADM = Custo de Administração / Pró-labore (remuneração do produtor-gestor)
```

### 3.2 Custo de compra dos animais

```
Custo de Compra = Qtd Animais × Preço Médio de Compra (R$/cab ou R$/@)
```

É o maior custo de um ciclo. Deve entrar no custo total do lote.

### 3.3 Custo de alimentação / suplementação

```
Consumo Diário (kg) = Qtd Animais × Consumo/Cabeça/Dia
Custo Diário (R$) = Consumo Diário × Preço do Insumo (R$/kg)
Custo Total Alimentação (R$) = Custo Diário × Dias do Ciclo
```

**Fórmula do CMS para cruzados (SENAR 232 / BR-CORTE 2016):**

```
CMS (kg/dia) = −0,6273 + 0,06453 × PC^0,75 + 3,871 × GMD − 0,614 × GMD²
```

Onde PC = Peso Corporal (kg), GMD = Ganho Médio Diário (kg/dia).

**Formas de calcular consumo (dois modos):**
- Modo `% do Peso Vivo`: Consumo/cab/dia = Peso Médio × (% / 100)
- Modo `kg/cab/dia`: Consumo/cab/dia = valor fixo em kg

### 3.4 Custo de sanidade

Inclui: vacinas, vermífugos, carrapaticidas, medicamentos gerais, materiais de aplicação, honorários veterinários.

```
Custo Sanidade = Σ (Qtd produto × Preço unitário × Nº aplicações)
```

### 3.5 Custo de mão de obra

```
Custo MO = Salários + Encargos sociais + Diárias eventuais
```

### 3.6 Frete

```
Custo Frete = Distância × Tarifa, ou valor fixo por lote/cabeça
```

### 3.7 Comissão

```
Comissão = Receita Venda × Taxa% / 100
```

Normalmente deduzida da receita ou lançada como custo.

### 3.8 Depreciação (COT104)

```
Depreciação Anual = (Valor do Bem − Valor Residual) / Vida Útil (anos)
Depreciação por Ciclo = Depreciação Anual × (Dias do Ciclo / 365)
```

Aplica-se a: instalações (currais, silos, cochos), equipamentos, veículos, reprodutores.

### 3.9 Custo de oportunidade do capital (COT104)

```
CK = Capital Investido × Taxa de Oportunidade (% a.a.) × (Dias do Ciclo / 365)
```

Taxa de oportunidade: poupança, CDI, rendimento alternativo. Representa o quanto o capital investido renderia em outra aplicação.

### 3.10 Custo por arroba produzida

```
Custo/@ = Custo Total (R$) / Arrobas Produzidas (@)
```

**Regra crítica:** este é o principal indicador de eficiência de custo na bovinocultura de corte. Se Custo/@ > Preço/@ de mercado, a atividade está operando no prejuízo.

### 3.11 Custo por cabeça

```
Custo/Cabeça = Custo Total / Qtd Cabeças
```

### 3.12 Custo por cabeça por dia

```
Custo/Cabeça/Dia = Custo Total / (Qtd Cabeças × Dias do Ciclo)
```

### 3.13 Rateio de custos (TCC UFG)

```
Custo Rateado para Lote X = Custo Comum × (Participação do Lote X / Participação Total)
```

A participação pode ser medida por: número de cabeças, UA (Unidade Animal), área ocupada, dias de ciclo.

---

## 4. Receita

### 4.1 Receita bruta de vendas

```
Receita Bruta = Qtd Arrobas Carcaça Vendidas × Preço/@ Carcaça
             = Qtd Cabeças × Peso Médio × Rendimento% × Preço/@ / 15
```

Ou:

```
Receita Bruta = Qtd Cabeças × Preço Médio por Cabeça (R$/cab)
```

Dependendo do modelo de venda.

### 4.2 Receita líquida

```
Receita Líquida = Receita Bruta − Frete − Comissão − Impostos − Outros descontos
```

### 4.3 Outras receitas

- Venda de couro, subprodutos de abate
- Venda de esterco/adubo
- Arrendamento de área
- Receita de leite (em sistemas mistos)

---

## 5. Resultado Financeiro

### 5.1 Margem bruta (TCC UFG)

```
Margem Bruta = Receita Total − Custos Variáveis
```

### 5.2 Lucro / Prejuízo

```
Lucro/Prejuízo = Receita Total − Custo Total (CT)
```

Quando inclui custo de oportunidade, é chamado de **lucro econômico** (mais rigoroso).

### 5.3 Margem percentual

```
Margem (%) = (Lucro / Receita Total) × 100
```

### 5.4 Lucro por cabeça

```
Lucro/Cabeça = Lucro Total / Qtd Cabeças
```

### 5.5 Lucro por arroba

```
Lucro/@ = Lucro Total / Arrobas Carcaça Totais
```

**Regra crítica:** deve ser calculado sobre arrobas de carcaça.

### 5.6 Razão Benefício/Custo (TCC UFG)

```
RBC = Receita Total / Custo Total
```

- RBC > 1: atividade lucrativa
- RBC = 1: ponto de equilíbrio
- RBC < 1: prejuízo

### 5.7 Ponto de Nivelamento / Equilíbrio (breakeven)

```
Ponto de Equilíbrio (@ produzida) = Custo Total / Preço por @
Ponto de Equilíbrio (R$) = Custo Total (quando Receita = Custo)
```

---

## 6. Evolução do Rebanho

```
Estoque Final = Estoque Inicial + Compras + Nascimentos + Transf. Entrada
              − Vendas − Mortes − Descartes − Transf. Saída

Taxa de Desfrute (%) = [(Vendas − Compras + Variação) / Estoque Inicial] × 100

Taxa de Crescimento (%) = [(Estoque Final − Estoque Inicial) / Estoque Inicial] × 100
```

---

## 7. Indicadores de Pastagem / Lotação

```
Taxa de Lotação (UA/ha) = UA Total / Área de Pastagem (ha)
UA (Unidade Animal) = Peso Vivo (kg) / 450  [padrão Brasil]
Capacidade de Suporte = Área (ha) × Taxa de Suporte (UA/ha)
Saldo de UA = Capacidade de Suporte − UA Total atual
```

---

## 8. Estoque de Insumos

```
Saldo Estoque = Estoque Anterior + Entradas − Saídas (consumo lançado no lote)
Consumo Projetado/Dia = Qtd Cabeças × Consumo/Cab/Dia
Dias de Estoque = Saldo Estoque / Consumo Projetado/Dia
Custo Médio Ponderado = Σ (Qtd_i × Custo_i) / Σ Qtd_i
```

O custo de estoque consumido deve ser vinculado ao lote que consumiu o insumo.

---

## 9. Arroba/Hectare/Ano (@/ha/ano)

```
@/ha/ano = Arrobas Produzidas no Período / Área (ha) / (Dias do Período / 365)
```

É o indicador de produtividade de terra da pecuária. Benchmark: 6–10 @/ha/ano em pasto melhorado; 20–30+ em confinamento.

---

## 10. Taxa de Desmama

```
Taxa de Desmama (%) = (Bezerros Desmamados / Vacas em Reprodução) × 100
```

Referência: 75–85% em boas condições de manejo no Brasil (SENAR 232).
