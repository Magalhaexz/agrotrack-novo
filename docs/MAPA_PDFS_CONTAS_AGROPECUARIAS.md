# Mapa dos PDFs de Contas Agropecuárias — HERDON Sprint 6

> Gerado em 2026-06-16. Estes PDFs são materiais de referência acadêmica e técnica, sem dados sensíveis de fazendas reais.

---

## Tabela geral

| # | Arquivo | Tipo | Período | O que representa | Dados sensíveis | Pode versionar? |
|---|---------|------|---------|-----------------|-----------------|-----------------|
| 1 | `17.pdf` | Técnico-científico | 2023 | Cap. 17 do BR-CORTE 2023 — Tabelas de exigências nutricionais de bovinos de corte | Não | Sim |
| 2 | `232-BOVINOCULTURA.pdf` | Manual operacional | 2018 | Coleção SENAR 232 — Manejo e alimentação de bovinos em confinamento | Não | Sim |
| 3 | `AULA_22_CONTROLPEC_CONTROLE_FINANCEIRO_SIMPLIFICADO.pdf` | Apresentação educacional | n/d | Embrapa CONTROLPEC — Controle financeiro simplificado para pecuária de corte | Não | Sim |
| 4 | `COT104.pdf` | Comunicado técnico | 2007 | Embrapa Comunicado Técnico 104 — Custos de produção na pecuária de corte | Não | Sim |
| 5 | `TCC_Jean_Carlos_Costa.pdf` | TCC acadêmico | 2014 | UFG Jataí — Gestão de custos na pecuária de gado de corte | Não | Sim |

---

## Detalhamento por PDF

### 1 — `17.pdf` — BR-CORTE 2023, Capítulo 17

- **Tipo:** Técnico-científico / nutricional
- **Fonte:** Editora UFV / BR-CORTE 2023
- **Páginas:** 50
- **Conteúdo:** Tabelas de exigências nutricionais (energia, proteína, minerais, aminoácidos) para bovinos de corte em crescimento e terminação, vacas lactantes e bezerros lactentes. Cobre zebuínos, cruzados de corte, cruzados de leite. Sistemas de confinamento e pasto. Classes sexuais: macho inteiro, macho castrado e fêmea.
- **Cálculos presentes:**
  - Estimativa de CMS (Consumo de Matéria Seca) por categoria/sistema
  - Exigências de energia (Mcal/dia), proteína (g/dia), minerais e aminoácidos
  - Exemplos de aplicação das equações do BR-CORTE para GMD = 1,4 kg/dia, PC = 520 kg
- **Relevância para o HERDON:** Alta para o módulo de nutrição/suplementação. Média para o cálculo de GMD esperado e metas de desempenho.
- **Observações:** Documento público. Não contém dados de fazendas reais.

---

### 2 — `232-BOVINOCULTURA.pdf` — SENAR Coleção 232

- **Tipo:** Manual operacional e educacional
- **Fonte:** SENAR — Serviço Nacional de Aprendizagem Rural, 2018
- **Páginas:** 60
- **Conteúdo:** Manual sobre bovinocultura de corte em confinamento. Cobre fases de criação (cria, recria, terminação), suplementação (tipos, estratégias, ingredientes), estrutura do confinamento (instalações, dimensionamento de área, cochos, silos), manejo dos animais (recepção, pesagem, vermifugação, leitura de cocho), e viabilidade econômica.
- **Cálculos presentes:**
  - Fórmula do CMS para cruzados Angus × Nelore: `CMS = −0,6273 + 0,06453 × PC^0,75 + 3,871 × GMD − 0,614 × GMD²`
  - Exemplo: PC = 360 kg, GMD = 1,4 kg/dia → CMS = 8,92 kg/dia
  - Dimensionamento de área de cocho e curral por cabeça
  - Período de recria: seca 180 dias com 300 g/dia + águas 180 dias com 700 g/dia = 180 kg de ganho
- **Relevância para o HERDON:** Alta para suplementação e planejamento de confinamento. A fórmula de CMS é referência para calcular consumo de ração por lote.
- **Observações:** Documento público. Não contém dados de fazendas reais.

---

### 3 — `AULA_22_CONTROLPEC_CONTROLE_FINANCEIRO_SIMPLIFICADO.pdf`

- **Tipo:** Apresentação educacional / slides de aula
- **Fonte:** Embrapa Gado de Corte — pesquisadora Mariana de Aragão Pereira
- **Páginas:** 22
- **Conteúdo:** Aula sobre controle financeiro simplificado para pecuária de corte usando o sistema CONTROLPEC (Embrapa). Aborda funções administrativas (planejamento, organização, direção, controle), sistema de informação na fazenda pecuária, indicadores físicos e econômicos.
- **Indicadores físicos listados:**
  - Bezerros desmamados, taxa de desmama, peso à desmama
  - Ganho de peso diário, @ produzidas
  - Taxa de lotação, peso ao abate, @/hectare/ano
  - Taxa de desfrute, patrimônio (benfeitoria, rebanho, maquinário)
