# Arquitetura Técnica — HERDON

> Documento vivo. Atualizar quando a stack ou estrutura mudar.  
> Última atualização: 2026-06-15

---

## Stack

| Camada | Tecnologia | Versão |
|--------|-----------|--------|
| UI | React | 19.2.4 |
| Bundler | Vite | 8.0.4 |
| Banco / Auth / Storage | Supabase | 2.103.3 |
| Animações | Framer Motion | 12.38 |
| Ícones | Lucide React | 1.8 |
| Gráficos | Recharts (via `src/recharts.jsx`) | — |
| Billing | Asaas | REST API |
| Runtime | Node.js | ≥ 18 |
| Linter | ESLint | 9.39.4 |

---

## Estrutura de pastas

```
src/
├── App.jsx                    # Roteador principal, estado global, lazy load das 26 páginas
├── main.jsx                   # Entry point — monta React no #root
├── recharts.jsx               # Re-export do Recharts (lazy load único)
│
├── auth/
│   ├── AuthContext.jsx        # Context de autenticação com geração, cache e fallback
│   └── perfis.js             # 4 roles + permissões granulares por string
│
├── components/               # Componentes compartilhados
│   ├── ui/                   # Primitivos: Button, Card, Input, Modal, Table, Badge, UserAvatar
│   ├── comparativo/          # Componentes da página de comparativo de lotes
│   ├── fazendas/             # FazendaCard, FazendaModal
│   ├── funcionarios/         # FuncionarioModal, FuncionarioRow
│   ├── lotes/                # LoteCard (novo), LoteDetailsPanel, abas do lote
│   ├── relatorios/           # RelatorioLote, RelatorioEstoque, RelatorioSanitario, RelatorioVendas
│   └── subscription/         # SubscriptionSummary
│
├── pages/                    # 26 páginas lazy-loaded
│
├── services/                 # Chamadas ao Supabase e lógica de negócio
│   ├── subscriptions.js      # Planos, tiers, canAccessModule()
│   ├── userAccess.js         # Bootstrap admin, cache de perfil, isBootstrapOwner
│   └── operationalPersistence.js  # Sync queue, cloud events
│
├── domain/                   # Lógica de domínio pura (sem efeitos colaterais)
│   └── resumoLote.js         # getResumoLote() — FONTE OFICIAL de resultado financeiro
│
├── utils/                    # Utilitários e helpers
│   ├── calculations.js       # calcLote() — métricas zootécnicas + projeções financeiras
│   ├── alerts.js             # buildAlerts() — sistema legado de alertas
│   └── ...
│
├── hooks/                    # React hooks customizados
│   └── useOperationalData.js # Hook principal de dados + sync queue
│
└── data/
    └── mockData.js           # createEmptyOperationalDb() — compat legada
```

---

## Fluxo de dados

```
Usuário
  │
  ▼
Componente / Página
  │ props / callbacks
  ▼
Handler (no componente pai ou hook)
  │ await onRegistrarXxx()
  ▼
Service (src/services/)
  │ supabase.from('tabela').insert/update/delete
  ▼
Supabase (PostgreSQL + RLS)
  │ retorno
  ▼
State local (useState / useOperationalData)
  │
  ▼
Re-render do componente
```

**Anti-padrão a evitar:** componente → `setDb()` direto (bypass do service). Exemplo problemático: `SaidaEstoqueModal.jsx`.

---

## Sistema de autenticação

### Fluxo de login

```
LoginPage
  │ supabase.auth.signInWithPassword()
  ▼
AuthContext.jsx
  ├─ Carrega perfil de public.profiles (com cache localStorage 'HERDON_PROFILE_CACHE::uid')
  ├─ Fallback: monta perfil do raw_user_meta_data se DB falhar
  ├─ Cooldown de 2 min após falha de fetch de perfil
  └─ Geração (incrementa ao detectar sessão stale)
```

### Roles

| Role | Permissões |
|------|-----------|
| `proprietario` | Tudo (`['*']`) |
| `gerente` | CRUD operacional + leitura financeira |
| `operador` | CRUD operacional básico |
| `visualizador` | Só leitura |

Permissões granulares definidas em `src/auth/perfis.js` como strings (ex: `'lotes:criar'`, `'financeiro:ver'`).

