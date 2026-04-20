# Auditoria Técnica — AgroTrack (React JSX)

Data da análise: 2026-04-20

## 1) Análise geral da estrutura

### Pontos positivos
- Organização por páginas (`src/pages`) e componentes (`src/components`) é clara.
- Há utilitários separados para cálculo e alertas (`src/utils`).
- Formulários estão desacoplados das páginas em componentes próprios.

### Problemas estruturais
- O estado global (`db`) fica inteiro no `App.jsx` e é mutado por todas as páginas via `setDb`, sem camada de serviço/repositório.
- A lógica de negócio está espalhada nas páginas e utilitários, com repetição de funções auxiliares (`gerarNovoId`, `formatarNumero`, `formatarData`).
- Não existe modelo de domínio para movimentações (animal, estoque, financeiro): só há “estado atual” em arrays.

## 2) Bugs e problemas críticos

### 2.1 Retirada de estoque (inconsistente e suscetível a negativo)
**Problema atual:** não existe rotina de baixa de estoque por consumo real. A tela de suplementação só calcula consumo estimado.

```jsx
const qtdEstoque = Number(estoqueItem?.quantidade_atual || 0);
const diasRestantes = consumoTotalDia > 0 ? qtdEstoque / consumoTotalDia : 0;
```

**Risco:** estoque não reflete consumo diário, divergindo do físico.

### 2.2 Média de peso incorreta (não ponderada por quantidade)
**Problema atual em AnimaisPage:**

```jsx
const pesoAtualMedio =
  animais.length > 0
    ? animais.reduce((acc, item) => acc + Number(item.p_at || 0), 0) / animais.length
    : 0;
```

**Erro:** média por registro, não por cabeça. Se um grupo tem 80 cabeças e outro 5, ambos pesam igual na média.

### 2.3 Status de lote (ativo/vendido/encerrado) inexistente
Não há campo `status` no lote e nem regras para transição. A UI assume implicitamente que todos os lotes são ativos.

### 2.4 Integridade dos dados sanitários
No mock inicial há IDs duplicados em `sanitario` (id 1 e 2 repetidos), o que pode quebrar edição/exclusão por chave.

### 2.5 Problemas de estado/sincronização
- Pesagens não sincronizam o `p_at` dos animais do lote.
- Sanitário cria rotina automática, mas sem vínculo de ciclo de vida completo para “realizado” no manejo.
- Exclusões removem registros sem trilha de auditoria.

## 3) Fluxo de entrada e saída (animais e estoque)

### Situação atual
- **Entrada de animais:** só cadastro/edição de “grupo” em `animais`.
- **Saída de animais:** inexistente como evento (venda/morte/descarte/transferência).
- **Entrada de estoque:** cadastro de item com quantidade atual.
- **Saída de estoque:** inexistente como evento; apenas cálculo de consumo teórico.

### Gap central
Falta uma tabela/coleção de **movimentações** com histórico imutável.

### Modelo recomendado (centralizado)
- `movimentacoes_animais`: `id`, `lote_origem_id`, `lote_destino_id`, `tipo` (compra/nascimento/venda/morte/descarte/transferência), `qtd`, `peso_medio`, `valor_total`, `data`, `obs`.
- `movimentacoes_estoque`: `id`, `item_estoque_id`, `tipo` (entrada/consumo/ajuste/perda), `quantidade`, `custo_unit`, `lote_id?`, `origem_ref`, `data`, `obs`.
- `movimentacoes_financeiras`: `id`, `tipo` (receita/despesa), `categoria`, `lote_id?`, `valor`, `data`, `origem_tipo`, `origem_id`.

## 4) Cálculo de arroba em tempo real

### Situação atual
Há cálculo de arroba no consolidado (`calcLote`), mas não em formulário com preview em `onChange`.

### Implementação recomendada (tempo real)

```jsx
const peso = Number(form.p_at || 0);
const rendimento = Number(form.rendimento_carcaca || 52) / 100;
const preco = Number(form.preco_arroba || 0);

const arrobaViva = peso / 15;
const arrobaCarcaca = (peso * rendimento) / 15;
const valorEstimado = arrobaCarcaca * preco;
```

Exibir esse bloco no formulário (ex.: `AnimalForm` ou `PesagemForm`) recalculando a cada `handleChange`.

## 5) Qualidade do código

### Duplicação
- Formatação e `gerarNovoId` repetidos em várias páginas.
- Mapeamentos de labels repetidos (`normalizarTipo`, `normalizarCategoria`).

### Separação de responsabilidades
- Regras de domínio (estoque, rotina sanitária, custo) estão dentro das páginas.
- Falta camada de `services`/`domain` para operações transacionais.

### Validação insuficiente
- Campos numéricos aceitam negativos (qtd, peso, valor, estoque).
- Não há validação de datas (ex.: `saida < entrada`).
- Sem validação de consistência de lote/fazenda em exclusões.

### Erros
- Operações CRUD não têm tratamento de erro estruturado (apenas `alert`/`confirm`).

## 6) Performance

### Re-renders e recomputações
- `DashboardPage` recalcula `calcLote` para todos os lotes em toda renderização.
- Muitos `filter + reduce` por item de tabela (custo O(n²) em listas grandes).

### Melhorias
- Pré-indexar dados com `Map` por `lote_id` (`useMemo`).
- Centralizar seletores derivados (ex.: `selectLoteIndicators(db)`).
- Evitar recriar funções inline em tabelas muito grandes (usar `useCallback` quando necessário).

## 7) Interface e UX

