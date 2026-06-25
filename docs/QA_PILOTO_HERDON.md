# QA com Conta Piloto Real — HERDON (Sprint 34)

Primeira sessão desde a Sprint 22 com teste autenticado de fato contra o
Supabase real (não apenas a tela de login). Encontrados e corrigidos 5
bugs reais que bloqueavam ou corrompiam silenciosamente o fluxo principal
do produtor — nunca detectados antes porque nenhuma sprint anterior teve
acesso a uma conta autenticada com dados reais.

## 1. Conta e ambiente usado

- **Ambiente:** Supabase de produção (`.env.local` aponta para o único
  projeto existente — não há banco local separado de testes).
- **Conta criada:** `herdonapp+qa.sprint34@gmail.com` (alias do e-mail do
  próprio dono do projeto, `herdonapp@gmail.com`), nome "QA Piloto Sprint
  34", perfil Proprietário, criada via signup normal da tela de login
  (sem bypass, sem `service_role`).
- **Por que não foi usado um e-mail genérico:** o `+alias` do Gmail
  garante que qualquer e-mail de confirmação caia na caixa do
  responsável pelo projeto, sem depender de um e-mail descartável de
  terceiros.

### Dados de teste criados (todos claramente fictícios)

| Tipo | Dado | Observação |
|---|---|---|
| Fazenda | "Fazenda QA Sprint 34" | 1 fazenda |
| Pastos | "Pasto 1" (50 ha), "Pasto 2" (40 ha) | 2 pastos |
| Lote | "Lote QA 01" — Bois, 20 cabeças, confinamento | 1 lote ativo |
| Pesagens | 26/05/2026 (300 kg) e 25/06/2026 (360 kg) | 2 pesagens, GMD 2,0 kg/dia |
| Despesa | Ração, R$ 1.500,00, 10/06/2026, vinculada ao lote | 1 despesa |
| Movimentação de pasto | Lote movido de Pasto 1 → Pasto 2, 20/06/2026, "Rotação de pasto" | 1 movimentação |
| Ocorrência/manejo | Tipo "Manejo", via Modo Curral (offline→sincronizado) | 1 ocorrência → tabela `sanitario` |
| Grupo de animais | "Grupo Lote QA 01", 20 cabeças, 300→360 kg | necessário p/ Resultado funcionar (ver Achado 5) |
| Suplementação | Não testada nesta sessão (ver pendências) | — |

### Como remover esses dados de teste (se desejado)

```sql
-- Rodar nesta ordem (FKs). Confirme os IDs antes (podem mudar em sessões futuras).
delete from lote_pastagens_historico where lote_id = 20;
delete from sanitario where lote_id = 20;
delete from movimentacoes_financeiras where lote_id = 20;
delete from animais where lote_id = 20;
delete from pesagens where lote_id = 20;
delete from lotes where id = 20;
delete from pastagens where faz_id = 641;
delete from fazendas where id = 641;
-- Remover o usuário de auth via painel do Supabase (Authentication > Users
-- > herdonapp+qa.sprint34@gmail.com > Delete user), não via SQL direto.
```

Não removido nesta sessão — deixado disponível para continuar testando
sem precisar recriar tudo, e para o responsável decidir quando apagar.

## 2. Fluxos testados com conta real

