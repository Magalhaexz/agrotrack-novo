# Auditoria UX — Estoque e Suplementação

> Diagnóstico apenas — nenhuma mudança de UI foi implementada nesta auditoria (ver
> [PLANO_ACAO_CORRECOES_HERDON.md](PLANO_ACAO_CORRECOES_HERDON.md), Onda 2/Sprint A-C).
> Método: leitura direta da estrutura real dos formulários no código (`src/pages/EstoquePage.jsx`,
> `src/pages/SuplementacaoPage.jsx`, `src/components/SuplementacaoConsumoModal.jsx`,
> `src/services/movimentacoes.js`, `src/services/consumoSuplementacao.js`). **Sem navegador
> autenticado nesta sessão** — não há cronômetro real, os "passos" abaixo vêm da contagem de
> campos/telas no próprio código, não de uma pessoa clicando.

## Estoque

### Fluxo atual (rastreado no código)

**(a) Cadastrar um item novo (ex.: sal mineral)** — 1 modal, 9 campos: Nome do item, Categoria
(opções: Medicamento / Vacina / Material / Produto veterinário / Insumo geral / Outro — **nenhuma
opção cobre "Ração"/"Sal mineral"** diretamente, empurrando o produtor para "Outro" ou para a tela
separada de Suplementação), Unidade de medida (**texto livre, sem dropdown**), Quantidade inicial,
Quantidade mínima, Custo unitário, Validade, Fornecedor, Observações. Nenhum campo é marcado como
obrigatório visualmente.

**(b) Registrar entrada** — 1 modal, 9 campos, incluindo "Nota fiscal" — um campo de formalidade que
pode intimidar um produtor fazendo uma compra informal de rotina. **Achado funcional (EST-02)**: essa
entrada nunca gera despesa financeira — ver matriz.

**(c) Registrar saída/uso** — 1 modal, dropdown "Tipo" com 5 opções: "Consumo diário", "Tratamento",
"Ajuste", "Perda", "Saída". **Achado funcional crítico (EST-01)**: duas dessas opções ("Tratamento",
"Saída") não existem no serviço que persiste a movimentação — a chamada falha silenciosamente e o
modal fecha como se tivesse dado certo. Além disso, ter uma opção de *tipo* chamada "Saída" dentro de
uma tela já chamada "Registrar Saída" é redundante e confuso por si só.

**(d) Ajustar saldo** — **não existe um fluxo dedicado**. A única forma de reduzir é escolher "Ajuste"
dentro do modal de Saída (com todos os mesmos campos de uma saída normal); para aumentar, é preciso
passar pelo modal de Entrada completo (Fornecedor, Nota fiscal) mesmo para uma simples correção de
contagem física.

**(e) Ver histórico** — uma tabela na mesma página, com filtros por Item/Tipo/Lote. **Sem filtro de
data** (o estado `filters.periodo` existe no código mas nenhuma UI o usa — EST-07 na matriz).

### O que mais atrapalha um pecuarista

1. Duas telas conceitualmente sobrepostas para "cadastrar um insumo" — Estoque "Novo item" vs
   Suplementação "Cadastrar produto nutricional" — sem indicação de quando usar qual.
2. Opções de menu que não funcionam, sem nenhum aviso (EST-01).
3. Nenhuma forma de excluir/estornar um item ou movimentação de estoque geral fora de
   Suplementação/Sanidade (EST-03).
4. "Ajuste" só serve para diminuir; para aumentar é preciso o formulário completo de compra.
5. Termos técnicos expostos que o produtor não precisa conhecer: "tipo de movimentação",
   "origem_tipo" (via categorias derivadas do código, ver FIN-01), unidade como texto livre em vez
   de escolha guiada.

## Suplementação

### Fluxo atual (rastreado no código)

