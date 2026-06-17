# Glossário Agropecuário — HERDON

> Definições padrão usadas no app HERDON. Este glossário é a fonte de verdade para garantir que telas, cálculos e relatórios usem os mesmos conceitos.

---

## Animais e rebanho

**Lote**  
Grupo de animais de mesma categoria, criados juntos no mesmo sistema de produção, com uma data de entrada definida. Um lote pode ser de terminação em confinamento, recria a pasto ou cria. No HERDON, o lote é a unidade principal de gestão.

**Animal (registro)**  
No HERDON, um registro de animal representa um grupo de cabeças com características semelhantes (sexo, peso, raça). Possui os campos: `qtd` (quantidade de cabeças), `p_ini` (peso inicial), `p_at` (peso atual), `sexo`, `lote_id`, `status`.

**Cabeça (cab)**  
Unidade de contagem de bovinos. "100 cabeças" = 100 animais individuais.

**Animal ativo**  
Animal cujo status não é vendido, morto, descartado, transferido ou inativo. Apenas animais ativos entram no cálculo de peso médio atual, arrobas do lote e GMD do ciclo em andamento.

**Status do animal**  
Define a situação atual do animal: `ativo`, `vendido`, `morte`, `descarte`, `transferencia`, `perda`, `inativo`.

---

## Peso

**Peso Vivo (PV)**  
Peso total do animal em quilogramas, aferido em balança. É o peso utilizado para calcular arroba viva e Unidade Animal (UA).

**Peso Médio (kg)**  
Média ponderada dos pesos dos animais do lote: `Σ(Peso_i × Qtd_i) / Σ Qtd_i`. Calculado apenas sobre animais ativos.

**Peso Inicial (p_ini)**  
Peso do animal na entrada do lote.

**Peso Atual (p_at)**  
Peso do animal no momento da última pesagem. Deve ser atualizado a cada pesagem registrada.

**Ganho de Peso**  
Diferença entre peso final e peso inicial de um animal ou grupo: `Ganho = PF − PI`. Em kg.

---

## Ganho Médio Diário (GMD)

**GMD**  
Ganho Médio Diário. Medida da taxa de crescimento do animal.

Fórmula:
```
GMD (kg/dia) = (Peso Final − Peso Inicial) / Dias de Trato
GMD (g/dia) = GMD (kg/dia) × 1000
```

Referências de desempenho:
- Pasto / seca: 300 g/dia
- Pasto / águas: 700 g/dia  
- Confinamento cruzados: 1.200–1.400 g/dia
- Confinamento zebuínos: 1.000–1.200 g/dia

O período de dias deve ser calculado dinamicamente: `daysBetween(data_entrada_lote, data_pesagem_atual)`.

**GMD Meta**  
Valor de referência configurado no lote, usado para alertas quando o GMD real fica abaixo.

---

## Arroba

**Arroba (@ ou @)**  
Unidade de comercialização de gado bovino no Brasil. 1 arroba = 15 kg.

**Arroba Viva (@viva)**  
Baseada no peso vivo do animal: `@viva = Peso Vivo (kg) / 15`. Usada para compra de bezerros e animais magros.

**Arroba Carcaça (@carcaça)**  
Baseada no peso da carcaça do animal após o abate: `@carcaça = Peso Carcaça / 15`. É a unidade usada para precificação de boi gordo em frigoríficos. É **sempre menor** que a arroba viva.

**Rendimento de Carcaça (%)**  
Proporção do peso vivo que se transforma em carcaça após o abate. Fórmula: `Peso Carcaça = Peso Vivo × Rendimento%`.

Referências:
- Zebuínos puros (Nelore): 52–54%
- Cruzados Nelore × Angus: 54–56%
- Cruzados europeus: 56–58%

Padrão do sistema: 52% quando não informado.

**Arrobas Produzidas (@ produzidas)**  
Quantidade de arrobas geradas pelo ganho de peso do lote no ciclo: `@ produzidas = Ganho Total (kg) / 15`. Mede eficiência de produção — diferente das arrobas vendidas (que baseiam-se no peso de saída total).

**Arrobas Vendidas (@ vendidas)**  
Quantidade de arrobas carcaça efetivamente comercializadas: `@ vendidas = Peso Carcaça Total / 15 = (Peso Vivo Saída × Rendimento%) / 15`.

---

## Custo

**Custo Direto**  
Custo que pode ser atribuído diretamente a um lote sem rateio: compra dos animais, alimentação, sanidade, frete de entrada.

**Custo Indireto**  
Custo compartilhado entre vários lotes: mão de obra, energia, manutenção de instalações, arrendamento. Precisa de rateio.

**Custo Variável**  
Varia proporcionalmente com a produção: ração, medicamentos, vacinas. Aumenta com mais animais ou mais dias.

**Custo Fixo**  
Não varia com o volume de produção: arrendamento, ITR, depreciação de instalações.

**Custo Explícito**  
Implica saída efetiva de dinheiro (desembolso): pagamento de salário, compra de ração.

**Custo Implícito**  
Não implica desembolso: depreciação de um curral, custo de oportunidade do capital próprio.