### Pontos críticos
- Fluxos críticos usam `window.confirm` e `alert` (fraco para UX comercial).
- Falta feedback visual robusto: loading de ação, toast de sucesso/erro, estado de salvamento.
- Não há confirmação contextual para ações financeiras/sensíveis além de popup genérico.

### Responsividade
- Uso recorrente de grids fixos `1fr 1fr` e `1fr 1fr 1fr` em modais pode quebrar em celular sem media-query dedicada.

## 8) Banco e modelo de dados

### Problemas atuais
- Estrutura é “snapshot atual” e não orientada a eventos.
- Relações insuficientes para auditoria financeira por lote.
- Sem trilha de custo acumulado por lote em base transacional.

### Melhorias para comercialização
- Entidades de movimentação (animais, estoque, financeiro).
- Status explícito de lote (`ativo`, `vendido`, `encerrado`) com timestamps.
- Agregados calculados por lote: custo total, receita total, lucro líquido.
- Campo de versão/`updated_at` e `created_by` para rastreabilidade.

## 9) Gaps de produto (para vender)

1. Fluxo de venda de lote/animal com impacto em estoque e financeiro.
2. Fluxo de morte/descarte/transferência com histórico.
3. Conciliação financeira (contas a pagar/receber, DRE por lote).
4. Operação offline-first (cache local + sincronização resiliente).
5. Controle de permissões por perfil (proprietário, gerente, funcionário).
6. Backup/restauração e exportação de relatórios (PDF/Excel).
7. Trilhas de auditoria (quem alterou o quê e quando).

## 10) Plano de correção priorizado

### Prioridade 1 (crítico)

#### P1.1 — Criar baixa real de estoque por movimentação
**Trecho atual (problema):**

```jsx
// SuplementacaoPage: apenas leitura da quantidade atual, sem baixar saldo
const qtdEstoque = Number(estoqueItem?.quantidade_atual || 0);
```

**Código sugerido:**

```jsx
function registrarMovimentoEstoque({ itemId, loteId, quantidade, tipo, data, obs }) {
  setDb((prev) => {
    const movimentos = prev.movimentacoes_estoque || [];

    return {
      ...prev,
      movimentacoes_estoque: [
        ...movimentos,
        {
          id: gerarNovoId(movimentos),
          item_estoque_id: itemId,
          lote_id: loteId,
          tipo, // entrada | consumo | ajuste | perda
          quantidade,
          data,
          obs: obs || '',
        },
      ],
      estoque: prev.estoque.map((it) =>
        it.id === itemId
          ? { ...it, quantidade_atual: Number(it.quantidade_atual || 0) - quantidade }
          : it
      ),
    };
  });
}
```

> Regra obrigatória: bloquear saldo negativo e exigir justificativa em ajustes.

#### P1.2 — Corrigir média de peso por cabeça
**Trecho atual (problema):**

```jsx
const pesoAtualMedio =
  animais.length > 0
    ? animais.reduce((acc, item) => acc + Number(item.p_at || 0), 0) / animais.length
    : 0;
```

**Código corrigido:**

```jsx
const totalCabecas = animais.reduce((acc, item) => acc + Number(item.qtd || 0), 0);
const pesoAtualMedio = totalCabecas
  ? animais.reduce((acc, item) => acc + Number(item.p_at || 0) * Number(item.qtd || 0), 0) / totalCabecas
  : 0;
```

#### P1.3 — Criar status de lote e transições
**Trecho atual (problema):** ausência de campo e regra de status.

**Código sugerido (modelo):**

```jsx
// lote
{
  id,
  nome,
  status: 'ativo', // ativo | vendido | encerrado
  data_venda: null,
  data_encerramento: null,
}
```

```jsx
function encerrarLote(loteId, motivo) {
  setDb((prev) => ({
    ...prev,
    lotes: prev.lotes.map((l) =>
      l.id === loteId
        ? { ...l, status: 'encerrado', data_encerramento: new Date().toISOString().slice(0, 10), motivo_encerramento: motivo }
        : l
    ),
  }));
}
```

### Prioridade 2 (importante)

#### P2.1 — Fluxo completo de entradas/saídas de animais
- Implementar `movimentacoes_animais`.
- Atualizar saldo de cabeças por lote via agregação (não edição direta).

#### P2.2 — Arroba em tempo real em formulários
Adicionar preview em `AnimalForm`/`PesagemForm` com:

```jsx
@ viva = peso / 15
@ carcaça = (peso * rendimento%) / 15
valor = @ carcaça * preço
```

#### P2.3 — Validação forte de formulários
- Bloquear números negativos.
- Validar intervalos de datas.
- Exigir consistência mínima por tipo de operação.

### Prioridade 3 (melhoria)

#### P3.1 — Refatorar utilitários compartilhados
Extrair para `src/utils/formatters.js` e `src/utils/id.js`.

#### P3.2 — Seletores memorizados
Criar camada de seletores (`src/domain/selectors`) para diminuir recomputação.

#### P3.3 — UX comercial
- Toasts e banners de erro/sucesso.
- Modo offline com fila de sincronização.
- Confirmações contextuais ricas para ações críticas.

---

## Conclusão executiva
O app já tem boa base visual e cobertura de módulos, mas **ainda não está pronto para comercialização** por ausência de modelo transacional (movimentações), risco de inconsistência entre estoque/animais/custos e ausência de fechamento financeiro por lote com auditoria.

Com as correções da Prioridade 1 e 2, o produto evolui para um nível confiável para operação real em fazendas brasileiras.
