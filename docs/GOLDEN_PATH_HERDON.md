# Golden Path — Fluxo Completo do Produtor

> Sprint 4 · Etapa 5 · Gerado em 2026-06-15  
> Método: análise de código + verificação via Supabase MCP. Teste manual em browser pendente.

---

## O que é o Golden Path

Fluxo principal de um novo produtor: do cadastro até o primeiro ciclo completo de lote com financeiro funcional. É o critério mínimo de go/no-go.

---

## Pré-condições

- App: `https://agrotrack-novo.vercel.app`
- Supabase: projeto `ljpiszxicmmuefbiixui`
- Asaas: sandbox configurado
- Conta de teste: novo email (não existente no banco)

---

## Etapas

### Etapa 1 — Cadastro de nova conta

| Item | Esperado | Verificado |
|------|----------|-----------|
| Acessar `/` sem estar logado | Redireciona para `/login` | ⬜ Testar |
| Clicar em "Criar conta" | Formulário de cadastro aparece | ⬜ Testar |
| Preencher email e senha | Campos aceitos | ⬜ Testar |
| Submeter cadastro | Supabase envia email de confirmação | ⬜ Testar |
| Trigger `on_auth_user_created` | Profile criado com `perfil = 'PROPRIETARIO'`, `owner_user_id = id` | ✅ Verificado via SQL — função correta |

**Nota:** o email de confirmação deve estar configurado no Supabase Auth. Verificar template em Auth → Email Templates.

---

### Etapa 2 — Login

| Item | Esperado | Verificado |
|------|----------|-----------|
| Confirmar email (link no email) | Conta ativada | ⬜ Testar |
| Login com email e senha | Dashboard carrega | ⬜ Testar |
| `normalizarPerfil('PROPRIETARIO')` | → `'proprietario'` via toLowerCase | ✅ Verificado em `perfis.js:174` |
| Permissões proprietário carregadas | `permissoesPorPerfil['proprietario'] = ['*']` | ✅ Verificado em `perfis.js:31` |

---

### Etapa 3 — Criar fazenda

| Item | Esperado | Verificado |
|------|----------|-----------|
| Navegar para `/fazendas` | FazendasPage carrega | ⬜ Testar |
| Clicar em "Nova fazenda" | Formulário aparece | ⬜ Testar |
| Preencher nome e salvar | Fazenda salva com `owner_user_id = auth.uid()` | ✅ Policy `fazendas_insert_owner` garante isso |
| Fazenda aparece na lista | SELECT com RLS funciona | ✅ Policy `fazendas_select_owner` garante isso |

**Fonte da data do banco:** 2 fazendas existentes, 0 com owner_user_id NULL — estrutura correta.

---

### Etapa 4 — Criar lote

| Item | Esperado | Verificado |
|------|----------|-----------|
| Navegar para `/lotes` | LotesPage carrega | ⬜ Testar |
| Criar novo lote vinculado à fazenda | Lote salvo | ⬜ Testar |
| Lote aparece na lista | SELECT funciona | ⬜ Testar |
| `owner_user_id` preenchido | Mesmo que fazenda | ✅ Policy `lotes_insert_own` garante |

---

### Etapa 5 — Adicionar animais ao lote

| Item | Esperado | Verificado |
|------|----------|-----------|
| Acessar detalhes do lote | Tela de detalhes carrega | ⬜ Testar |
| Adicionar animal | Formulário de animal | ⬜ Testar |
| Animal aparece no lote | SELECT via `animais_select_owner` | ⬜ Testar |

---

### Etapa 6 — Registrar pesagem

| Item | Esperado | Verificado |
|------|----------|-----------|
| Navegar para `/pesagens` ou pesagens do lote | Formulário de pesagem | ⬜ Testar |
| Registrar peso inicial | Dados salvos em `pesagens` | ⬜ Testar |
| GMD exibido como N/A (apenas 1 pesagem) | Correto — precisa de 2 pontos para calcular GMD | ⬜ Testar |
| Segunda pesagem após alguns dias | GMD calculado | ⬜ Testar |

---

### Etapa 7 — Registrar movimento financeiro (custo)