### Trigger de criação de perfil

Ao criar um usuário no Supabase Auth, o trigger `handle_new_user_profile` insere automaticamente um registro em `public.profiles` com `perfil = 'PROPRIETARIO'` e `owner_user_id = auth.uid()`.

> ⚠️ Existe um segundo trigger `handle_new_user` com comportamento similar mas que hardcoda `PROPRIETARIO`. Ver issue `[BUG-003]`.

---

## Sistema de assinaturas

### Planos

| Plano | Preço | Código |
|-------|-------|--------|
| Fundador | R$ 297 | `fundador` |
| Essencial | R$ 197 | `essencial` |
| Pro | R$ 397 | `pro` |
| Premium | R$ 697 | `premium` |
| Enterprise | Sob consulta | `enterprise` |

### Gating de módulos

```js
// src/services/subscriptions.js
canAccessModule(subscription, 'financeiro') // → boolean
```

Gating aplicado em `App.jsx` via `<RotaProtegida>` e na renderização de menu itens.

### Integração Asaas

- API REST do Asaas para checkout e gestão de assinatura
- Sandbox testado e funcional
- Eventos de billing registrados em `public.billing_events`
- Sessões de checkout em `public.checkout_sessions`
- Estado da assinatura em `public.customer_subscriptions`

---

## Banco de dados (Supabase)

### Tabelas (30 total, todas com RLS)

**Operacional:**
`fazendas` · `lotes` · `animais` · `pesagens` · `movimentacoes_animais` · `rotinas` · `tarefas` · `configuracoes`

**Financeiro:**
`movimentacoes_financeiras` · `custos` · `billing_events` · `checkout_sessions` · `customer_subscriptions`

**Estoque e insumos:**
`estoque` · `movimentacoes_estoque` · `suplementacao` · `consumo_suplementacao`

**Sanitário:**
`sanitario`

**Premium:**
`pastagens` · `cenarios` · `cenario_eventos` · `funcionarios` · `usuarios`

**Sistema:**
`profiles` · `invites` · `auditoria` · `eventos_operacionais` · `alertas_adiados` · `alertas_resolvidos` · `subscription_plans`

### Modelo multi-tenant

Todos os registros têm `owner_user_id` referenciando o `auth.uid()` do proprietário da conta.

Membros de equipe têm `owner_user_id` = uid do proprietário da conta deles (definido no `profiles`).

```sql
-- Função helper para isolamento entre contas:
app_is_same_account(target_owner_user_id)
-- = auth.uid() IS NOT NULL
--   AND target_owner_user_id IS NOT NULL  
--   AND app_current_owner_user_id() = target_owner_user_id
```

---

## Cálculo financeiro

Dois módulos com responsabilidades distintas:

| Módulo | Arquivo | Responsabilidade |
|--------|---------|-----------------|
| `calcLote` | `src/utils/calculations.js` | Métricas **zootécnicas** (GMD, peso, arroba) + **projeções** financeiras (`receitaProjetada`, `margemProjetada`) |
| `getResumoLote` | `src/domain/resumoLote.js` | Resultado financeiro **realizado** (usa `movimentacoes_financeiras`) |

> **Regra:** para exibir resultado financeiro ao usuário, usar sempre `getResumoLote`. `calcLote` é para indicadores zootécnicos.

---

## Sistema de alertas

Dois sistemas coexistem (débito técnico):

1. **Legado:** `buildAlerts()` em `src/utils/alerts.js` — lida com dados em memória
2. **Novo:** funções de domínio — `gerarAlertasEstoque`, `gerarAlertasCalendario`, `gerarAlertasPesagem`, `gerarAlertasLote`

Ambos são consumidos em `App.jsx`. Estado de alerta (adiado/resolvido) é persistido em `public.alertas_adiados` e `public.alertas_resolvidos`.

---

## Build e CI

```bash
npm run dev      # Vite dev server (0.0.0.0)
npm run build    # Vite build (configLoader native) — PASS
npm run lint     # ESLint 9 — FAIL (débito técnico)
npm run test     # node scripts/run-node-tests.mjs
npm run e2e      # node scripts/run-e2e.mjs
```

> O lint está quebrado por erros de parse e warnings de React Hooks. Não bloqueia produção hoje, mas deve ser resolvido antes de qualquer release.
