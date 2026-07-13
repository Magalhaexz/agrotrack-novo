# Bug Bash Funcional — HERDON

Sprint bloqueador. Base: commit `1c0973d` (confirmado como `HEAD` e `origin/main` no pré-check). Nenhum recurso novo, nenhuma melhoria só visual, nenhum avanço para piloto/produção até P0 e P1 estarem zerados.

## Origem dos bugs

Não havia um relatório formal de um testador externo disponível nesta sessão (o usuário confirmou isso explicitamente). Em vez de inventar bugs a partir de títulos genéricos, esta rodada é uma **varredura funcional exploratória própria**, com reprodução real em navegador autenticado (conta QA criada nesta sessão, ver abaixo) — não substitui um bug bash real com o testador que encontrou os problemas originais. Cobertura real (não 100%) está registrada na seção final.

## Conta de homologação

Criada via fluxo de cadastro real da aplicação (não inserida direto no banco):
- `qa-bugbash-1@example.com` — perfil `admin` (proprietário), conta nova.
- Assinatura `internal_test` concedida via SQL (mesmo mecanismo usado por outras contas QA já existentes no banco, ex. `qa.sprint34`) para liberar escrita — sem isso a conta cai no modo visualização do gate comercial.
- Dados de teste identificados com prefixo `QA-` conforme pedido, criados e removidos ao final quando temporários.

## Pré-check

```
HEAD = origin/main = 1c0973d
git status --short: só arquivos do vault Obsidian (fora de escopo)
npm run lint: limpo
npm test: 1171/1171
npm run build: ok
```

## Nota de metodologia

Ao interagir via automação de navegador, cliques disparados via `dispatchEvent` sintético (JS puro) mostraram-se **não confiáveis** neste app — em 3 casos separados (dropdown de troca de fazenda, botão "Criar lote" no estado vazio, botão "Salvar pesagem") um clique sintético não disparava o handler React, dando a falsa impressão de bug (nenhuma ação, nenhum erro, nenhum toast). Refeito com clique real do harness (`computer` + `ref` do `read_page`, ou `form_input` para campos), todos os três funcionaram corretamente. Nenhum desses 3 casos é um bug real — registrados aqui só para não serem reabertos por engano. A partir daqui, toda verificação usa `computer`/`form_input`, não `dispatchEvent`.

## Bugs encontrados

| ID | Tela | Ação executada | Resultado esperado | Resultado obtido | Evidência | Prioridade | Status |
| -- | ---- | -------------- | ------------------- | ------------------ | --------- | ---------- | ------ |
| BB-01 | Financeiro (e potencialmente qualquer tela sem tratamento especial em `buildOperationalCreatePayload`) | Conta nova (sem nenhum lançamento ainda) tenta salvar a primeira receita/despesa em "Registrar movimentação" | Lançamento salva e aparece na DRE | Salvamento falha silenciosamente — sem toast, sem fechar modal, sem persistir. Console mostra `[HERDON_SAVE_ERROR]` com `postgresCode: 23505` (duplicate key) | Reproduzido 2x com conta QA nova (perfil="admin", conta sem lançamentos prévios); `select` no banco confirmou zero linhas após o clique; chamada direta a `createOperationalRecord` sem o campo `id` funcionou; `buildOperationalCreatePayload` em `src/services/operationalPersistence.js` não removia `id` no caminho padrão (usado por `movimentacoes_financeiras` e toda tabela sem branch especial), diferente de `fazendas`/`lotes`/`pesagens`/`animais`/`estoque` que já removiam | **P0** (dado não persiste, sem qualquer feedback de erro ao usuário) | ✅ Corrigido |
| BB-02 | Estoque | Cadastrar item novo em "Estoque geral" com categoria explícita "Medicamento" e nome contendo a palavra "Sal" (ex.: "Sal Mineral" — produto real e comum em fazenda) | Item aparece na lista de "Estoque geral" | Item salva corretamente no banco (confirmado via SQL) mas não aparece em nenhuma lista após criar nem após recarregar a página — some para o usuário, parece que o cadastro falhou | `itemEhNutricao()` em `src/pages/EstoquePage.jsx` reclassificava o item como nutrição só por `produto.includes('sal')`, ignorando a `categoria` explícita escolhida no formulário; item ficava oculto na aba padrão "Estoque geral" (só aparecia em "Todos os itens"). `metadata.modulo === 'nutricao'` (sinal oficial usado por `SuplementacaoPage.jsx`) nem era considerado | **P0** (dado parece perdido para o usuário, mesmo estando salvo) | ✅ Corrigido |
| BB-03 | Backend/RLS (afeta toda tabela com policy legada `_own`) | Testado direto via API (bypassando a UI, que já esconde os botões corretamente): usuário convidado com perfil `visualizador` chama `createOperationalRecord('lotes', {...}, session)` | Escrita bloqueada pelo banco, igual ao gate aplicado na sprint anterior | Escrita **bem-sucedida** — a migration anterior (`20260713193754`, sprint passado) só gateou as policies `_same_account`; as policies legadas `_own` (`owner_user_id = auth.uid()`) usam texto de `qual`/`with_check` diferente e não foram tocadas. Qualquer usuário autenticado conseguia inserir um registro com `owner_user_id = seu próprio auth.uid()`, contornando o gate de perfil inteiro — reproduzido com uma segunda conta real (`qa-bugbash-teammate@example.com`) convidada como visualizador da conta QA | **P0** (bypass completo do gate de autorização por perfil aplicado na sprint anterior) | ✅ Corrigido (`supabase/migrations/20260713204723_rls_role_gate_own_policies_visualizador.sql`) — reconfirmado bloqueado após o fix, e reconfirmado que o proprietário real continua escrevendo normalmente |
