# SPRINT20C_ANIMAIS_AND_PESAGENS_SIMPLIFICATION_HERDON

## Arquivos alterados
- `src/pages/AnimaisPage.jsx`
- `src/pages/PesagensPage.jsx`
- `src/components/PesagemForm.jsx`

## O que foi simplificado
- Animais: organizacao em abas (Grupos, Individuais, Movimentacoes), CTA principal unico `Novo cadastro`, KPIs reduzidos e estados vazios claros.
- Novo cadastro em Animais agora inicia com escolha entre `Grupo de animais` e `Animal individual` com explicacoes curtas.
- Pesagens: organizacao em abas (Nova pesagem, Historico, Evolucao, Alertas), header simplificado e botao principal `Nova pesagem`.
- Historico de pesagens reduzido para colunas operacionais essenciais.
- Formulario de pesagem por lote recebeu `Quantidade pesada (cabecas)`.
- Formulario por animal manteve comportamento em lote e removeu texto tecnico de animais virtuais na interface.

## Regras de negocio preservadas
- Edicao/exclusao continuam disponiveis em Animais e Pesagens.
- Fluxo de pesagem por animal em lote continua batch.
- Criacao automatica/vinculacao de animais de pesagem permanece no fluxo de persistencia da pagina de pesagens.
- Compatibilidade com shape atual de dados mantida sem alteracao de schema Supabase.
- `operationalPersistence.js` nao foi alterado.

## Validacao
- `npm run lint`
- `npm run build`

## Pendencias conhecidas
- Evolucao usa estado simplificado com mensagem quando faltar dados; pode receber graficos dedicados em proximo ciclo.
- Recomenda-se rodada completa de QA manual mobile para refinamento de espacamentos e pontos de toque.
