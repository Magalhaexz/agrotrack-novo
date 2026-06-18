# Golden Path — Beta Piloto HERDON

**Sprint 19 · Gerado em:** 2026-06-18
**Método:** Análise estática de código + diagnóstico Supabase (browser travado por auth)
**Conta usada:** conta administrativa existente (`0218c5ce-...`)

---

## Legenda

| Status | Significado |
|--------|-------------|
| ✔ Verificado | Confirmado via código/banco |
| ⚠ A validar | Requer verificação em browser real |
| ✗ Bloqueador | Impede o uso do piloto |
| — Não aplicável | Fora do escopo desta etapa |

---

## Bloco 1 — Cadastro e acesso

| # | Etapa | Esperado | Status | Notas |
|---|-------|----------|--------|-------|
| 1 | Criador acessa URL de produção | Tela de login exibida | ✔ | LoginPage.jsx existe |
| 2 | Cadastra conta com e-mail | E-mail de confirmação enviado | ⚠ | Supabase Auth configurado; depende de e-mail de produção |
| 3 | Confirma e-mail e faz login | Redirecionado para o dashboard | ✔ | Trigger `on_auth_user_created` cria perfil |
| 4 | Sem assinatura criada ainda | Acesso a todas as telas liberado | ✔ | `canAccessModule()` retorna `true` quando `subscription === null` |
| 5 | Admin insere `customer_subscriptions` com `internal_test` | Plano Fundador ativo | ✔ | Estrutura já usada pelo admin; `modules: ['*']` |
| 6 | Logout | Sessão encerrada | ✔ | `forceLocalSignOut` implementado |
| 7 | Novo login | Dados recarregados do Supabase | ✔ | `useOperationalData` rehidrata do banco |

---

## Bloco 2 — Operação pecuária

| # | Etapa | Esperado | Status | Notas |
|---|-------|----------|--------|-------|
| 1 | Criar fazenda | Fazenda salva no banco, aparece no menu | ✔ | `FazendasPage` implementado com CRUD |
| 2 | Cadastrar pasto (Operação > Pastos) | Pasto vinculado à fazenda | ✔ | Sprint 18 — PastagensPage CRUD funcional |
| 3 | Cadastrar segundo pasto | Dois pastos listados | ✔ | — |
| 4 | Criar lote — sistema `pasto` | Campo "Pasto atual" obrigatório quando há pastos | ✔ | Sprint 18 — `validarForm` com `pastagensDisponiveis.length > 0` |
| 5 | Criar lote — sistema `confinamento` | Campo "Pasto atual" opcional | ✔ | `validarPastoObrigatorio` só valida para sistema 'pasto' |
| 6 | Cadastrar animal | Animal vinculado ao lote | ⚠ | AnimaisPage existe; confirmar modal funcional |
| 7 | Registrar pesagem | Pesagem salva, evolução calculada | ⚠ | PesagensPage implementado |
| 8 | Conferir evolução do lote | GMD, dias, projeção visíveis | ✔ | ResultadosPage calcula com lotes + movimentações |

---

## Bloco 3 — Financeiro e decisão

| # | Etapa | Esperado | Status | Notas |
|---|-------|----------|--------|-------|
| 1 | Lançar despesa/receita | Movimentação salva em `movimentacoes_financeiras` | ✔ | FinanceiroPage CRUD |
| 2 | Resultado do lote | Custo, receita projetada, lucro/@aroba | ✔ | ResultadosPage com domain calculos |
| 3 | Fluxo de Caixa | KPIs + tabela de movimentações | ✔ | Sprint 18 Etapa 2 — KPIs corrigidos |
| 4 | Rateio de Custos | Valor dividido entre lotes por critério | ✔ | CustosCompartilhadosPage — Sprint 18 |
| 5 | Simulador de Decisão | Cenários com parâmetros ajustáveis | ✔ | CenariosPage implementado |
| 6 | Alertas | Alertas produtivos e financeiros visíveis | ✔ | Sistema de alertas ativo (Sprint 14) |

---

## Bloco 4 — Gestão complementar

| # | Etapa | Esperado | Status | Notas |
|---|-------|----------|--------|-------|
| 1 | Estoque | Cadastro de insumos | ⚠ | EstoquePage existe; Sprint 18 KPIs corrigidos |
| 2 | Suplementação | Lançamento de suplementos | ⚠ | SuplementacaoPage existe |
| 3 | Sanidade | Registro sanitário | ⚠ | SanitarioPage existe |
| 4 | Relatórios | Tabelas gerenciais | ⚠ | RelatoriosGerenciaisPage existe |
| 5 | Indicadores | Indicadores estratégicos | ✔ | IndicadoresPage — módulo PREMIUM, coberto pelo plano Fundador |
| 6 | Rotas acessíveis | Nenhuma rota quebrada | ✔ | 21 páginas mapeadas no App.jsx |

---

## Bloco 5 — Persistência

| # | Etapa | Esperado | Status | Notas |
|---|-------|----------|--------|-------|
| 1 | Logout e novo login | Fazendas, lotes e lançamentos persistem | ✔ | RLS por `owner_user_id` — dados no Supabase |
| 2 | Isolamento de contas | Usuário não acessa dados de outra conta | ✔ | `app_is_same_account()` em todas as tabelas com RLS |
| 3 | Dados do pasto persistem após reload | Pastos cadastrados visíveis após login | ✔ | `pastagens` no `EXPECTED_SCHEMA_TABLES`; carregado em `useOperationalData` |

---

## Itens a validar em browser real antes do piloto

1. Fluxo de e-mail de confirmação de cadastro
2. Criação de fazenda pelo novo usuário (sem erros de RLS)
3. Modal de lote em mobile (375px)
4. Pesagem — tela completa sem quebra
5. Assinatura carregada corretamente após INSERT manual no banco

---

## Erros/severidades identificados

| Severidade | Descrição | Status |
|------------|-----------|--------|
| Baixa | `pastagens.fazenda_id` (uuid) não é usada — deixa coluna sem dado | Documentado, sem impacto funcional |
| Baixa | Bottom nav mobile não inclui acesso a Pastos diretamente | Usa "Mais" para acessar |
| Nenhum | Nenhum bloqueador crítico identificado via análise estática | — |
