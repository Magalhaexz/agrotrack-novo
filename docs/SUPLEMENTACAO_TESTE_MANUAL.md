# Suplementação — Teste Manual (Sprint 36)

Verificação mínima de persistência real, feita com a conta QA
(`herdonapp+qa.sprint34@gmail.com`) contra o Supabase de produção. Não é
QA geral do app — isso fica para a próxima sprint, conforme escopo
explicitamente reduzido desta Sprint 36.

## 1. Criar produto nutricional

1. Abri Suplementação → "Cadastrar produto nutricional".
2. Preenchi: nome "Sal Mineral QA Sprint 36", categoria "Ração",
   quantidade em estoque 10 embalagens, conteúdo por embalagem 25kg
   (= 250kg em estoque), custo unitário R$ 120,00.
3. Salvei. Toast: "Suplementação registrada com sucesso." Produto
   apareceu na tabela com 250,00 kg em estoque.

**Confirmado via SQL** (`select * from estoque where produto ilike
'%QA Sprint 36%'`): 1 linha, com `owner_user_id` da conta QA, `fazenda_id
= 641`, `categoria`, `subcategoria`, `quantidade_atual = 250.000`,
`valor_unitario = 120.0000` — todos os campos do formulário gravados
corretamente.

## 2. Reload e persistência do produto

Recarreguei a página (`window.location.reload()`) e abri Suplementação de
novo. O produto "Sal Mineral QA Sprint 36" continuava na tabela com
250,00 kg — carregado do Supabase, não de cache local.

## 3. Criar consumo de suplementação

1. Abri "Registrar consumo".
2. Selecionei lote "Lote QA 01" (20 cabeças, peso médio 360kg
   carregados automaticamente), origem "Produto", produto "Sal Mineral QA
   Sprint 36", modo "Total manual", quantidade 50kg, data 2026-06-25.
3. Salvei. Toast: "Suplementação registrada com sucesso." Estoque do
   produto caiu de 250,00 para 200,00 kg na tela.

**Confirmado via SQL:**
- `consumo_suplementacao`: 1 linha nova, com `lote_id = 20`,
  `item_estoque_id` apontando para o produto certo, `produto_nome`,
  `quantidade`/`qtd_total`/`quantidade_total = 50`, `custo_total = 6000`
  (50kg × R$ 120/kg), `owner_user_id`, `fazenda_id = 641`,
  `metadata.cabecas_lote = 20`.
- `estoque.quantidade_atual` do produto: caiu para `200.000` — a baixa de
  estoque foi persistida de verdade, não só na tela.
- `movimentacoes_financeiras`: 1 despesa nova, `categoria = 'nutricao'`,
  `valor = 6000`, `lote_id = 20`, `origem_tipo = 'consumo_suplementacao'`,
  `origem_id` apontando para o registro de consumo real — a despesa
  automática também está vinculada ao registro real, não a um ID local
  temporário.

## 4. Reload e persistência do consumo

Recarreguei a página de novo e abri a aba "Histórico" de Suplementação.
O registro "2026-06-25 · Lote QA 01 · Sal Mineral QA Sprint 36 · 50,00 kg
· R$ 6.000,00" apareceu corretamente — carregado do Supabase após o
reload completo (não só re-render de estado em memória).

## O que não foi testado nesta sprint (propositalmente)

Por decisão explícita de escopo da Sprint 36 ("Não fazer QA geral do
aplicativo agora"), os itens abaixo **não** foram verificados aqui e
ficam para uma sprint de QA dedicada:

- Edição/exclusão de produto ou consumo já existente.
- Card "Manejo, sanidade e suplementação" no Relatório do Lote, resumo
  WhatsApp, Decisão de Venda e Hoje na Fazenda com o novo dado real
  (a leitura desses pontos já existia desde a Sprint 33 e lê
  `db.consumo_suplementacao` sem mudança nesta sprint — só não foi
  re-verificada visualmente agora).
- Mensagens de erro/estado vazio ("Cadastre um lote antes...", "Cadastre
  um produto antes...") com cenários reais de conta sem lote/produto.
- Mobile (375/390/430/768px) nos modais de produto e consumo.
- Dietas (segue como pendência documentada, sem tabela real).
- Importação criando consumo de suplementação (não existe esse fluxo).

## Dados de teste deixados na conta QA

O produto "Sal Mineral QA Sprint 36" e o consumo associado foram
deixados na conta de QA (mesma prática das Sprints 34/35, que também
deixaram dados de teste como "Lote QA 01") — não é dado de cliente real,
é a própria conta de teste dedicada para verificação contra produção.
