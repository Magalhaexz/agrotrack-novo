# Auditoria Técnica — AgroTrack (React)

Data da análise: 2026-04-21

## Escopo e método
Análise estática do código front-end (estado em memória via `db` no `App.jsx`, páginas e serviços), com foco em confiabilidade de dados para operação pecuária comercial.

---

## 1) Análise geral da estrutura

### Organização atual
- Estrutura por camadas de pastas existe (`pages`, `components`, `services`, `domain`, `utils`), o que é positivo.
- Porém, há **dois estilos arquiteturais convivendo**:
  1. fluxo “novo” com serviços transacionais (`src/services/movimentacoes.js`),
  2. fluxo “legado” com mutação direta de `setDb` dentro de páginas modais (`LotesPage`, `EstoquePage`).

### Padrões encontrados (e faltantes)
- ✅ Padrão de componentes de formulário separados (ex.: `PesagemForm`, `VendaLoteModal`).
- ✅ Uso pontual de `useMemo` para derivados.
- ❌ Falta padrão único para regras de negócio: parte nas páginas, parte nos serviços.
- ❌ Inconsistência de modelo de campos (`loteId` vs `lote_id`) em movimentações.

### Separação de responsabilidades
- **Incorreta/incompleta** em pontos críticos:
  - regras de estoque, financeiro e rebanho estão duplicadas em modais de página;
  - validação e persistência estão misturadas com UI;
  - não há “fonte única da verdade” para entradas/saídas.

---

## 2) Bugs e problemas críticos

### 2.1 Retirada de estoque com risco de inconsistência
Existem dois caminhos diferentes para saída de estoque:

**Trecho atual problemático (muta direto no modal da página):**
```jsx
// src/pages/EstoquePage.jsx (SaidaModal)
estoque: prev.estoque.map((i) =>
  i.id === Number(form.item_id)
    ? { ...i, quantidade_atual: Number(i.quantidade_atual || 0) - qtd }
    : i
),
```

**Problema:** bypass do serviço central; regras de auditoria/normalização podem divergir do restante do app.

**Trecho sugerido:**
```jsx
// usar handler central vindo do App
await onRegistrarSaidaEstoque({
  itemId: Number(form.item_id),
  loteId: form.lote_id ? Number(form.lote_id) : '',
  quantidade: qtd,
  tipo: form.tipo,
  data: form.data,
  obs: form.obs.trim(),
});
```

### 2.2 Cálculo de média/peso do lote quebrado por fluxo paralelo
`services/movimentacoes.js` calcula média ponderada corretamente, mas `LotesPage` possui modal próprio que não atualiza `lotes.qtd`/`lotes.p_at` pelo mesmo critério.

**Trecho atual problemático:**
```jsx
// src/pages/LotesPage.jsx (MovimentacaoModal)
setDb((prev) => ({
  ...prev,
  movimentacoes_animais: [...(prev.movimentacoes_animais || []), mov],
  // não recalcula resumo do lote com regra única
}));
```

**Impacto:** indicadores podem divergir dependendo da tela usada.

### 2.3 Status do lote (ativo/vendido/encerrado) não atualiza no fluxo principal
No modal de movimentação de lotes, venda não atualiza status do lote.

**Trecho atual problemático:**
```jsx
// src/pages/LotesPage.jsx (MovimentacaoModal)
movimentacoes_financeiras: form.tipo === 'venda'
  ? [...(prev.movimentacoes_financeiras || []), { ... }]
  : (prev.movimentacoes_financeiras || []),
```

**Problema:** não marca `status: 'vendido'` nem fecha lote quando quantidade zera.

### 2.4 Problema de estado/sincronização
- `PesagensPage` grava pesagem mas não sincroniza campo de referência do lote/animal para leitura rápida.
- existem modais/componentes prontos (`VendaLoteModal`, `EntradaEstoqueModal`, `SaidaEstoqueModal`) com regras mais consistentes que não estão conectados ao fluxo de páginas principais.

