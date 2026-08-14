# Auditoria Funcional — HERDON como Produtor Real (2026-08-13)

Commit base: `76dfa14`. Metodologia: uso real do app pelo navegador (Browser
pane), logado na conta `magalhaesh617@gmail.com`, executando a jornada de um
produtor do zero — criação de fazenda de teste isolada (**Fazenda Teste
Auditoria**) para não mexer nos dados reais das 3 fazendas já existentes
(`yellowstone`, `Olhos D'água`, `Fazenda Tubaroes`). Console, network e banco
(via MCP Supabase, projeto `ljpiszxicmmuefbiixui`) foram cruzados em cada
etapa para confirmar causa raiz, não só o sintoma na tela.

Esta é uma auditoria manual real (não estrutural de código como a de
2026-07-11 — ver `docs/AUDITORIA_FUNCIONAL_COMPLETA_HERDON.md`), cobrindo a
jornada ponta a ponta: fazenda → pastos → lote → pesagens → movimentação de
pasto → estoque → financeiro → venda parcial → dashboard → alertas →
relatórios → multi-fazenda → navegação/CRUD de exclusão.

## Resumo executivo

- **Fluxos testados**: 12 (fazenda/pasto/lote, animais/cabeças, pesagens,
  movimentação entre pastos, estoque/nutrição, financeiro, venda parcial,
  dashboard, alertas, relatórios, multi-fazenda, navegação/CRUD exclusão).
- **Bugs encontrados**: 8 (2 P0, 3 P1, 2 P2, 1 P3) + 3 achados de
  UX/copy menores.
- **Áreas aprovadas sem falhas**: cadastro de fazenda/pasto/lote (create +
  validação), movimentação entre pastos (histórico, persistência, validação
  de origem=destino), venda parcial (matemática e reflexo em cabeças/pasto/
  financeiro), isolamento de dados entre fazendas, navegação da sidebar
  recolhida (fix do commit `76dfa14` confirmado em produção), lint/testes/
  build (1859 testes, 0 falhas).
- **Não testado** (ver seção final): CRUD completo de Animais individuais,
  Sanidade/IATF, Suplementação por consumo, encerramento total de lote,
  responsividade em todos os 5 breakpoints desktop pedidos, E2E automatizado
  (não há Playwright/Cypress no repo).

## Tabela de problemas