**Custo de Oportunidade (CK)**  
Benefício renunciado por não empregar o capital em outra aplicação (ex: poupança, CDB). Fórmula: `CK = Capital × Taxa% a.a. × (Dias / 365)`.

**Depreciação**  
Custo contábil de desgaste de bens de capital (instalações, equipamentos, reprodutores). Fórmula: `DEP/ano = (Valor − Valor Residual) / Vida Útil (anos)`.

**Pró-labore / CADM**  
Remuneração do produtor na função de administrador da fazenda. Deve ser considerado como custo mesmo que não haja pagamento efetivo.

**Rateio**  
Distribuição proporcional de um custo comum entre múltiplos lotes. A base de rateio pode ser: número de cabeças, UA, área ocupada, ou dias de ciclo.

**Custo Total (CT)**  
```
CT = COP + CK
COP = Desembolsos + Depreciação + CADM
```

No HERDON atual, apenas os desembolsos (DES) são calculados.

---

## Receita

**Receita Bruta**  
Total recebido pela venda dos animais antes de qualquer dedução: `Receita Bruta = @ carcaça vendidas × Preço/@`.

**Receita Líquida**  
Receita após descontar frete de saída, comissão de corretor e eventuais impostos: `Receita Líquida = Receita Bruta − Frete − Comissão − Impostos`.

No HERDON, o resultado financeiro usa o valor lançado como 'receita' nas movimentações financeiras. Para que a receita líquida seja correta, frete e comissão devem ser lançados como 'despesa'.

---

## Resultado Financeiro

**Margem Bruta**  
`Margem Bruta = Receita Total − Custos Variáveis`

**Lucro / Prejuízo**  
`Lucro = Receita Total − Custo Total`

Positivo = lucro. Negativo = prejuízo.

**Margem (%)**  
`Margem% = Lucro / Receita Total × 100`

Representa o percentual de lucro sobre a receita.

**Razão Benefício/Custo (RBC)**  
`RBC = Receita Total / Custo Total`  
RBC > 1: lucrativo. RBC = 1: equilíbrio. RBC < 1: prejuízo.

**Ponto de Equilíbrio (Nivelamento)**  
Ponto onde receita = custo total: `Ponto Equilíbrio (@) = Custo Total / Preço por @ carcaça`.

**Custo/@produzida**  
`Custo/@ = Custo Total / Arrobas Produzidas`  
Principal indicador de eficiência de custo. Se maior que o preço de mercado, a atividade está no prejuízo.

**Lucro/cabeça**  
`Lucro/cab = Lucro Total / Qtd Cabeças (ativas)`

**Lucro/arroba**  
`Lucro/@ = Lucro Total / Arrobas Carcaça Totais`  
Calculado sobre arrobas **carcaça**, não viva.

---

## Ciclo do Lote

**Lote Aberto**  
Lote com animais ativos em ciclo de produção. Recebe movimentações financeiras, pesagens e lançamentos de custo.

**Lote Encerrado**  
Lote cujos animais foram todos vendidos, descartados ou transferidos. Não deve receber novas movimentações. O resultado final é definido.

**Dias do Ciclo**  
Número de dias entre a data de entrada do lote e a data atual (para lotes abertos) ou data de encerramento (para lotes encerrados). Deve ser calculado dinamicamente.

---

## Estoque

**Estoque de Insumos**  
Saldo de produtos armazenados na fazenda (ração, sal mineral, medicamentos, vacinas). Calculado por: `Saldo = Estoque Anterior + Entradas − Saídas`.

**Suplementação**  
Fornecimento de nutrientes complementares à dieta base (pasto ou volumoso). Pode ser: mineral (apenas sais), proteico, energético, ou completo. Expresso em `g/kg PV/dia` ou `kg/cab/dia`.

**Sanidade**  
Conjunto de práticas e insumos de saúde animal: vacinação, vermifugação, carrapaticidas, tratamentos curativos.

---

## Indicadores de Pastagem

**UA — Unidade Animal**  
`UA = Peso Vivo / 450`  
Padrão brasileiro. Equivale a um bovino adulto de 450 kg. Usada para comparar rebanhos de diferentes categorias.

**Taxa de Lotação**  
`UA/ha = UA Total / Área de Pastagem (ha)`

**Capacidade de Suporte**  
Máximo de UA que uma pastagem suporta sem degradação: `Capacidade = Área (ha) × Taxa de Suporte (UA/ha)`.

**@/ha/ano**  
`@/ha/ano = Arrobas Produzidas / Área (ha) / (Dias do Ciclo / 365)`  
Principal indicador de produtividade de terra na pecuária.

---

## Evolução do Rebanho

**Estoque Inicial**  
Número de animais ativos no início do período analisado.

**Estoque Final**  
Número de animais ativos no final do período.

**Taxa de Desfrute (%)**  
`Taxa de Desfrute = [(Vendas − Compras + Variação) / Estoque Inicial] × 100`  
Mede quantos animais a fazenda "produziu" e colocou no mercado em relação ao rebanho base.

**Taxa de Mortalidade (%)**  
`Taxa de Mortalidade = (Mortes / Qtd Entrada) × 100`
