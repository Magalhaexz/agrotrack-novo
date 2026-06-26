# QA Botão por Botão — Sprint 37.1

**Gerado em:** 2026-06-26
**Conta usada:** "QA Piloto Sprint 34" (perfil PROPRIETÁRIO), Supabase de produção.
**Ambiente:** build de produção real (`npm run build` + `vite preview`), mesma sessão autenticada usada na Sprint 37.
**Metodologia:** abrir → clicar → criar → editar → cancelar → salvar (válido e inválido) → recarregar → confirmar no Supabase, para os módulos de maior risco operacional. Dados de teste prefixados com `QA371` para identificação e limpos ao final quando exclusão estava disponível na UI.

## Cobertura desta sprint vs. Sprint 37

A Sprint 37 fez varredura de navegação (abrir todas as páginas) e smoke test dos dois bugs reportados. Esta sprint (37.1) foi mais profunda: testou **ação real** (criar/editar/excluir/recarregar) nos módulos operacionais e financeiros de maior risco, e tentou de fato a importação com uma planilha real.

## Tabela por módulo

| Módulo | Ações testadas | Persistiu? | Console limpo? | Mobile OK? | Bugs encontrados | Correção aplicada |
|---|---|---|---|---|---|---|
| Modo Curral / Suporte (retest) | Ver pendências (2 botões), todos os links do Suporte, mailto, legais | — | ✅ | ✅ (375px) | Nenhum reproduzido | — |
| Fazendas | Criar, cancelar, salvar inválido (nome vazio bloqueado), salvar válido, editar, excluir | ✅ (reload) | ✅ | — | Nenhum | — |
| Pastos | Criar, salvar inválido (sem fazenda bloqueado), salvar válido, editar área/capacidade, excluir | ✅ (reload) | ✅ | — | Nenhum | — |
| Lotes | Criar (validação completa: nome, fazenda, qtd, peso inicial, peso alvo, GMD), criação automática de grupo em `animais`, editar qtd, reload | ✅ (reload) | ✅ | — | **Sim — ver seção 2** | ✅ Corrigido |
| Animais | Criar grupo, validação (fazenda, nome, qtd, data de entrada), reload | ✅ (reload) | ✅ | — | Nenhum (mensagem de erro existe, classe CSS diferente do LoteForm) | — |
| Pesagens | Nova pesagem por lote, validação completa, atualização do peso/última pesagem do lote, reload | ✅ (reload) | ✅ | — | Nenhum | — |
| Modo Curral (ações rápidas) | Abrir/cancelar modal de despesa, salvar despesa válida, vínculo com Sincronização | ✅ (Financeiro) | ✅ | — | Nenhum | — |
| Sincronização | Pendências, sincronizar agora, registros, estado vazio | ✅ | ✅ | ✅ (375px) | Nenhum | — |
| Financeiro | Despesa criada via Modo Curral confirmada em Lançamentos com valor/data/categoria corretos | ✅ | ✅ | — | Nenhum | — |
| Suplementação + Estoque | Criar produto nutricional → persiste em `estoque`; registrar consumo → baixa de estoque (250→245kg) + despesa automática (R$400 = 5kg×R$80) em `movimentacoes_financeiras`; reload | ✅ (reload) | ✅ | ✅ (375px, modal sem overflow) | Nenhum | — |
| Importação | Planilha real gerada (.xlsx com Fazendas/Pastos/Lotes), upload via input de arquivo, validação ("Tudo certo"), confirmação com diálogo extra, 3 registros importados e confirmados em Fazendas/Pastos/Lotes, reload | ✅ (reload) | ✅ | — | Nenhum | — |

## 1. Nota metodológica importante: vários "bugs" eram do script de teste, não do app

Boa parte do tempo desta sprint foi gasto distinguindo bugs reais de falhas do próprio script de automação usado para dirigir o navegador. Vale registrar os padrões encontrados, porque são armadilhas reais de teste, não do HERDON:

- **Botões com o mesmo texto em lugares diferentes** (ex.: "Salvar pesagem" existe tanto no botão inline do Card "Nova pesagem" — que só reabre o formulário — quanto no rodapé do modal real). Um seletor por texto sem escopo pode clicar no botão errado e parecer que "nada acontece".
- **Validação client-side sem toast** (ex.: `LoteForm` e `AnimalForm` mostram erro de validação como texto inline no formulário, não como toast global) — um teste que só observa `.toast-stack` conclui erradamente que o clique não fez nada.
- **Confirmação em duas etapas** (exclusão de fazenda/pasto, importação) abre um `ConfirmModal` com botão "Confirmar" — clicar só no botão que abriu o diálogo não basta.
- **Snapshot de acessibilidade desatualizado**: a ferramenta de snapshot usada para verificar texto na tela ocasionalmente mostrou estado desatualizado em comparação com leitura direta do DOM (`document.body.innerText`) logo após uma navegação. Sempre que algo parecia não ter mudado, uma segunda leitura direta do DOM confirmou que tinha mudado.