- **Indicadores econômicos listados:**
  - Preço do bezerro, boi magro, vaca e boi gordo
  - Desembolsos por cabeça ou @ produzidas
  - Depreciações e amortizações
  - Custo de oportunidade
  - Pró-labore / remuneração do administrador
  - Imposto de Renda
  - Receitas (vendas, subprodutos, outras)
  - Custos totais e parciais
- **Relevância para o HERDON:** Muito alta — define a lista de indicadores que um sistema de gestão pecuária deve apresentar ao produtor. Serve como checklist de features.
- **Observações:** Documento público. Não contém dados de fazendas reais.

---

### 4 — `COT104.pdf` — Embrapa Comunicado Técnico 104

- **Tipo:** Comunicado técnico acadêmico
- **Fonte:** Embrapa Gado de Corte — Fernando Paim Costa, 2007
- **Páginas:** 12
- **Conteúdo:** Define e explica os tipos de custos aplicados à bovinocultura de corte. Apresenta a hierarquia de custos, aborda depreciações, juros sobre capital, rateios e custo de oportunidade.
- **Estrutura de custos definida:**
  - `CT = COP + CK` (Custo Total = Custo Operacional + Custo de Oportunidade do Capital)
  - `COP = DES + DEP + CADM` (Desembolsos + Depreciações + Custo Administrativo/Pró-labore)
  - Custo médio = CT / unidade produzida (ex: por arroba)
  - Custo fixo: não varia com produção (ITR, depreciação de instalações)
  - Custo variável: varia com produção (medicamentos veterinários, ração)
  - Custo explícito: implica desembolso (salários)
  - Custo implícito: não implica desembolso (depreciação, custo de oportunidade)
  - Custo de oportunidade: benefício renunciado ao não empregar recurso no melhor uso alternativo
- **Relevância para o HERDON:** Alta — define o framework de custos que o sistema deveria implementar para dar ao produtor uma visão completa do custo de produção.
- **Observações:** Documento público. Não contém dados de fazendas reais.

---

### 5 — `TCC_Jean_Carlos_Costa.pdf` — UFG Jataí, 2014

- **Tipo:** TCC (Trabalho de Conclusão de Curso) — Zootecnia
- **Fonte:** Universidade Federal de Goiás — Regional Jataí, 2014
- **Páginas:** 35
- **Conteúdo:** Revisão bibliográfica sobre gestão de custos na pecuária de gado de corte. Cobre classificação de custos, análise econômica, centros de custo, rateio, ponto de nivelamento (breakeven), custos com nutrição animal, sanidade animal e reprodução.
- **Estrutura econômica apresentada:**
  - Custo total: fixos + variáveis + custos de oportunidade
  - Receita Total = vendas de animais + subprodutos + outras receitas
  - Margem Bruta = Receita Total − Custos Variáveis
  - Razão Benefício/Custo = Receita Total / Custo Total
  - Ponto de Nivelamento: quando Receita Total = Custo Total
  - Custo/@ produzida = Custo Total / @ produzidas no ciclo
  - Centros de custo: nutrição, sanidade, reprodução, administração, terra
  - Rateio: distribuição de custos comuns proporcionalmente à atividade
- **Relevância para o HERDON:** Alta — especialmente as fórmulas de resultado econômico e os centros de custo. O HERDON precisa implementar ao menos a razão benefício/custo e o ponto de equilíbrio.
- **Observações:** Documento público. Não contém dados de fazendas reais.

---

## Classificação por tipo de documento

| Tipo | PDFs |
|------|------|
| Financeiro/econômico | COT104, TCC_Jean_Carlos_Costa, AULA_22_CONTROLPEC |
| Técnico-zootécnico | 17 (BR-CORTE), 232-BOVINOCULTURA |
| Controle operacional | 232-BOVINOCULTURA, AULA_22_CONTROLPEC |
| Exemplo de cálculo | 232-BOVINOCULTURA (CMS), TCC (custo/@, margem) |
| Mistura | AULA_22_CONTROLPEC (físico + econômico) |

## Dados sensíveis

Nenhum dos cinco PDFs contém dados reais de fazendas, produtores, CPF/CNPJ, notas fiscais, extratos bancários ou informações comerciais sigilosas. Todos são materiais educacionais ou acadêmicos públicos. Podem ser versionados no Git sem restrições.