| Fluxo | Resultado |
|---|---|
| Login / criar conta | ✅ Funcionou de primeira, sem confirmação de e-mail bloqueante |
| Criar fazenda | ⚠️ Funcionou, mas achei e corrigi um problema de seletor (ver Achado 0) |
| Criar pastos (2) | ✅ Funcionou |
| Criar lote | 🐞 **Bloqueado** por validação excessiva — corrigido (Achado 1) |
| Registrar pesagem (2x) | 🐞 **Quebrado** — corrigido (Achado 2, o mais crítico) |
| Lançar despesa vinculada ao lote | 🐞 **Quebrado** — corrigido (Achado 3) |
| Mover lote de pasto | ✅ Funcionou (depois da correção do Achado 2, que também afeta esta tela) |
| Registrar ocorrência (Modo Curral → sanitário) | ✅ Funcionou, sincronizou corretamente |
| Cadastrar grupo de animais | ✅ Funcionou |
| Ver Resultado do Lote / Custo por arroba / Decisão de Venda | ⚠️ Funcionou, mas só depois de descobrir o Achado 5 (gap de fluxo) |
| Ver Manejo/Sanidade/Suplementação | ✅ Funcionou (status "Em dia", insights corretos) |
| Gerar Relatório do Lote | 🐞 **Pasto atual errado** — corrigido (Achado 4) |
| Copiar resumo WhatsApp | ✅ Texto gerado corretamente (validado via código + testes, não via clipboard) |
| Hoje na Fazenda / Dashboard | ✅ KPIs, alertas e prioridades corretos e consistentes com os dados reais |
| Sincronização | ✅ Contador de sincronizados correto, status claros |
| Modo Curral | ✅ Todas as ações funcionaram; nenhum atalho de sanidade/suplemento (decisão da Sprint 33, mantida) |
| Mobile 375px (Dashboard) | 🐞 **Cabeçalho sobreposto** — encontrado, não corrigido nesta sprint (ver Achado 6) |

## 3. Bugs encontrados e corrigidos

### Achado 1 (crítico) — Não era possível criar um lote básico

**Sintoma:** o formulário "Novo lote" exigia preencher dieta/produto,
consumo diário, preço do suplemento e preço da arroba — mesmo para quem
só queria cadastrar o lote sem planejar suplementação ainda. Bloqueava o
fluxo mais básico do app.

**Causa:** `validarForm` em `src/components/LoteForm.jsx` e
`src/components/loteFormLogic.js` tratava esses 4 campos como
obrigatórios sem necessidade real — Sprint 33 já havia estabelecido que
suplementação real é rastreada em `consumo_suplementacao`, separado do
planejamento do lote.

**Correção:** os 4 campos passaram a ser opcionais (com nota "(opcional)"
nos rótulos); preço da arroba ausente usa o padrão R$270 já usado em
outros lugares do app (`decisaoVenda.js`).

### Achado 2 (crítico, o mais grave) — Registrar pesagem quebrava o lote

**Sintoma:** ao clicar em "Nova pesagem" e salvar, a requisição ia como
`PATCH /pesagens?id=eq.undefined` (400) — a pesagem só foi salva porque
o app tentou de novo via fallback; em seguida, o recálculo do lote
falhava com **"null value in column 'nome' of relation 'lotes' violates
not-null constraint"**.

**Causa raiz (duas camadas):**
1. `abrirNovaPesagem()` em `PesagensPage.jsx` definia `pesagemEditando`
   como um objeto placeholder (`{ tipo, origem: tipo }`, sem `id`) só
   para pré-selecionar "Por lote"/"Por animal" no formulário — mas esse
   objeto é *truthy*, então `salvarPesagem` tratava toda pesagem nova
   como edição (`if (pesagemEditando)` em vez de `if
   (pesagemEditando?.id)`), tentando fazer `PATCH` com `id: undefined`.
2. Mais grave: `buildOperationalUpdatePayload()` em
   `src/services/operationalPersistence.js` reaproveitava o builder de
   **criação** para qualquer atualização parcial. Esse builder preenche
   a tabela inteira (com `null` nos campos ausentes) — correto para
   criar um registro novo, mas catastrófico para um `PATCH` parcial: o
   recálculo de peso do lote após uma pesagem só envia `p_at`/
   `ultima_pesagem`/etc., e o builder tentava zerar `nome`, `faz_id`,
   `status`, `gmd_meta`, `preco_arroba` e todo o resto. Só não corrompeu
   os dados silenciosamente porque `lotes.nome` tem `NOT NULL` — essa
   constraint, por sorte, derrubava a query inteira em vez de gravar
   `null`.