| Item | Esperado | Verificado |
|------|----------|-----------|
| Acessar `/financeiro` ou registrar custo no lote | Formulário de movimentação | ⬜ Testar |
| Registrar custo (ex: compra de ração) | Salvo em `movimentacoes_financeiras` | ⬜ Testar |
| `owner_user_id` preenchido | Policy garante | ✅ `movimentacoes_financeiras_insert_owner` |
| Custo aparece no extrato financeiro | SELECT funciona | ⬜ Testar |

---

### Etapa 8 — Registrar venda (receita)

| Item | Esperado | Verificado |
|------|----------|-----------|
| Registrar venda de animais | Movimento do tipo receita | ⬜ Testar |
| `getResumoLote` reflete a receita | `resumo.receitaTotal` atualizado | ✅ Verificado via code review (Sprint 3) |
| Margem calculada | `resumo.lucroTotal = receitaTotal - custoTotal` | ✅ Verificado via code review |

---

### Etapa 9 — Verificar relatório do lote

| Item | Esperado | Verificado |
|------|----------|-----------|
| Acessar relatórios | RelatorioLote carrega | ⬜ Testar |
| Receita e margem exibidas | Via `getResumoLote` | ✅ Verificado — `RelatorioLote.jsx` usa `getResumoLote` exclusivamente |
| GMD e total de animais | Via `resumo.totalAnimais`, `resumo.gmdMedio` | ✅ Verificado |

---

### Etapa 10 — Comparativo de lotes

| Item | Esperado | Verificado |
|------|----------|-----------|
| Acessar `/comparativo` | ComparativoPage carrega | ⬜ Testar |
| Dois ou mais lotes mostrados | Dados financeiros via `getResumoLote` | ✅ Verificado — `ComparativoPage` usa `getResumoLote` |

---

### Etapa 11 — Verificar página de resultados

| Item | Esperado | Verificado |
|------|----------|-----------|
| Acessar `/resultados` | ResultadosPage carrega | ⬜ Testar |
| Dados financeiros corretos | `getResumoLote` para financeiro | ✅ |
| Dados produtivos | `calcLote` para GMD, peso vivo | ✅ (usa ambos — D-001 parcialmente resolvido) |

---

### Etapa 12 — Fluxo de assinatura

| Item | Esperado | Verificado |
|------|----------|-----------|
| Acessar `/minha-assinatura` | MinhaAssinaturaPage carrega | ⬜ Testar |
| Planos exibidos corretamente | Fundador, Essencial, Pro, Premium | ⬜ Testar |
| Clicar em "Assinar" | Redireciona para fluxo de pagamento | ⬜ Testar |
| POST `/api/asaas-create-customer` | 200 com customerId | ⬜ Testar em sandbox |
| POST `/api/asaas-create-subscription` | 200 com checkoutUrl | ⬜ Testar em sandbox |
| Pagar via checkout Asaas (sandbox) | Webhook recebido | ⬜ Testar |
| `customer_subscriptions.status = 'active'` | Atualizado após webhook | ⬜ Testar |

---

### Etapa 13 — Logout e re-login

| Item | Esperado | Verificado |
|------|----------|-----------|
| Logout | Sessão encerrada, redirect para login | ⬜ Testar |
| Re-login | Dados persistem | ⬜ Testar |

---

## Critério de aceite do Golden Path

| Status | Definição |
|--------|-----------|
| ✅ Go | Etapas 1-11 funcionam sem bloqueio crítico |
| 🟡 Go condicional | Etapas 1-9 funcionam; assinatura (10-12) com problema não-crítico |
| 🔴 No-go | Qualquer etapa 1-8 com bloqueio crítico |

---

## Etapas verificadas vs pendentes

| Verificadas via código/SQL | Pendentes (requer browser manual) |
|---------------------------|----------------------------------|
| Trigger de criação de perfil ✅ | Login/cadastro end-to-end |
| RLS de fazendas/lotes ✅ | Criação de fazenda |
| getResumoLote → RelatorioLote ✅ | Criação de lote e animais |
| ComparativoPage → getResumoLote ✅ | Registro de pesagem e GMD |
| Asaas server-side auth ✅ | Fluxo de pagamento sandbox |
| Dados de movimentações financeiras isolados ✅ | Checkout e webhook |

**Nota:** O bugde `app_can_manage_account` (case mismatch) **não impacta** o Golden Path do proprietário solitário. Ele afeta apenas convite de funcionários (Etapa 6 do `ROLE_QA_HERDON.md`).
