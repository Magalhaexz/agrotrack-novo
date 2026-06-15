# Vercel Preview — Estado Pré-Produção

> Sprint 4 · Etapa 8 · Gerado em 2026-06-15  
> Projeto Vercel: `agrotrack-novo` (prj_EvRR500wRpUFblz2tRRrXeqhhuto)  
> Team: `magalhaexzs-projects` (team_vVaTXEv1SAtdX8i4zqAzfVVC)

---

## Estado atual do deploy

| Item | Valor |
|------|-------|
| Último deploy (produção) | `dpl_G4rpYn1hQZVE7ZHD9hdq2tVd879v` |
| Estado | ✅ READY |
| Commit | `728f9f3` — merge PR #111 (Sprint 3) |
| Branch | `main` |
| URL de produção | `agrotrack-novo.vercel.app` |
| URL de preview (deploy) | `agrotrack-novo-nvgcl63xg-magalhaexzs-projects.vercel.app` |
| Framework | Vite |
| Node.js | 24.x |
| Serverless functions | 5 (`api/*.js`) |
| `live: false` | ⚠️ Nenhum domínio customizado configurado |

---

## Domínios disponíveis

| Domínio | Tipo |
|---------|------|
| `agrotrack-novo.vercel.app` | Produção (alias principal) |
| `agrotrack-novo-magalhaexzs-projects.vercel.app` | Produção (alias de team) |
| `agrotrack-novo-git-main-magalhaexzs-projects.vercel.app` | Branch alias (main) |

Nenhum domínio customizado (`herdon.com.br` ou similar) configurado ainda.

---

## `vercel.json` — Ausente

O arquivo `vercel.json` **não existe no repositório**. Impactos:

| Impacto | Detalhe | Risco |
|---------|---------|-------|
| Sem headers de segurança | CSP, HSTS, X-Frame-Options não configurados | 🔴 Alto |
| Sem redirects configurados | HTTP → HTTPS depende do Vercel default | 🟡 Médio |
| Sem rewrites de SPA | Navegação direta para `/rota` pode resultar em 404 | 🟡 Médio |
| Sem configuração de funções | Timeout, regiões, etc. no default | 🔵 Baixo |

### Rewrite de SPA

O app é SPA (Single Page Application). Sem `vercel.json`, acessar diretamente `https://agrotrack-novo.vercel.app/fazendas` pode retornar 404 em vez de carregar o app. O Vite com o framework Vercel normalmente lida com isso automaticamente, mas **precisa ser verificado manualmente**.

### Headers de segurança recomendados (futuro `vercel.json`)

```json
{
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        { "key": "X-Content-Type-Options", "value": "nosniff" },
        { "key": "X-Frame-Options", "value": "DENY" },
        { "key": "X-XSS-Protection", "value": "1; mode=block" },
        { "key": "Referrer-Policy", "value": "strict-origin-when-cross-origin" },
        { "key": "Strict-Transport-Security", "value": "max-age=31536000; includeSubDomains" }
      ]
    }
  ]
}
```

---

## Histórico de deploys (últimos 20)

Todos com estado `READY`. Últimos 5 relevantes:

| Commit | Mensagem | Branch | Target |
|--------|----------|--------|--------|
| `728f9f3` | merge: financial unification and doc organization (PR #111) | main | production |
| `83b026c` | chore: stop tracking local env file | main | production |
| `5948724` | style: fix tablet sidebar and login scroll | main | production |
| `74d9773` | style: fix sidebar and cadastro layout | main | production |
| `fc6b3ae` | fix: validate final Asaas checkout flow | main | production |

Deploy automático de `main` → produção configurado via GitHub. ✅

---

## Variáveis de ambiente na Vercel — O que verificar

As variáveis precisam estar configuradas no painel Vercel (`Settings → Environment Variables`).  
**Não é possível verificar os valores via MCP por segurança** — verificação manual obrigatória.

| Variável | Escopo | Ambiente | Verificar no painel |
|----------|--------|---------|-------------------|
| `VITE_SUPABASE_URL` | Client | All | ✅ Deve estar presente |
| `VITE_SUPABASE_ANON_KEY` | Client | All | ✅ Deve estar presente |
| `VITE_APP_URL` | Client | Production | ⚠️ Atualizar para domínio definitivo |
| `VITE_CHECKOUT_URL` | Client | Production | ⚠️ Atualizar para domínio definitivo |
| `SUPABASE_URL` | Server | All | ✅ Deve estar presente |
| `SUPABASE_SERVICE_ROLE_KEY` | Server | All | ✅ Verificar se está na categoria "Sensitive" |
| `ASAAS_API_BASE_URL` | Server | Production | 🔴 Trocar para produção antes de go-live |
| `ASAAS_API_KEY` | Server | Production | 🔴 Trocar para chave de produção |
| `ASAAS_WEBHOOK_TOKEN` | Server | Production | 🔴 Configurar token de produção |
| `ASAAS_ENV` | Server | Production | 🔴 Definir como `production` |

---

## Checklist Vercel pré-produção

```
[ ] 1. Configurar domínio customizado (ex: herdon.com.br) em Settings → Domains
[ ] 2. Certificar que HTTPS está ativo (Vercel gerencia automaticamente)
[ ] 3. Verificar redirect HTTP → HTTPS
[ ] 4. Criar vercel.json com headers de segurança mínimos
[ ] 5. Testar rota direta (/fazendas) — confirmar que SPA não retorna 404
[ ] 6. Atualizar VITE_APP_URL para o domínio de produção
[ ] 7. Atualizar VITE_CHECKOUT_URL para o domínio de produção
[ ] 8. Trocar todas as variáveis ASAAS_* para produção
[ ] 9. Atualizar redirect URLs no Supabase (Auth → URL Configuration)
[ ] 10. Confirmar que serverless functions respondem corretamente em produção
```

---

## CORS

As serverless functions em `api/` não têm configuração explícita de CORS além do que o Vercel adiciona por padrão. Se o domínio de produção for diferente do atual, verificar se as funções aceitam requests do novo domínio.

---

## Nota sobre `live: false`

O campo `live: false` na API Vercel indica que o projeto não tem uma "live" URL (domínio customizado ativo com certificado SSL válido). Isso é esperado neste estágio — o app funciona via `.vercel.app`. A configuração do domínio customizado faz isso mudar para `live: true`.