**Alcance real do problema:** esse builder genérico é usado por **todo**
update parcial de `lotes` no app — pesagem (lote e animal), movimentação
de pasto/compra/venda/transferência (`src/services/movimentacoes.js`),
acompanhamento de peso (`AcompanhamentoPesoPage.jsx`), edição rápida em
`LotesPage.jsx`. Qualquer um desses fluxos, em qualquer sprint anterior,
estava potencialmente zerando campos do lote sem ninguém notar.

**Correção:**
- `PesagensPage.jsx`: `if (pesagemEditando?.id)` em vez de `if
  (pesagemEditando)`.
- `PesagemForm.jsx`: título do modal agora usa `initialData?.id` (antes
  mostrava "Editar pesagem" para registros novos).
- `operationalPersistence.js`: `buildOperationalUpdatePayload` agora
  filtra o payload para conter **só os campos presentes no patch
  original** — nunca mais reaplica os campos ausentes como `null`.
- Mesmo padrão de bug encontrado e corrigido em `AnimaisPage.jsx`
  (`abrirNovoPorModo` tinha o mesmo problema — criar animal/grupo também
  estava quebrado) e `AnimalForm.jsx` (mesmo ajuste de título).

**Confirmado ao vivo:** 2 pesagens registradas com sucesso, GMD calculado
corretamente (2,0 kg/dia), `lotes.ultima_pesagem` atualizado, lote some
da lista "sem pesagem recente".

### Achado 3 (crítico) — Lançar despesa/receita quebrava sempre

**Sintoma:** salvar qualquer despesa ou receita em Movimentações
Financeiras falhava com `400 PGRST204: Could not find the 'nota_fiscal'
column`.

**Causa:** `FinanceiroPage.jsx` envia `nota_fiscal: form.nf` no payload,
mas a tabela `movimentacoes_financeiras` nunca teve essa coluna — o
campo do formulário nunca funcionou desde que foi criado.

**Correção:** o número da nota fiscal (quando informado) agora é
guardado dentro de `observacao` (`NF: <numero>`), preservando o dado sem
precisar de migration. Confirmado ao vivo: despesa de R$1.500 salva e
refletida no resumo financeiro.

### Achado 4 — Relatório do Lote mostrava o pasto errado

**Sintoma:** depois de mover o lote do Pasto 1 para o Pasto 2 (confirmado
no banco), o Relatório do Lote continuava mostrando "Pasto atual: Pasto
1" — mesmo após recarregar a página inteira.

**Causa:** `buscarPastagemNome()` em `src/domain/relatorios.js` comparava
`toNumber(pasto.id) === toNumber(pastagemId)`. Como `pastagens.id` é
`uuid` (não numérico), `toNumber()` de qualquer UUID retorna `0` — a
comparação virava `0 === 0` e sempre "achava" o **primeiro** pasto da
lista, nunca o pasto real do lote.

**Correção:** comparação por string (`String(pasto.id) ===
String(pastagemId)`). Confirmado ao vivo: relatório agora mostra "Pasto
2" corretamente.

### Achado 1b (relacionado ao 1) — Cadastro de lote descartava metade dos dados em silêncio

**Sintoma:** mesmo preenchendo "Pasto vinculado", "Categoria animal" e
"Cabeças" no cadastro do lote, esses campos voltavam `null` no banco —
confirmado por consulta direta ao Supabase.

**Causa:** `buildOperationalCreatePayload()` (`operationalPersistence.js`,
ramo `'lotes'`) simplesmente não incluía `pastagem_id`,
`categoria_animal`, `raca`, `qtd` — nem toda a seção "Nutrição/manejo"
(`supl_nome`, `supl_rkg`, `supl_pv_pct`, `supl_estoque_kg`,
`supl_meta_dias`, `consumo_tipo`, `consumo_por_cabeca_dia`,
`consumo_total_estimado`, `custo_total_estimado`, `preco_kg`) nem os
campos de recria/engorda (`tem_recria`, `tem_engorda`, `dias_recria`,
`p_ini_recria`, `p_fim_recria`, `dias_engorda`). O formulário sempre
coletou esses dados — só nunca chegavam ao banco.