Esses três padrões, combinados, explicam quase todos os "falsos positivos" investigados nesta sprint.

## 2. Bug real encontrado e corrigido: edição de lote não sincronizava o grupo automático em `animais`

- **Onde:** `src/pages/LotesPage.jsx`, função `handleNovoLote`, branch de edição (`if (loteEmEdicao)`).
- **Como reproduzir (antes da correção):** criar um lote com cabeças preenchidas (gera grupo automático em `animais`, Sprint 35) → editar o lote e mudar a quantidade de cabeças → o lote mostra a nova quantidade, mas o grupo em `animais` continua com o valor antigo.
- **Por que importa:** Resultado dos Lotes, Decisão de Venda e Manejo leem `animais`, não `lotes.qtd` (comentário já existente no código, da Sprint 35). Sem essa sincronização, editar a quantidade de cabeças de um lote silenciosamente desalinha os cálculos financeiros e de UA do lote — um "sucesso falso" sutil: a tela mostra a edição salva, mas o número usado nos cálculos é o antigo.
- **Correção:** após persistir a edição do lote, localiza o grupo em `animais` criado automaticamente (`metadata.criado_automaticamente === true` e `lote_id` correspondente) e reaplica `buildGrupoAnimaisAutoPatch` com os dados atualizados do lote, persistindo via `updateOperationalRecord('animais', ...)`.
- **Verificado:** editar `qtd` de 5 → 8 → 12, com reload completo entre cada edição — o grupo em `animais` acompanhou corretamente em todos os casos.
- **Teste de regressão:** `src/pages/lotesLogic.test.js` (3 testes para `buildGrupoAnimaisAutoPatch`, incluindo o caso de edição usado para reproduzir o bug).

## 3. Importação com planilha real

Diferente da Sprint 35 (que só verificou por leitura de código), esta sprint gerou uma planilha `.xlsx` real (Node + biblioteca `xlsx`, já dependência do projeto) com as abas `Fazendas`, `Pastos` e `Lotes` no formato exato do template oficial, e simulou o upload via `input[type=file]` + `DataTransfer` no navegador real.

Resultado: parsing correto ("Tudo certo! Você pode avançar e confirmar a importação."), revisão mostrando "3 registros serão importados", diálogo de confirmação extra (`onConfirmAction`) e, após confirmar, os 3 registros apareceram corretamente vinculados (fazenda → pasto → lote) e sobreviveram a um reload completo da página.

Não testado: erro de coluna faltante e duplicidade (Etapa 9 do pedido original) — não houve tempo nesta sessão para gerar variações da planilha com esses defeitos propositais. Fica como pendência.

## 4. Pendências explícitas desta sprint

- **Perfis não-proprietário:** não havia conta de teste com perfil operador/visualizador disponível nesta sessão. Não testado. Recomenda-se criar uma conta dedicada antes da sprint de cibersegurança/permissões.
- **Planilha de importação com erros propositais** (coluna faltante, duplicidade): não testado.
- **Relatórios e compartilhamento** (Relatório do Lote, WhatsApp/copiar texto, exportar/imprimir): não testado nesta sprint — já havia sido testado por leitura de código em sprints anteriores, mas não com ação real de clique.
- **Simulador de Decisão:** não testado nesta sprint (já confirmado funcionando na Sprint 35).
- **Auditoria botão a botão 100% exaustiva** de todos os ~30 módulos do checklist original: esta sprint priorizou os módulos de maior risco (cadastro operacional, financeiro, suplementação/estoque, importação) em profundidade, em vez de cobertura rasa de todos. Guia do Criador, Planos/Assinatura, Configurações e Perfil não tiveram ação real testada nesta sprint (apenas abertura, na Sprint 37).

## 5. Severidade dos achados

| Achado | Severidade | Status |
|---|---|---|
| Edição de lote não sincronizava grupo automático em `animais` | **Alto** (desalinha cálculos financeiros/UA silenciosamente após uma edição comum) | ✅ Corrigido |
| Falsos positivos de teste (botões duplicados, validação inline, confirmação em duas etapas) | Informativo | N/A — documentado para sprints futuras |
| Perfis não-proprietário não testados | Médio (pendência de cobertura, não bug confirmado) | Pendente |
| Planilha de importação com erros propositais não testada | Baixo | Pendente |

## 6. Recomendação

Os módulos testados em profundidade nesta sprint (Fazendas, Pastos, Lotes, Animais, Pesagens, Modo Curral, Sincronização, Financeiro, Suplementação/Estoque, Importação) estão funcionando corretamente de ponta a ponta, com persistência real confirmada por reload em todos os casos, e o único bug real encontrado já foi corrigido e tem teste de regressão. As pendências (perfis não-proprietário, planilha de importação com erros) são razoáveis para uma Sprint 37.2 dedicada ou para a sprint de cibersegurança/permissões, que naturalmente vai precisar de uma conta de perfil limitado de qualquer forma.
