# HERDON / AgroTrack

Aplicação web de gestão pecuária (rebanho de corte): fazendas, lotes, animais,
pesagens, sanitário, estoque, nutrição/suplementação, financeiro, relatórios e
indicadores. Front-end em React + Vite, com sincronização opcional na nuvem via
Supabase e cobrança por assinatura via Asaas.

## Stack

- **Front-end:** React 19 + Vite
- **Nuvem/auth/dados:** Supabase (`@supabase/supabase-js`)
- **Cobrança:** Asaas (funções serverless em `api/`)
- **Gráficos/ícones:** shims locais (`src/recharts.jsx`, `src/lucide-react.js`)
- **Testes:** runner nativo do Node (`node:test`) + Playwright (E2E)

## Pré-requisitos

- Node.js 20+
- Conta Supabase (para a sincronização na nuvem) e, opcionalmente, conta Asaas

## Configuração

Copie `.env.example` para `.env.local` e preencha:

```bash
cp .env.example .env.local
```

| Variável | Onde | Descrição |
| --- | --- | --- |
| `VITE_SUPABASE_URL` | cliente | URL do projeto Supabase |
| `VITE_SUPABASE_ANON_KEY` | cliente | chave pública (anon) do Supabase |
| `VITE_APP_URL` | cliente | URL pública do app (redirect de OAuth/e-mail) |
| `VITE_CHECKOUT_URL` | cliente | URL da página de assinatura |
| `ASAAS_API_BASE_URL` / `ASAAS_API_KEY` | **servidor** | API do Asaas (nunca expor no cliente) |
| `ASAAS_WEBHOOK_TOKEN` | **servidor** | token do webhook do Asaas |
| `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` | **servidor** | usados pelas funções em `api/` |

> As variáveis sem prefixo `VITE_` são de **servidor** e não devem ir para o
> bundle do cliente. O SQL de provisionamento do Supabase (schema + RLS) está em
> [`docs/`](docs/).

## Scripts

```bash
npm install        # instala dependências
npm run dev        # servidor de desenvolvimento (Vite)
npm run build      # build de produção
npm run preview    # serve o build
npm run lint       # ESLint
npm test           # testes unitários/domínio (node:test)
npm run e2e        # testes end-to-end (Playwright)
```

## Estrutura

```
api/            Funções serverless (Asaas + ponte de sincronização da nuvem)
src/
  auth/         Contexto de autenticação, perfis e permissões
  components/   Componentes de UI (inclui ui/ primitivos e por domínio)
  domain/       Regras de negócio puras e testáveis (cálculos de lote, arroba, GMD…)
  hooks/        Hooks (dados operacionais, nuvem, permissões, toast)
  lib/          Cliente Supabase e helpers de sessão
  pages/        Páginas/telas
  services/     Persistência, sincronização, billing, auditoria
  styles/       CSS por área + tokens de design
  utils/        Formatadores, exportadores e helpers
docs/           SQL do Supabase, guias e histórico de sprints (docs/sprints/)
tests/          Testes unitários/domínio
e2e/            Testes Playwright
```

### Fonte financeira oficial

Para custo/receita/lucro/margem **realizados** de um lote, use sempre
`getResumoLote` (`src/domain/resumoLote.js`), que deriva os valores das
movimentações financeiras reais. `calcLote` (`src/utils/calculations.js`)
fornece métricas produtivas e apenas uma **projeção** (`receitaProjetada` /
`margemProjetada`) — não é a fonte oficial.