**Correção:** todos os campos faltantes foram adicionados ao builder,
com o normalizador certo por tipo de coluna (`uuid`→string,
`numeric`→número, `boolean`→booleano).

**Efeito colateral encontrado e também corrigido:** `dias_estimados`,
`dias_engorda`, `dias_recria` e `supl_meta_dias` são colunas `integer`,
mas o cálculo de planejamento produz dias fracionários (ex.:
`184.6153846...`), o que quebrava com `invalid input syntax for type
integer`. Criado `toNullableInteger()` (arredonda antes de enviar).

**Confirmado ao vivo:** editei o lote de teste informando pasto,
categoria e cabeças — todos os 3 campos (e os de planejamento) agora
persistem corretamente no banco, confirmado por consulta SQL direta.

## 4. Achado documentado, não corrigido — gap entre "Cabeças do lote" e "Animais"

**O problema mais confuso encontrado nesta sessão**, mas que não tem
correção segura e pequena: o campo "Cabeças" do cadastro do lote
(`lotes.qtd`) é **completamente desconectado** da tabela `animais`, que
é a fonte real usada por `getResumoLote`/`calcularResultadoLote` para
calcular cabeças, GMD, arrobas, custo por arroba e decisão de venda.

Um produtor que cadastra um lote com "20 cabeças" e registra pesagens
normalmente (como qualquer pessoa razoavelmente assumiria que basta)
**não vê nenhum resultado** em Resultado dos Lotes / Custo por Arroba /
Decisão de Venda — tudo aparece como "Dados insuficientes", sem nenhuma
mensagem explicando que falta um passo extra: ir em "Animais" → "Novo
cadastro" → "Grupo de animais" e cadastrar o mesmo grupo lá.

Confirmado isto reproduzindo o problema (Resultado mostrava "Animais: 0,
Custo/@: R$0,00, Dados insuficientes" mesmo com 2 pesagens e despesa
lançada) e a correção (criei um grupo de animais com os mesmos
300→360kg/20 cabeças — Resultado passou a mostrar tudo corretamente:
Custo/@ R$18,75, Decisão "Acompanhar por mais alguns dias").

**Por que não foi corrigido nesta sprint:** resolver de verdade exige uma
decisão de produto — (a) gerar automaticamente um registro em `animais`
ao criar um lote com `qtd` preenchida, ou (b) fazer os cálculos de
resultado caírem para `lotes.qtd`/pesagens quando não há `animais`. As
duas opções tocam lógica central usada por várias sprints (32 e 33
inclusive) e merecem desenho cuidadoso, não um patch as pressas.

**Recomendação para Sprint 35:** tratar isso como prioridade #1 — é o
tipo de confusão que faria um piloto real abandonar o app pensando que
"não funciona", quando na verdade falta um passo não documentado em
lugar nenhum da interface.

## 5. Achado documentado, não corrigido — cabeçalho mobile sobreposto (375px)

Em 375px, o Dashboard mostra dois cabeçalhos (`.mobile-topbar` e
`.top-header`) renderizando sobrepostos — o nome "HERDON" e o título da
página ficam parcialmente cobertos por outro elemento. **Esta não é uma
descoberta nova**: já está documentado desde a Sprint 27
(`docs/POLIMENTO_VISUAL_HERDON.md`) como "duplicidade de regras
`.header-tabs`/`.mobile-topbar` no cabeçalho mobile" — confirmado aqui
que o problema persiste. Há pelo menos 10 blocos de regras CSS
conflitantes para essas classes espalhados em `app.css` e `layout.css`.
Não corrigido nesta sprint: consolidar isso com segurança exige
revisão visual de cada página que usa o cabeçalho mobile, não um ajuste
isolado.