---

## 3) Fluxo de entrada e saída (animais e estoque)

### Animais
- **Entrada:** existe em `registrarEntradaAnimal` (serviço) e no cadastro manual de grupos.
- **Saída:** existe no serviço, porém tela de lotes usa fluxo alternativo que não aplica mesma regra de fechamento/status.
- **Transferência:** UI aceita tipo de transferência, mas não há efetivação bidirecional (saída no lote origem + entrada no destino com custo/peso).

### Estoque
- **Entrada:** existe em `EstoquePage` e no serviço.
- **Saída/consumo:** existe, mas duplicada em lógica local e serviço.
- **Consumo por lote/tratamento:** não está totalmente amarrado ao sanitário/suplementação com baixa automática confiável.

### Modelo centralizado recomendado
Manter somente serviços como ponto de escrita:
- `registrarMovimentoAnimal()`
- `registrarMovimentoEstoque()`
- `registrarMovimentoFinanceiro()`

E todas as páginas chamam esses serviços (sem `setDb` de negócio inline).

---

## 4) Cálculo de arroba (@) em tempo real

### Situação atual
- Já existe implementação em tempo real via `useArroba` + `ArrobaPreview` (bom).

**Trecho atual correto:**
```jsx
const arrobaViva = p / 15;
const arrobaCarcaca = (p * rend) / 15;
const valorEstimado = arrobaCarcaca * preco;
```

### Ajuste recomendado
Hoje o retorno vem com `.toFixed()` (string). Para evitar bugs de comparação/soma:
```jsx
return {
  arrobaViva,
  arrobaCarcaca,
  valorEstimado,
};
```
E formatar apenas na exibição.

---

## 5) Qualidade do código

### Duplicação
- `MovimentacaoModal` e `SaidaModal` implementam regras já existentes nos serviços.
- Utilitários de normalização/formatação aparecem em múltiplos pontos sem centralização total.

### Funções grandes
- `LotesPage.jsx` concentra várias subfeatures e funções utilitárias no mesmo arquivo (difícil manutenção/teste).

### Lógica de negócio misturada com UI
- Cálculo financeiro e atualização de entidades dentro de modais de interface.

### Validação de formulário
- Há validações básicas, mas faltam regras de consistência:
  - data de saída < entrada,
  - venda com preço/rendimento obrigatórios sempre,
  - bloqueio de lote encerrado para novas movimentações.

### Tratamento de erros
- Predomínio de `alert`/retorno silencioso sem feedback estruturado de falha de negócio.

---

## 6) Performance

### Pontos observados
- `lotesEnriquecidos` recalcula `calcLote` para todos os lotes em qualquer mudança de `db`.
- Filtros com `find/filter` repetidos dentro de `map` em tabelas/cards.

### Melhorias
- Índices memoizados por `lote_id` e `item_estoque_id` (`Map`) para reduzir O(n²).
- Extrair seletores derivados (`selectResumoLotes`, `selectMovimentosEstoque`) em `domain/selectors`.

---

## 7) Interface e UX

### Inconsistências
- Texto e estados de ação não são padronizados entre modais/telas.
- Feedback de sucesso/erro ainda depende de `alert` em vários fluxos.

### Faltas críticas de UX
- Ações sensíveis (encerrar lote, venda, ajustes de estoque) sem confirmação contextual robusta em todas as telas.
- Responsividade: vários formulários usam grid fixo `1fr 1fr` sem adaptação explícita para telas pequenas.

---

## 8) Banco/modelo de dados

### Situação atual
- Modelo em memória (mock) e event sourcing parcial.
- Campos e relacionamentos são úteis, mas há inconsistência de nomenclatura (`loteId`/`lote_id`) e ausência de chave de origem completa em todos eventos.