**(a) Planejar suplementação (aba "Dietas")** — modal com: Nome da dieta, Lote vinculado (opcional),
Produto nutricional, Quantidade por cabeça/dia, Tipo de consumo (kg/cabeça/dia, % do peso vivo,
unidade/cabeça/dia). **A própria tela já avisa que isso não persiste na nuvem** ("Dietas ficam salvas
apenas neste dispositivo… não sincronizam") — a barreira entre "isso é só um rascunho local" e "isso
é o registro real" é só texto de aviso, não um bloqueio estrutural da UI.

**(b) Registrar consumo real** — modal separado, com um painel "Base do cálculo" mostrando Lote,
Cabeças, Peso médio, Modo de cálculo, Consumo por cabeça, Estoque disponível, Saldo após consumo —
e um campo "Modo de cálculo" com 3 opções (Manual total / Quantidade por cabeça / Percentual do peso
vivo). Este é o fluxo que **de fato baixa estoque e gera custo** — e funciona corretamente (sem
duplicação, com estorno correto ao editar/excluir — ver SUP-02/03/04 na matriz).

**(c) Ver custo** — "Custo estimado" calculado ao vivo no rodapé do modal de consumo.

**(d) Editar/excluir/estornar** — botões na aba Histórico, com aviso explícito "A quantidade será
devolvida ao estoque." — comunicação clara nesse ponto específico.

### A distinção planejamento × consumo é clara o suficiente?

Razoavelmente clara na **cópia** (a tela avisa que "Dietas" é um recurso em preparação e direciona
para registrar consumo real diretamente pelo produto), mas **não há bloqueio estrutural** — nada
impede o produtor de tentar usar "Dietas" como se fosse o registro oficial e só descobrir depois
(ou nunca) que aquilo não persiste.

### O que mais atrapalha um pecuarista

1. "Dietas" parece uma feature completa (tem seu próprio modal, seus próprios campos) mas é um
   rascunho local — risco real de o produtor achar que planejou a temporada inteira e não ter nada
   salvo.
2. 3 heurísticas diferentes decidem se um item do Estoque conta como "produto nutricional" — um item
   cadastrado como "Insumo geral" no Estoque geral pode não aparecer no dropdown de Consumo da
   Suplementação (EST-04).
3. Regra de saldo negativo diferente da usada no Estoque: aqui é um `window.confirm` nativo do
   navegador (quebra a identidade visual do resto do app) que **permite** deixar o saldo negativo,
   enquanto o Estoque bloqueia (EST-05).

---

## Proposta de fluxo simplificado (referência para a Onda 2 — NÃO implementado agora)

O pedido original desta auditoria trouxe um wireframe textual de como esse fluxo poderia ficar mais
simples para o produtor. Registro aqui como **insumo para a Sprint A/C do plano de ação**, não como
algo já decidido ou implementado:

### Estoque — ações claras em vez de conceitos internos
- **Adicionar produto** · **Registrar entrada** · **Registrar uso** · **Ajustar saldo** · **Ver
  movimentações** — sem expor "tipo de movimentação"/"natureza"/"origem_tipo" ao usuário.
- Cadastro de produto com campos mínimos primeiro (nome, categoria, unidade, quantidade inicial,
  custo, validade, estoque mínimo) e o resto ("Mais informações") recolhido.
- Unidade como escolha guiada (kg, g, litro, ml, saco, unidade, dose, caixa, tonelada) em vez de
  texto livre.
- Mensagem de sucesso com próximas ações sugeridas (Registrar entrada / Registrar uso / Ver produto)
  em vez de só fechar o modal.
- Empty state com CTA único: "Cadastrar primeiro produto".

### Suplementação — separação estrutural, não só textual
- Passo a passo de planejamento (lote → produto → quantidade/cabeça → frequência → duração) com um
  resumo final ("Lote Recria receberá 0,5 kg/cabeça/dia por 30 dias — consumo estimado: 450 kg") —
  e, criticamente, **persistido de verdade** (resolve SUP-01) ou removido até estar pronto.
- Registro de consumo mantendo o painel "Base do cálculo" já existente (funciona bem), só reforçando
  visualmente que esta ação (e só esta) baixa estoque.
- Saldo nunca negativo em nenhum dos dois fluxos (unifica a regra hoje divergente com o Estoque).

Esta proposta não substitui uma validação com produtores reais (Onda 5 do plano de ação) — é um
ponto de partida para a próxima sprint, não uma especificação fechada.
