# Sprint 34 — Resultado

## Funcionalidade entregue

**QA Real com Conta Piloto + Correções de Fluxo**

Primeira sessão desde a Sprint 22 com acesso real a uma conta autenticada
contra o Supabase de produção — todas as sprints anteriores só puderam
confirmar que a tela de login carregava sem erro. Esta sprint não cria
feature nova: testou o fluxo completo do produtor com dados reais e
corrigiu os bugs encontrados pelo caminho. Resultado: **5 bugs críticos
corrigidos** que bloqueavam ou corrompiam silenciosamente o uso normal do
app, e 2 achados documentados para a Sprint 35.

Relatório completo de QA, com reprodução, causa raiz e correção de cada
achado: [QA_PILOTO_HERDON.md](QA_PILOTO_HERDON.md).

## 1. Fluxos testados com conta real

Login/signup, fazenda, 2 pastos, lote, 2 pesagens, despesa vinculada ao
lote, movimentação de pasto, ocorrência via Modo Curral (sincronizada),
grupo de animais, Resultado dos Lotes, Custo por Arroba, Decisão de
Venda, Manejo/Sanidade/Suplementação, Relatório do Lote, Sincronização,
Hoje na Fazenda/Dashboard, e um teste mobile em 375px no Dashboard.
Detalhe completo por fluxo: [QA_PILOTO_HERDON.md](QA_PILOTO_HERDON.md#2-fluxos-testados-com-conta-real).

## 2. Problemas encontrados

1. **Criar lote bloqueado** — formulário exigia dieta/produto, consumo
   diário, preço do suplemento e preço da arroba para qualquer lote novo.
2. **Registrar pesagem quebrava o lote** — `PATCH /pesagens?id=eq.undefined`
   seguido de tentativa de zerar `lotes.nome`/`faz_id`/etc. no recálculo
   pós-pesagem (só não corrompeu por sorte da constraint `NOT NULL`).
3. **Lançar despesa/receita sempre falhava** — campo `nota_fiscal`
   inexistente na tabela quebrava 100% dos lançamentos financeiros.
4. **Relatório do Lote mostrava o pasto errado** — comparação de UUID com
   `toNumber()` sempre "achava" o primeiro pasto da lista.
5. **Cadastro/edição de lote perdia pasto, categoria, raça, cabeças e
   toda a seção de suplementação** — builder de payload não incluía
   esses campos; efeito colateral: colunas `integer` recebendo valores
   fracionários quebravam com erro de sintaxe.
6. **(Documentado, não corrigido)** gap entre `lotes.qtd` e a tabela
   `animais` — Resultado/Decisão de Venda ficam "Dados insuficientes" sem
   explicar por quê.
7. **(Documentado, não corrigido)** cabeçalho mobile sobreposto em 375px
   — já conhecido desde a Sprint 27, CSS duplicado em ~10 blocos.
8. **(Documentado, não corrigido)** botão "Salvar pesagem" no card "Nova
   pesagem" só abre um modal, não salva nada — rótulo confuso, baixa
   prioridade.

## 3. Correções realizadas

| # | Arquivo | O que mudou |
|---|---|---|
| 1 | `src/components/LoteForm.jsx`, `src/components/loteFormLogic.js` | Dieta/produto, consumo diário, preço do suplemento e preço da arroba deixaram de ser obrigatórios; rótulos marcados "(opcional)" |
| 2 | `src/pages/PesagensPage.jsx` | `if (pesagemEditando?.id)` em vez de `if (pesagemEditando)` — nova pesagem não é mais tratada como edição |
| 2 | `src/components/PesagemForm.jsx` | Título do modal usa `initialData?.id` (corrige "Editar pesagem" aparecendo em registro novo) |
| 2 | `src/pages/AnimaisPage.jsx`, `src/components/AnimalForm.jsx` | Mesmo bug e mesma correção — criar animal/grupo também estava quebrado |
| 2 | `src/services/operationalPersistence.js` | `buildOperationalUpdatePayload` agora só envia os campos presentes no patch original — não zera mais colunas não informadas em updates parciais (afeta `lotes` em todos os fluxos: pesagem, movimentação, compra/venda, acompanhamento de peso) |
| 3 | `src/pages/FinanceiroPage.jsx` | Número da nota fiscal passa a ser guardado em `observacao` em vez de no campo inexistente `nota_fiscal` |
| 4 | `src/domain/relatorios.js` | `buscarPastagemNome` compara por string, não por `toNumber()` (pasto é uuid) |
| 5 | `src/services/operationalPersistence.js` | `buildOperationalCreatePayload` (ramo `lotes`) ganhou ~20 campos faltantes (`pastagem_id`, `categoria_animal`, `raca`, `qtd`, toda a seção de suplementação/consumo/recria/engorda); novo helper `toNullableInteger` arredonda campos `integer` que recebiam valores fracionários |

## 4. Problemas pendentes

- Gap `lotes.qtd` × `animais` (achado #6) — prioridade #1 para Sprint 35.
- Cabeçalho mobile sobreposto em 375px (achado #7).
- Rótulo "Salvar pesagem" confuso (achado #8).
- Suplementação real (`consumo_suplementacao`), Simulador de Decisão,
  Importação e Equipe/Funcionários não foram testados com conta real
  nesta sessão — faltou tempo, não escopo recusado.
- Conta de teste (`herdonapp+qa.sprint34@gmail.com`) e dados fictícios
  permanecem no banco real, documentados com SQL de remoção em
  [QA_PILOTO_HERDON.md](QA_PILOTO_HERDON.md#como-remover-esses-dados-de-teste-se-desejado)
  — não removidos nesta sessão, para permitir continuidade de teste.

## 5. Resultado do teste mobile

Só o Dashboard foi verificado em 375px nesta sessão (não as 11 páginas
obrigatórias da Etapa 3 do pedido original) — encontrado o cabeçalho
sobreposto (achado #7, já conhecido). As demais páginas/breakpoints
ficam pendentes para a Sprint 35.

## 6. Modo Curral

**Funcionou.** "Registrar pesagem" e "Mover lote de pasto" usam o mesmo
código das telas completas (corrigido pelos achados #2/#5); "Registrar
ocorrência" testado diretamente pelo próprio Modo Curral e sincronizou
corretamente para a tabela `sanitario`, aparecendo como "Sincronizado" em
Sincronização.

## 7. Resultado/Decisão/Manejo

**Funcionaram, com a ressalva do achado #6.** Depois de cadastrar um
grupo em "Animais" (passo que não é óbvio a partir do cadastro do lote),
Resultado dos Lotes mostrou Custo/@ R$18,75, Lucro/@ R$-6,01, status
"Acompanhar por mais alguns dias", simulação vender-hoje-vs-manter com
valores plausíveis, e o card de Manejo mostrou "Sanidade: Em dia" e
"Suplementação: Sem registro no período" corretamente, sem quebrar e sem
`R$0,00` enganoso.

## 8. Resultado de `npm test`, `lint` e `build`

| Gate | Resultado |
|---|---|
| `npm test` | 610 testes, 0 falhas (608 antes da sprint + 2 novos para o bug do pasto/uuid) |
| `npm run lint` | 0 erros |
| `npm run build` | Build de produção concluído com sucesso |

## Arquivos modificados

| Arquivo | O que mudou |
|---|---|
| `src/components/LoteForm.jsx` | Validação de suplementação/arroba tornada opcional + rótulos |
| `src/components/loteFormLogic.js` | Mesma validação (cópia usada só por testes) |
| `src/components/PesagemForm.jsx` | Título do modal usa `initialData?.id` |
| `src/components/AnimalForm.jsx` | Título do modal usa `initialData?.id` |
| `src/pages/PesagensPage.jsx` | Checagem de edição usa `pesagemEditando?.id` |
| `src/pages/AnimaisPage.jsx` | Checagem de edição usa `animalEditando?.id` (2 locais) |
| `src/pages/FinanceiroPage.jsx` | `nota_fiscal` dobrado em `observacao` |
| `src/domain/relatorios.js` | `buscarPastagemNome` por string, não `toNumber()` |
| `src/services/operationalPersistence.js` | Update parcial não zera campos ausentes; create de `lotes` ganha campos faltantes; novo `toNullableInteger` |
| `tests/lotes-consumo.test.js` | Teste de validação opcional atualizado |
| `tests/relatorios.test.js` | 2 testes novos para `buscarPastagemNome` |
| `docs/QA_PILOTO_HERDON.md` | Relatório completo da sessão (novo) |
| `docs/SPRINT_34_RESULTADO.md` | Este documento (novo) |
| `docs/BETA_PILOTO_READY_HERDON.md` | Atualização de sprint |
| `docs/MODO_CURRAL_TESTE_MANUAL.md` | Resultado real do teste (antes pendente) |
| `docs/DECISAO_VENDA_TESTE_MANUAL.md` | Resultado real do teste (antes pendente) |
| `docs/MANEJO_RESULTADO_TESTE_MANUAL.md` | Resultado real do teste (antes pendente) |

## Decisões técnicas

### Por que corrigir `buildOperationalUpdatePayload` na raiz, em vez de só no ponto onde foi encontrado

O bug foi descoberto especificamente no recálculo de lote pós-pesagem,
mas a causa (reaproveitar o builder de criação, que preenche a tabela
inteira, para uma atualização parcial) afeta **qualquer** update parcial
de `lotes` no app — movimentação de pasto, compra/venda/transferência de
animais, acompanhamento de peso. Corrigir só o ponto de pesagem deixaria
os outros fluxos com o mesmo risco de zerar dados silenciosamente.

### Por que não corrigir o gap `lotes.qtd` × `animais` nesta sprint

Resolver de verdade exige decidir entre gerar `animais` automaticamente
ao criar um lote com `qtd`, ou fazer os cálculos de resultado caírem para
`lotes.qtd` quando não há `animais` — as duas opções tocam lógica central
usada pelas Sprints 32 e 33. Uma sprint de correção de fluxo não é o
lugar para essa decisão de arquitetura; documentado com prioridade alta
para a Sprint 35.

### Por que não corrigir o cabeçalho mobile duplicado

Já está documentado desde a Sprint 27 com ~10 blocos de CSS conflitantes
espalhados em dois arquivos. Consolidar com segurança exige revisão
visual de cada página que usa o cabeçalho mobile — maior que o escopo de
uma correção pontual encontrada de passagem durante o teste do Dashboard.

## Pendências para Sprint 35

1. Gap `lotes.qtd` × `animais` (prioridade #1).
2. Cabeçalho mobile sobreposto em 375px.
3. Testar Suplementação real, Simulador de Decisão, Importação e Equipe.
4. Rótulo "Salvar pesagem" confuso.
5. Rodar o roteiro completo de mobile (11 páginas × 5 breakpoints) que
   esta sprint não teve tempo de cobrir.
6. Decidir sobre os dados de teste/conta piloto (manter ou remover — SQL
   de remoção já documentado em `QA_PILOTO_HERDON.md`).