### Melhorias necessárias para comercialização
- Histórico imutável obrigatório de movimentações (animal, estoque, financeiro, sanitário).
- Custeio por lote derivado de movimentos (não de lançamentos soltos em páginas).
- Fechamento financeiro por lote com resultado auditável (`receita - custo = lucro`).
- Preparar camada para operação offline e sincronização posterior (idempotência de eventos).

---

## 9) Gaps de produto (para comercialização)

1. Fluxo de transferência entre lotes completo e auditável.
2. Fechamento de lote com trava de edição retroativa (ou trilha de ajuste).
3. Conciliação financeira (contas a pagar/receber por competência e caixa).
4. Operação offline-first para uso em campo com sinal ruim.
5. Relatórios gerenciais de margem por lote/período com exportação robusta.
6. Governança de permissões e auditoria por usuário em todos eventos críticos.

---

## 10) Plano de correção priorizado (com código)

### Prioridade 1 — Crítico (integridade de dados)

#### P1.1 Unificar escrita de movimentações (parar mutação inline em páginas)
**Trecho atual (problema):**
```jsx
// src/pages/LotesPage.jsx (MovimentacaoModal)
setDb((prev) => ({
  ...prev,
  movimentacoes_animais: [...(prev.movimentacoes_animais || []), mov],
  ...
}));
```

**Correção sugerida:**
```jsx
// passar handlers do App para LotesPage e usar serviços
await onRegistrarSaidaAnimal({
  loteId: lote.id,
  qtd,
  pesoMedio: peso,
  valorTotal: liquido,
  data: form.data,
  comprador: form.comprador,
  tipo: form.tipo,
  obs: form.obs,
});
```

#### P1.2 Consolidar status de lote via regra única
**Trecho atual (problema):**
```jsx
// venda no modal não atualiza status do lote
movimentacoes_financeiras: form.tipo === 'venda' ? ... : ...
```

**Correção sugerida (serviço central):**
```jsx
if (novaQtd <= 0) {
  lote.status = tipo === 'venda' ? 'vendido' : 'encerrado';
  lote.data_encerramento = data;
  lote.data_venda = tipo === 'venda' ? data : lote.data_venda;
}
```

#### P1.3 Bloquear inconsistências de estoque em todos fluxos
**Trecho atual (problema):**
```jsx
if (!form.data || !form.item_id || qtd <= 0 || qtd > saldo) return;
```

**Correção sugerida:**
```jsx
if (qtd > saldo) {
  throw new Error(`Saldo insuficiente para ${item.produto}`);
}
// capturar erro e mostrar toast de falha
```

### Prioridade 2 — Importante (antes de vender)

#### P2.1 Implementar transferência real origem/destino
- lançar dois eventos atômicos (saída + entrada), mantendo mesmo `origem_id`.

#### P2.2 Sincronizar pesagem com snapshot operacional
- ao salvar pesagem, atualizar referência de peso atual do lote para leitura rápida em dashboards.

#### P2.3 Padronizar validações de negócio
- lote encerrado não recebe movimentação;
- datas coerentes;
- campos financeiros obrigatórios por tipo de evento.

### Prioridade 3 — Melhoria (após estabilidade)

#### P3.1 Refatorar `LotesPage` em módulos menores
- `LoteList`, `LoteDetail`, `MovimentacaoModal`, `FechamentoModal`.

#### P3.2 Performance e selectors
- indexação memoizada e seleção derivada centralizada.

#### P3.3 UX comercial/offline
- feedback transacional (loading/sucesso/erro),
- fila offline de eventos e sincronização resiliente.

---

## Conclusão executiva
O produto evoluiu (há serviços e preview de arroba em tempo real), mas ainda convive com caminhos paralelos de escrita que podem gerar divergência de dados. Para um SaaS comercial rural confiável, o passo mais importante é **centralizar toda movimentação em uma camada única transacional**, garantindo estoque, lote e financeiro sempre consistentes e auditáveis.
