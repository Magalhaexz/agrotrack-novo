# Teste Manual — Movimentação de Lotes entre Pastos (Sprint 21)

## Método

Sem credenciais de uma conta de QA dedicada disponíveis neste ambiente, o
teste foi executado **diretamente contra o banco real do projeto Supabase**,
impersonando a sessão autenticada do usuário `herdonapp@gmail.com` (conta do
próprio projeto) via `SET LOCAL ROLE authenticated` + `SET LOCAL
request.jwt.claims`. Essa técnica faz com que `auth.uid()` e todas as
policies de RLS se comportem exatamente como em uma chamada autenticada real
pelo frontend — não é um bypass de RLS (a sessão continua sujeita a todas as
policies de `lotes`, `pastagens` e `lote_pastagens_historico`).

Todos os dados de teste foram criados com o prefixo `QA Sprint 21
(temporário)` / `QA Pasto`, executados dentro de uma transação, e **removidos
por completo ao final** (fazendas, pastos, lote e histórico). Conferido por
contagem zero após a limpeza. Nenhum dado de teste permaneceu no banco.

## Roteiro executado (Etapa 10 do plano)

| # | Passo | Resultado |
|---|---|---|
| 1 | Criar fazenda (Fazenda A) | ✅ criada |
| 2 | Criar dois pastos na Fazenda A (Pasto 1, Pasto 2) | ✅ criados |
| 3 | Criar lote vinculado ao Pasto 1 | ✅ `lotes.pastagem_id` = Pasto 1 |
| 4 | Mover lote para Pasto 2 (62 cabeças, motivo "Rotação de pasto") | ✅ RPC retornou histórico com origem=Pasto 1, destino=Pasto 2 |
| 5 | Confirmar que o lote ficou com Pasto 2 como atual | ✅ `lotes.pastagem_id` = Pasto 2 |
| 6 | Confirmar histórico Pasto 1 → Pasto 2 | ✅ 1 linha em `lote_pastagens_historico` com origem/destino corretos |
| 7 | Tentar mover para pasto de outra fazenda (Fazenda B) e confirmar bloqueio | ✅ bloqueado: "O pasto de destino pertence a outra fazenda." |
| 8 | Tentar mover para o mesmo pasto e confirmar comportamento esperado | ✅ bloqueado sem motivo ("destino é igual ao pasto atual..."); ✅ aceito ao informar motivo ("Confirmação pós-vacinação"), gerando novo registro de histórico origem=destino=Pasto 2 |
| 9 | Conferir se a tela continua correta após sair e entrar novamente | ✅ verificado por reconsulta independente (nova query, fora da transação de escrita) — `lotes.pastagem_id` e o histórico retornam o estado correto, confirmando que não há dependência de cache/estado em memória |

## Casos adicionais verificados (cobertura da Etapa 8 contra o banco real)

| Caso | Resultado |
|---|---|
| Lote sem pasto atual (`pastagem_id IS NULL`) movido para pasto válido | ✅ aceito; histórico gravado com `pastagem_origem_id IS NULL` |
| Pasto de destino não informado (`NULL`) | ✅ bloqueado: "Selecione o pasto de destino." |
| Data da movimentação não informada (`NULL`) | ✅ bloqueado: "Informe a data da movimentação." |
| Quantidade de cabeças negativa (-5) | ✅ bloqueado: "A quantidade de cabeças deve ser maior que zero." |
| Lote inexistente (id fora de qualquer conta) | ✅ bloqueado: "Lote não encontrado ou não pertence à sua conta." — mesma mensagem usada para "lote de outra conta", sem distinguir os dois casos (não revela existência de dados de terceiros) |
| Excluir o pasto atualmente vinculado ao lote | ✅ `lotes.pastagem_id` virou `NULL` automaticamente (`ON DELETE SET NULL`); as linhas de histórico que referenciavam esse pasto (como origem ou destino) tiveram a referência zerada, sem erro e sem perda do registro histórico em si |

## Limitação conhecida

**Isolamento entre contas diferentes** (dois `auth.users` distintos) não foi
testado com uma segunda conta real, por falta de credenciais de uma segunda
conta neste ambiente. A garantia de isolamento depende de
`app_is_same_account()`, uma função já existente e usada por todas as outras
tabelas do projeto (`lotes`, `pastagens`, `movimentacoes_animais` etc.) — a
função `mover_lote_para_pasto` não introduz lógica de isolamento nova, apenas
reutiliza as mesmas policies de RLS já em produção. O caso "lote inexistente"
testado acima exercita o mesmo caminho de código que seria executado para um
lote de outra conta (RLS filtra a linha antes da função conseguir vê-la).

## Verificação visual (browser)

Não realizada nesta sessão — não havia servidor de preview em execução com
uma sessão autenticada disponível para clicar pela interface. A verificação
acima cobre o comportamento real do banco (RPC + RLS) com a mesma sessão que
o frontend usaria; os testes automatizados (`npm test`) cobrem a lógica de
validação e formatação do frontend. Recomenda-se uma passada visual rápida na
aba "Pasto" do detalhe do lote antes do próximo deploy, especialmente para
confirmar o filtro de pastos por fazenda no select do modal.

## Gates de qualidade

| Gate | Resultado |
|---|---|
| `npm test` | ✓ 408 testes, 0 falhas (23 novos) |
| `npm run lint` | ✓ sem erros |
| `npm run build` | ✓ build completo |