| Prioridade | Área | Problema | Como reproduzir | Esperado | Atual | Evidência | Possível causa |
|---|---|---|---|---|---|---|---|
| **P0** | Pesagens | Primeira pesagem manual registrada logo após criar um lote **falha silenciosamente** e é perdida — nenhuma mensagem de erro aparece para o usuário | 1. Criar um lote novo. 2. Sem recarregar a página, ir em Pesagens → Nova pesagem → selecionar o lote recém-criado → salvar | Pesagem salva normalmente | Console mostra `HERDON_SAVE_ERROR` `pesagens/create` `23503 fk_violation` + `lotes/update` `PGRST116`; a tela volta ao formulário vazio como se nada tivesse acontecido, sem toast de erro | Confirmado via SQL: dropdown de lote continha `value="1"` (id local/sequencial) enquanto o id real no Supabase era `60`. Após F5 o dropdown passa a usar `60` e a mesma pesagem salva com sucesso | O seletor de lote na tela de Pesagens usa um id que não foi resincronizado com o id real retornado pelo insert do lote — mesma classe de bug já documentada em memória (`id local×nuvem`), mas nunca tinha sido reproduzida neste fluxo específico |
| **P0** | Pastos / Fazendas | Excluir um pasto com lote vinculado, ou uma fazenda com lote/pasto vinculado, **não faz nada e não avisa o usuário** — sem modal de confirmação, sem toast, sem erro no console | 1. Ter um pasto com lote ativo (ex.: Pasto C com "Lote Nelore 01"). 2. Clicar em "Excluir" no card do pasto. Repetir para a fazenda que contém esse lote | Bloquear com mensagem clara ("não é possível excluir: existem X lotes vinculados") ou pedir confirmação explicando o que será afetado | Nada acontece. Contraste: excluir um pasto vazio abre corretamente um modal Cancelar/Confirmar | Testado 2x (Pasto C e Fazenda Teste Auditoria), sem log de erro, contagem de itens não muda | Guard silencioso no handler de exclusão (`if (temVinculo) return;` sem feedback) — padrão que a auditoria de 2026-07-17 já pediu para banir ("nunca `warn+return`, sempre `throw`") |
| **P1** | Dashboard | Card "Resumo financeiro" do Painel Geral mostra **sempre R$ 0,00 / 0 pendências**, mesmo havendo contas reais vencendo hoje | Lançar uma despesa em Financeiro sem marcar como paga → voltar ao Painel Geral | "Vencem hoje" e "Total pendente" refletindo o lançamento | Card mostra `PAGAMENTOS VENCIDOS 0`, `VENCEM HOJE 0`, `TOTAL PENDENTE: Nenhum pagamento pendente` | Reproduzido em 2 fazendas diferentes (Fazenda Teste Auditoria com R$ 925 pendente, e Olhos D'água com 1 conta real vencendo hoje) — em ambos os casos o painel "Prioridades de hoje" (logo acima) mostra corretamente "N pagamentos vencem hoje", só o card de resumo financeiro fica zerado | Widget "Resumo financeiro" usa uma fonte/cálculo diferente do motor de alertas e do relatório financeiro (ambos corretos) — 3º sintoma dos "3 sistemas de alerta que não sincronizam" já registrado em memória (Sprint 9/16), agora confirmado também no card financeiro do Dashboard |
| **P1** | Dashboard | "Prioridades de hoje" (pagamentos vencendo) **vaza entre fazendas** — aparece mesmo com uma fazenda ativa que não tem nenhum lançamento financeiro | Criar despesas na "Fazenda Teste Auditoria" → trocar a fazenda ativa para "yellowstone" (0 lotes, 0 dados) → olhar Painel Geral | Nenhuma prioridade financeira, pois a fazenda ativa não tem lançamentos | "ATENÇÃO (1) — 2 pagamentos vencem hoje · Financeiro" continua visível mesmo com `yellowstone` ativa e vazia | Reproduzido após F5 + troca de fazenda ativa; "Pastos/Lotes/Cabeças" do mesmo painel corretamente mostram 0 (escopo por fazenda funciona ali) | O bloco de prioridades financeiras do Dashboard não filtra por `fazenda_id` do jeito que o resto do painel filtra — risco de o produtor achar que uma fazenda tem pendência de outra |
| **P1** | Estoque/Financeiro | `lotes.peso_atual` não é atualizado no banco após uma nova pesagem (fica `null`), mesmo a tela mostrando o peso certo | Registrar uma pesagem para um lote existente → checar a coluna `peso_atual` da tabela `lotes` | Coluna refletindo o peso da última pesagem | Coluna permanece `null`; a tela só "acerta" porque recalcula o peso atual a partir do histórico de pesagens no cliente, não a partir dessa coluna | Confirmado via SQL (`select peso_atual from lotes where id=60` → `null`) logo após pesagem de 195kg salva com sucesso | O update de `lotes` que deveria acompanhar o insert em `pesagens` está falhando (mesmo `PGRST116`/id divergente do bug P0 acima) — não quebra a UI hoje porque ela não lê essa coluna, mas qualquer relatório/integração (ex. bot Telegram) que leia `lotes.peso_atual` direto do banco vai ver dado desatualizado |
| **P2** | Financeiro | Botão **"Nova receita"** abre o modal de lançamento com o campo Tipo já em **"Despesa"** (categoria de despesa inclusive) — é preciso trocar manualmente | Financeiro → clicar em "Nova receita" | Modal abrir com Tipo="Receita" e categorias de receita (Venda Animal, Venda Produto...) | Abre com Tipo="Despesa" e categorias de despesa (Compra Animal, Ração...) | Reproduzido de forma consistente | O modal genérico de lançamento não recebe o tipo pretendido a partir de qual botão (receita/despesa) foi clicado — risco real de o produtor salvar uma venda como despesa sem perceber |
| **P2** | Pastos | Formulário "Cadastrar pasto" não pré-seleciona a fazenda ativa (fica em "Selecione") e **reseta esse campo para vazio depois de cada pasto salvo**, mesmo mantendo nome/área/capacidade preenchidos do cadastro anterior | Cadastrar um pasto → cadastrar outro em seguida sem fechar o formulário | Fazenda continuar selecionada (ou já vir pré-selecionada com a fazenda ativa) | Campo "Fazenda vinculada" volta para "Selecione" a cada salvamento; formulário de Lote, por comparação, já vem com a fazenda ativa pré-selecionada corretamente | Reproduzido ao cadastrar Pasto A → B → C em sequência | Inconsistência entre os dois formulários (Lote pré-seleciona corretamente, Pasto não); some usuário que salva rápido sem conferir cai na mensagem "Nome da fazenda é obrigatório" |
| **P3** | Estoque | Unidade de medida aparece **duplicada** ("500,00 kgkg", "0,00 kgkg") em vários pontos do card do item | Cadastrar item com unidade "kg" | "500,00 kg" | "500,00 kgkg" | Reproduzido em "Saldo atual", "Consumo médio diário" e na coluna QTD do histórico de movimentações | Formatação concatena a unidade vinda do campo com uma unidade fixa no template |

## Achados de UX / dúvidas do produtor (funcionam, mas confundem)

1. **"Notificacoes: 1 alerta pendentes"** — erro de concordância (singular/plural) no badge de notificações do cabeçalho. Pequeno, mas aparece em toda tela.
2. **"Saldo atual 100%"** no card de Estoque não muda conforme o saldo real cai (ficou em "100%" mesmo com 450/500 = 90% e depois com saldo menor ainda) — o percentual parece indicar "está normal" (vs. mínimo), não "% do estoque restante"; o rótulo não deixa isso claro, e um produtor lendo rápido vai interpretar como "estoque cheio".
3. **Data futura aceita sem aviso** em Nova Pesagem (registrei uma pesagem com data 7 dias no futuro e o sistema aceitou normalmente, inclusive usando-a para calcular GMD). Não é necessariamente errado (permite planejamento), mas nenhum aviso indica que a data é futura.
4. **"Peso atual" de um lote recém-criado, sem nenhuma pesagem, exibe o peso inicial** rotulado como "peso atual" ao lado de "Sem pesagem registrada" — tecnicamente correto (é o peso de entrada), mas a combinação dos dois textos lado a lado pode fazer o produtor achar que já existe uma pesagem real.
5. **Relatório Financeiro mostra a categoria interna crua "consumo_estoque"** em vez de um rótulo amigável (ex. "Consumo de Estoque") na lista de "Custos principais".
6. **Dado pré-existente na conta, não introduzido por esta auditoria**: a tela de Lotes (visão "Todas as fazendas") mostra um lote chamado **"recria"** com status Encerrado e **"Sem fazenda"** — órfão, sem `fazenda_id`. Ele não aparece na contagem de LOTES de nenhum card em Fazendas (que soma 2, não os 3 lotes reais da conta), e mostra peso médio 180kg com 0 cabeças e resultado financeiro de -R$ 3.000,00 sem nenhuma pesagem registrada. Não mexi nesse registro (dado real da conta), só reporto — merece uma limpeza de dados dedicada.

## Inconsistências de negócio / cálculo

- Nenhuma inconsistência de **cálculo** foi encontrada nos números que a UI mostra ao usuário: arroba (@=15kg), GMD, custo/lucro por lote, saldo de estoque (entrada−saída), resultado financeiro (receita−despesa) e capacidade de pasto (UA) todos bateram manualmente em todos os casos testados.
- As inconsistências reais estão em **duas fontes de verdade divergentes** para "pagamentos pendentes/vencendo" (Dashboard "Resumo financeiro" vs. tudo o mais) e no **id local×nuvem** de lote recém-criado — ambas descritas na tabela acima.

## Áreas aprovadas sem falhas

- Cadastro de Fazenda, Pasto e Lote (criar, validação de campo obrigatório, edição básica).
- Pesagens (após contornar o bug P0): cálculo de @ viva/carcaça, GMD, atualização de peso atual do lote nas telas de Lotes/Dashboard.
- Movimentação entre pastos: histórico correto A→B→C, bloqueio/aviso de origem=destino, ocupação dos pastos atualizada corretamente, persistência confirmada após F5.
- Estoque: entrada, saída/consumo vinculado a lote, bloqueio de saída maior que o saldo, geração automática de despesa financeira a partir do consumo.
- Financeiro: criação de despesa/receita, DRE, "Custos por Lote", exportação de Relatório Financeiro batendo com a tela de origem.
- Venda parcial de lote: bloqueio de venda maior que o rebanho disponível, redução correta de cabeças, reflexo em pasto/financeiro/resultado do lote.
- Isolamento entre fazendas: dados de cada fazenda (lotes, pastos, alertas críticos de lotação) não vazam entre si na maior parte das telas.
- Navegação com sidebar recolhida (submenu flyout → clique no item) — o fix do commit `76dfa14` segue funcionando.
- `npm run lint`, `npm test` (1859 testes, 0 falhas) e `npm run build` — todos limpos no HEAD atual.

## Fluxos não testados (e por quê)

- **Animais individuais** (cadastro/edição/exclusão/duplicidade de identificação): a conta usa o modelo agregado (lote.qtd), não cheguei a criar registros individuais em `Animais`.
- **Sanidade/IATF e Suplementação/Nutrição** (consumo, carência): não testados nesta rodada por tempo; ambos já têm achados documentados em auditorias anteriores (Sprint 15).
- **Finalizar lote / encerramento total**: testei apenas venda parcial; não cheguei a "Finalizar lote" até o fim.
- **Responsividade completa**: cobri 1280×1400 (desktop) e 375×812 (mobile) rapidamente; não testei os 5 breakpoints desktop (1024/1280/1366/1440/1920) nem tablet.
- **E2E automatizado**: não há Playwright/Cypress configurado no repositório — nada para rodar/estender nesta sprint.
- **Duplo clique / cliques rápidos repetidos**: não testado sistematicamente (proteção de duplo-submit já documentada como parcialmente resolvida em auditorias anteriores).
- **Logout/login novamente**: não testado nesta rodada (troquei de fazenda e dei refresh, mas não fiz logout completo).

## Dados de teste criados (não removidos)

Para não arriscar dados reais da conta, toda a jornada de CRUD foi feita numa
fazenda nova e claramente identificável: **"Fazenda Teste Auditoria"**
(responsável "Auditoria Claude", cidade "Cidade Teste/GO"), com 2 pastos
restantes (Pasto B, Pasto C — Pasto A foi excluído como teste), 1 lote
("Lote Nelore 01", 12 cabeças ativas após venda parcial de 8), 1 item de
estoque ("Ração 18%") e lançamentos financeiros de teste. Não foi possível
excluir a fazenda/pasto de teste até o fim porque a própria exclusão com
vínculos está com o bug P0 acima. Recomendo remoção manual (ou via um fix do
bug de exclusão) quando conveniente.

## Recomendação de ordem de correção

1. **P0** — exclusão silenciosa (pasto/fazenda com vínculo) e pesagem perdida em lote recém-criado (ambos achados de maior risco: perda de dado sem aviso).
2. **P1** — `lotes.peso_atual` não sincronizado, e os dois bugs do card financeiro do Dashboard (zerado + vazamento entre fazendas) — mesma área, faz sentido corrigir junto.
3. **P2** — "Nova receita" abrindo como despesa; reset do campo fazenda no formulário de pasto.
4. **P3** — "kgkg" duplicado, concordância do badge de notificações, rótulo "Saldo atual %", categoria crua no relatório.

## Validação técnica

```
npm run lint   → 0 problemas
npm test       → 1859 passed, 0 failed
npm run build  → OK (2.01s)
```

Nenhum arquivo de código foi alterado nesta sprint (somente este relatório).
