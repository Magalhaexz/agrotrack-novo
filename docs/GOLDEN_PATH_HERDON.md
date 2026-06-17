# Golden Path — HERDON

**Sprint 15 · Etapa 2**
**Atualizado em:** 2026-06-17 (substituiu versão Sprint 4)
**Observação:** Documentado a partir do código-fonte. Verificação visual em browser nas Etapas 3 e 4 do Sprint 15.

---

## Fluxo completo: do zero ao primeiro resultado

### Passo 1 — Acessar a URL do app

Abre `https://agrotrack-novo.vercel.app` (ou domínio customizado, se configurado).

**Resultado esperado:** Tela de login com logo HERDON, campos email e senha, link "Criar conta" e links legais no rodapé.

---

### Passo 2 — Criar uma conta

Clica em "Criar conta". Preenche:
- Nome / e-mail / senha (mínimo 8 chars, letra maiúscula, número, símbolo = Forte)
- Indicador de força de senha exibido em tempo real

Clica em "Cadastrar".

**Resultado esperado:** Conta criada no Supabase Auth. Dependendo da configuração do projeto Supabase, pode exigir confirmação de e-mail. Se `email_confirm = false`, entra direto.

---

### Passo 3 — Fazer login

Preenche e-mail e senha. Clica em "Entrar".

**Resultado esperado:** Redireciona para `/` (Painel Geral). Menu lateral visível (Desktop) ou bottom nav (Mobile).

**Edge case:** Até 3 tentativas automáticas com backoff em caso de erro transitório (falha de rede).

---

### Passo 4 — Painel Geral vazio

Usuário vê o Dashboard com estado vazio:
- KPIs zerados (Cabeças, Valor em Estoque, Pendências, Resultado)
- Seção de alertas vazia
- Botões de ação rápida "Novo Lote", "Registrar Pesagem", "Novo Custo"

**Resultado esperado:** Painel carregado sem erro. Seção de alertas mostra "Nenhum alerta ativo".

---

### Passo 5 — Criar Fazenda

Navega para "Fazendas" (ícone MapPin no menu). Clica em "+ Nova Fazenda".

Modal `FazendaModal` abre. Preenche:
- Nome da fazenda
- Cidade / Estado
- Área (hectares) — opcional

Clica em "Salvar".

**Resultado esperado:** Card da fazenda aparece na lista. Dado persistido no Supabase (`fazendas` table).

---

### Passo 6 — Criar Lote

Navega para "Lotes e Rebanho". Clica em "+ Novo Lote".

`LoteForm` abre. Preenche:
- Nome do lote
- Fazenda selecionada (dropdown com fazenda criada no Passo 5)
- Tipo de criação (confinamento / pasto / semi-confinamento)
- Data de entrada
- Quantidade de animais
- Peso médio inicial

Clica em "Salvar".

**Resultado esperado:** LoteCard aparece na lista. Dashboard começa a mostrar "Cabeças ativas > 0".

---

### Passo 7 — Registrar entrada de animais

No card do lote criado, clica em "Ver detalhes" → aba "Overview".

Registra movimentação de entrada:
- Tipo: Entrada
- Quantidade de animais
- Preço por arroba / por animal

**Resultado esperado:** Movimentação de animais salva em `movimentacoes_animais`. Lote com animais computados.

---

### Passo 8 — Registrar Pesagem

Navega para "Pesagens". Clica em "+ Nova Pesagem".

Preenche:
- Lote selecionado
- Data da pesagem
- Peso médio (kg)
- Número de animais pesados

Clica em "Salvar".

**Resultado esperado:** Pesagem salva em `pesagens`. GMD (Ganho Médio Diário) começa a ser calculado. Alerta de "pesagem pendente" some do painel.

---

### Passo 9 — Registrar Despesa Financeira

Navega para "Movimentações Financeiras". Clica em "+ Novo Lançamento".

Preenche:
- Tipo: Despesa
- Categoria (ex: Alimentação, Veterinário)
- Valor
- Data de vencimento
- Lote associado
- Status: Previsto / Realizado / Pago

Clica em "Salvar Lançamento".

**Resultado esperado:** Movimentação salva em `movimentacoes_financeiras`. Se vencida e não paga, alerta financeiro aparece no Dashboard.

---

### Passo 10 — Verificar alertas no Painel

Volta para Painel Geral (Dashboard). Clica na aba "Alertas" (ou verifica seção de alertas).

**Resultado esperado:** `buildAlerts(db)` exibe:
- Alertas críticos (vermelho) no topo
- Alertas de atenção (amarelo) abaixo
- Cada alerta com botão "Ir para" e opção de resolver/adiar

---

### Passo 11 — Ver Resultado do Lote

Navega para "Resultado dos Lotes". Seleciona o lote criado.

**Resultado esperado:** `getResumoLote()` calcula:
- Custo total (animais + despesas)
- Receita estimada (peso × preço @ arroba)
- Resultado projetado (lucro/prejuízo)
- GMD, @/cab, custo por @ produzida

---

### Passo 12 — Simular Cenário de Venda

Navega para "Simulador de Decisão". Seleciona o lote. Ajusta:
- Preço de venda por arroba
- Data alvo de saída
- Peso final estimado

**Resultado esperado:** Projeção de resultado exibida com comparativo entre vender agora vs. na data alvo.

---

### Passo 13 — Verificar Fluxo de Caixa

Navega para "Fluxo de Caixa".

**Resultado esperado:** KPIs mostram receitas, despesas e saldo. Gráfico ou tabela com timeline de vencimentos. Alertas de vencimentos próximos.

---

### Passo 14 — Verificar Assinatura

Navega para "Planos e Assinatura". Verifica plano ativo.

Se usuário free: pode testar funcionalidades do plano gratuito. Botão "Assinar Plano" inicia fluxo Asaas.

**Resultado esperado:** Status da assinatura exibido. Links para Termos e Política de Cobrança visíveis.

---

## Resumo do Golden Path

| Passo | Tela | Ação | Dado persistido |
|-------|------|------|-----------------|
| 1 | URL | Acessar app | — |
| 2 | Login | Criar conta | `auth.users` |
| 3 | Login | Fazer login | `auth.sessions` |
| 4 | Dashboard | Ver painel vazio | — |
| 5 | Fazendas | Criar fazenda | `fazendas` |
| 6 | Lotes | Criar lote | `lotes` |
| 7 | Lotes (detalhe) | Entrada de animais | `movimentacoes_animais` |
| 8 | Pesagens | Registrar pesagem | `pesagens` |
| 9 | Financeiro | Registrar despesa | `movimentacoes_financeiras` |
| 10 | Dashboard | Verificar alertas | `alertas_resolvidos` (se resolver) |
| 11 | Resultados | Ver resultado do lote | — (calculado) |
| 12 | Simulador | Simular cenário | `cenarios` (se salvar) |
| 13 | Fluxo de Caixa | Ver cashflow | — (calculado) |
| 14 | Assinatura | Verificar plano | `customer_subscriptions` |

---

## Status

| Item | Status |
|------|--------|
| Fluxo documentado a partir do código | ✅ |
| Verificação visual em browser | ⚠️ Pendente (Etapas 3 e 4 do Sprint 15) |
| Teste de ponta a ponta em staging | ⚠️ Pendente antes do go-live |