## 6. Achado menor — rótulo confuso, não corrigido

O botão "Salvar pesagem" dentro do card "Nova pesagem" (`PesagensPage.jsx`)
não salva nada diretamente — ele abre o mesmo modal do botão "Nova
pesagem" no topo da página. Funciona, mas o texto confunde porque sugere
uma ação imediata. Baixa prioridade, fora do escopo desta sprint.

## 7. O que funcionou bem sem nenhum ajuste

- Login e criação de conta.
- Cadastro de fazenda e pastos.
- Modo Curral (todas as 4 ações + status de sincronização claros).
- Resultado dos Lotes, Custo por Arroba, Decisão de Venda e Manejo/
  Sanidade/Suplementação — uma vez com os dados certos no lugar certo.
- Hoje na Fazenda / Dashboard — KPIs, alertas e prioridades.
- Sincronização (contadores e status corretos).
- Relatório do Lote e geração de texto WhatsApp (depois do Achado 4).

## 8. O HERDON está pronto para o piloto?

**Sim, com uma ressalva importante.** Os 5 bugs críticos corrigidos
nesta sprint (Achados 1–4 e 1b) eram bloqueadores reais — sem eles, um
piloto real não conseguiria nem cadastrar um lote, nem registrar uma
segunda pesagem, nem lançar uma despesa. Corrigidos, o ciclo completo
(fazenda → pasto → lote → pesagem → despesa → resultado → decisão de
venda → manejo → relatório) funciona ponta a ponta contra o banco real.

A ressalva é o Achado 5 (gap Cabeças × Animais): sem correção ou, no
mínimo, uma orientação clara na interface, um piloto real vai cadastrar
o lote, registrar pesagens, e não entender por que "Resultado dos
Lotes"/"Decisão de Venda" mostram tudo zerado. Recomenda-se resolver isso
**antes ou logo no início do piloto** — mesmo que seja só uma mensagem
clara ("Cadastre os animais deste lote em Animais para ver o resultado")
em vez da correção completa de arquitetura.

## 9. Sprint 35 é necessária antes da landing page?

**Recomendo que sim, focada e curta** (não uma sprint de feature nova):

1. Resolver o gap Cabeças × Animais (Achado 5) — mensagem orientativa, no
   mínimo; idealmente criar o registro em `animais` automaticamente.
2. Consolidar o CSS duplicado do cabeçalho mobile (Achado 6).
3. Rodar este mesmo roteiro de QA de novo, agora cobrindo Suplementação
   (não testada nesta sessão), Simulador de Decisão, Importação e
   Equipe/Funcionários — telas que esta sprint não teve tempo de cobrir.
4. Revisar o botão "Salvar pesagem" mal rotulado (Achado 7, baixa
   prioridade).

Depois disso, a landing page pode seguir com confiança de que o fluxo
operacional principal foi validado contra o banco real, não só por
leitura de código.

---

# Sprint 35 — Fechamento de Fluxo Piloto

Continuação direta da Sprint 34, mesma conta QA
(`herdonapp+qa.sprint34@gmail.com`), mesmos dados de teste (fazenda,
pastos, lote, pesagens, despesa, movimentação, ocorrência, grupo de
animais já existentes). Dados novos criados nesta sessão:

| Tipo | Dado |
|---|---|
| Produto nutricional | "Ração QA 18%" (categoria Ração, 100 sacos de 25kg, R$2,50/kg) — **não persistiu**, ver Achado 8 |
| Consumo de suplemento | 50kg em 20/06/2026, vinculado ao Lote QA 01 — **não persistiu**, ver Achado 8 |
| Cenário | "Cenário QA Sprint 35" (01/07–31/12/2026, 5 compras/2 vendas simuladas) — persistiu corretamente |

## Achado 5 (resolvido) — Gap `lotes.qtd` × `animais`

