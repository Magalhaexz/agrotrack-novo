# Sprint 37.1 — Resultado

## Funcionalidade entregue

**Auditoria botão por botão + persistência por módulo**, completando a lacuna assumida pela Sprint 37 (que fez smoke test amplo, mas não testou ação real em cada módulo). Detalhe completo em [QA_BOTAO_POR_BOTAO_HERDON.md](QA_BOTAO_POR_BOTAO_HERDON.md).

## 1. Módulos testados em profundidade

Fazendas, Pastos, Lotes, Animais, Pesagens, Modo Curral (ações rápidas), Sincronização, Financeiro, Suplementação + Estoque (cadeia completa: produto → consumo → baixa de estoque → despesa automática), e Importação (com planilha `.xlsx` real gerada para o teste, não apenas leitura de código).

Para cada um: criar, validar inválido, validar válido, editar (quando aplicável), excluir/limpar dados de teste (quando a UI permitia), recarregar a página e confirmar persistência real no Supabase.

## 2. Bug real encontrado e corrigido

**Editar um lote não sincronizava o grupo automático em `animais`.** Esse grupo é criado automaticamente desde a Sprint 35 para alimentar Resultado/Decisão de Venda/Manejo (que leem `animais`, nunca `lotes.qtd`). A criação sincronizava corretamente, mas uma edição posterior do lote — por exemplo, corrigir a quantidade de cabeças — deixava o grupo com o valor antigo, desalinhando silenciosamente os cálculos financeiros e de UA do lote sem qualquer aviso ao usuário.

**Correção:** `src/pages/LotesPage.jsx` agora localiza o grupo automático correspondente (`metadata.criado_automaticamente === true`) ao salvar uma edição de lote e reaplica `buildGrupoAnimaisAutoPatch` com os dados atualizados, persistindo a mudança. Verificado com três edições sucessivas de quantidade de cabeças, cada uma confirmada por reload completo da página.

**Teste de regressão:** `src/pages/lotesLogic.test.js` (novo arquivo, 3 testes).

## 3. Nenhum outro bug de fluxo encontrado

Os demais módulos testados em profundidade (Fazendas, Pastos, Animais, Pesagens, Modo Curral, Sincronização, Financeiro, Suplementação/Estoque, Importação) funcionaram corretamente de ponta a ponta — criação, validação, persistência e reload todos consistentes. A cadeia de Suplementação (produto nutricional → consumo → baixa de estoque → despesa automática) já corrigida na Sprint 36 segue funcionando corretamente: testado criando 250kg de estoque, consumindo 5kg, e confirmando 245kg restantes mais uma despesa automática de R$400 (5kg × R$80/kg), ambos sobrevivendo a reload.

Importação testada com uma planilha real (não apenas pela leitura de código, diferente da Sprint 35): gerada via Node + biblioteca `xlsx`, enviada via simulação de `input[type=file]`, validada, revisada e confirmada — os 3 registros (1 fazenda, 1 pasto, 1 lote) foram criados corretamente vinculados e persistiram após reload.

## 4. Nota sobre falsos positivos do próprio teste

Boa parte do tempo desta sprint foi gasto distinguindo bugs reais de falhas do script de automação do navegador usado para os testes — três armadilhas recorrentes valem registro para sprints futuras (detalhe completo no documento de QA):

1. Botões com texto idêntico em locais diferentes da mesma página (um deles só reabre/reseta o formulário).
2. Validação mostrada como texto inline no formulário (não como toast global) — fácil de confundir com "o clique não fez nada".
3. Ações destrutivas/sensíveis (excluir, confirmar importação) abrem um segundo diálogo de confirmação que precisa de um segundo clique.

## 5. Pendências explícitas

- Teste com perfil não-proprietário (operador/visualizador) — sem conta de teste disponível nesta sessão.
- Planilha de importação com erros propositais (coluna faltante, duplicidade) — não testado.
- Relatório do Lote, Relatórios gerais, exportar/imprimir/WhatsApp, Simulador, Guia do Criador, Planos/Assinatura, Configurações, Perfil — sem ação real testada nesta sprint (cobertos apenas por abertura de página na Sprint 37, ou por leitura de código em sprints anteriores).

## 6. Gates

- `npm test`: **628/628 passando** (3 testes novos para o fix do lote/animais).
- `npm run lint`: limpo.
- `npm run build`: build de produção concluído.

## 7. Recomendação

Os módulos de maior risco operacional e financeiro (cadastro, pesagem, financeiro, suplementação/estoque, importação) estão confirmados funcionando de ponta a ponta com persistência real, e o único bug encontrado já está corrigido e testado. Recomendo uma Sprint 37.2 curta e focada só nas pendências explícitas (perfil não-proprietário + planilha de importação com erros) antes de seguir para a auditoria de cibersegurança — a sprint de permissões vai precisar de uma conta de perfil limitado de qualquer forma, então faz sentido resolver as duas pendências juntas.