Resolvido com criação automática de grupo em `animais` ao cadastrar um
lote novo com cabeças preenchidas. Detalhes completos, diagnóstico e
decisão técnica: [RESULTADO_LOTE_HERDON.md](RESULTADO_LOTE_HERDON.md).
Como efeito colateral, corrigido também o mesmo padrão de bug (campos
silenciosamente descartados) no builder de payload de `animais`.

Mensagens de "Dados insuficientes" também deixaram de ser genéricas —
agora dizem exatamente qual dado falta (`decisaoVenda.js`,
`listarCamposFaltantesDecisaoVenda`).

## Achado 6 (resolvido) — Cabeçalho mobile sobreposto em 375px

Causa raiz encontrada por medição direta (`getBoundingClientRect`), não
só inspeção visual: duas regras `.header.top-header` concorrentes em
`app.css`, uma com `margin: 0 10px` (design "cartão") e outra com
`width: 100%` sem resetar a margem (design "full bleed"), competindo no
mesmo breakpoint. Corrigido com `margin: 0` na regra que vence a
cascata. Validado em 375/390/430/768px e desktop, em 9 páginas
diferentes, medindo `document.body.scrollWidth` (sem overflow em
nenhuma). Detalhes completos:
[MOBILE_HERDON.md](MOBILE_HERDON.md).

## Achado 8 (novo, crítico) — Suplementação não persiste no banco

A página Suplementação (produtos nutricionais, dietas, registro de
consumo) **nunca chama** `createOperationalRecord`/
`updateOperationalRecord` — só `setDb(...)` local. Confirmado ao vivo:
criei um produto e um consumo, a UI mostrou sucesso, e consultas diretas
ao Supabase (`estoque`, `consumo_suplementacao`,
`movimentacoes_financeiras`) confirmaram **zero linhas gravadas**. Isso
significa que qualquer suplementação "registrada" hoje se perde ao
recarregar a página ou trocar de aparelho. Documentado como pendência de
prioridade alta para a Sprint 36 — corrigir adequadamente é "módulo
grande" (3 entidades + baixa de estoque + geração de despesa automática),
fora do escopo de uma sprint de correção de fluxo. Detalhes:
[SUPLEMENTACAO_HERDON.md](SUPLEMENTACAO_HERDON.md).

## Simulador de Decisão — funciona

Diferente de Suplementação, o Simulador (`CenariosPage.jsx`) chama
corretamente a persistência real. Criei um cenário com a conta QA e
confirmei por SQL que foi gravado no Supabase. Detalhes:
[SIMULADOR_HERDON.md](SIMULADOR_HERDON.md).

## Importação — parcialmente verificada

Ambiente de preview não permite upload de arquivo binário, então a
etapa de envio do `.xlsx` não foi exercitada de ponta a ponta. Por
leitura de código, confirmado que (a) a persistência real está
corretamente conectada (`createOperationalRecord` para todas as 5
entidades) e (b) a validação produz mensagens específicas e claras por
linha/campo, com bloqueio de duplicidade dentro do arquivo e contra o
banco. Recomendado testar com arquivo real na próxima sessão com esse
acesso. Detalhes: [IMPORTACAO_HERDON.md](IMPORTACAO_HERDON.md).

## HERDON está pronto para a landing page?

**Quase — falta resolver o Achado 8 (Suplementação) antes.** Os
bloqueadores de fluxo principal (Achados 1–6 da Sprint 34, gap
qtd×animais e cabeçalho mobile da Sprint 35) estão todos corrigidos e
confirmados contra o banco real. Suplementação continua sendo uma
funcionalidade visível no menu que parece funcionar mas não salva nada —
isso é mais grave para a confiança do piloto do que uma tela ausente,
porque o produtor não tem como saber que perdeu o registro até notar que
ele desapareceu. Recomenda-se ou (a) corrigir a persistência na Sprint 36
antes do piloto, ou (b) ocultar/avisar claramente que a tela está em
desenvolvimento, até lá.

Ver resumo completo da sprint em
[SPRINT_35_RESULTADO.md](SPRINT_35_RESULTADO.md).
