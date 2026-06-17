# VERCEL_GO_LIVE_HERDON

Sprint 5 — Etapa 3  
Data: 2026-06-15  
Status: CONFIGURADO (aguardando deploy)

---

## Estado do projeto Vercel

| Campo | Valor |
|-------|-------|
| Project ID | `prj_EvRR500wRpUFblz2tRRrXeqhhuto` |
| Team | `team_vVaTXEv1SAtdX8i4zqAzfVVC` |
| Framework | Vite |
| Node.js | 24.x |
| Último deploy | `728f9f3` — status READY |
| Domínio custom | Nenhum (somente `.vercel.app`) |
| `live` | `false` |
| `vercel.json` antes desta sprint | Ausente |

---

## O que foi criado

### `vercel.json` (raiz do repositório)

```json
{
  "rewrites": [
    { "source": "/((?!api/).*)", "destination": "/index.html" }
  ],
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        { "key": "X-Content-Type-Options", "value": "nosniff" },
        { "key": "X-Frame-Options", "value": "DENY" },
        { "key": "X-XSS-Protection", "value": "1; mode=block" },
        { "key": "Referrer-Policy", "value": "strict-origin-when-cross-origin" },
        { "key": "Strict-Transport-Security", "value": "max-age=31536000; includeSubDomains" },
        { "key": "Permissions-Policy", "value": "camera=(), microphone=(), geolocation=()" }
      ]
    }
  ]
}
```

---

## Por que cada configuração

### Rewrite SPA

```
"source": "/((?!api/).*)"
"destination": "/index.html"
```

O HERDON usa roteamento SPA customizado (`window.history.pushState`). Sem esse rewrite, URLs diretas como `/termos-de-uso` retornariam 404 no Vercel. O padrão `(?!api/)` exclui as funções serverless em `api/` do rewrite para que continuem funcionando normalmente.

### Headers de segurança

| Header | Valor | Proteção |
|--------|-------|----------|
| `X-Content-Type-Options: nosniff` | Bloqueia MIME sniffing | Previne ataques de tipo de conteúdo |
| `X-Frame-Options: DENY` | Bloqueia iframes | Previne clickjacking |
| `X-XSS-Protection: 1; mode=block` | Ativa filtro XSS nativo do browser | Defesa adicional em browsers legados |
| `Referrer-Policy: strict-origin-when-cross-origin` | Limita informação de referrer | Reduz vazamento de URL entre domínios |
| `Strict-Transport-Security: max-age=31536000; includeSubDomains` | Força HTTPS por 1 ano | Previne downgrade para HTTP |
| `Permissions-Policy: camera=(), microphone=(), geolocation=()` | Nega acesso a hardware sensível | Defesa em profundidade |

---

## Checklist para deploy em produção

### Variáveis de ambiente a configurar no Vercel

Verificar em: Settings → Environment Variables → Production

**Frontend (VITE_)**

| Variável | Obrigatória | Observação |
|----------|-------------|------------|
| `VITE_SUPABASE_URL` | Sim | URL do projeto Supabase |
| `VITE_SUPABASE_ANON_KEY` | Sim | Chave pública (safe no frontend) |
| `VITE_APP_URL` | Sim | URL do app em produção (ex: `https://herdon.vercel.app`) |
| `VITE_CHECKOUT_URL` | Sim | URL do link de checkout Asaas |
| `VITE_HERDON_BOOTSTRAP_ADMIN_EMAILS` | Opcional | Emails admin separados por vírgula |

**Serverless (sem VITE_)**

| Variável | Obrigatória | Observação |
|----------|-------------|------------|
| `SUPABASE_URL` | Sim | Mesmo valor que `VITE_SUPABASE_URL` |
| `SUPABASE_SERVICE_ROLE_KEY` | Sim | Chave de serviço — NUNCA expor no frontend |
| `ASAAS_API_KEY` | Sim | Chave Asaas (produção: prefixo `$aas_prod_`) |
| `ASAAS_API_BASE_URL` | Sim | `https://api.asaas.com` (produção) |
| `ASAAS_WEBHOOK_TOKEN` | Sim | Token de validação dos webhooks |
| `ASAAS_ENV` | Sim | `production` |

### Ações pré-deploy

- [ ] Confirmar que `ASAAS_ENV=production` e chaves Asaas de produção estão configuradas
- [ ] Confirmar que `vercel.json` foi commitado e enviado ao repositório
- [ ] Verificar que `SUPABASE_SERVICE_ROLE_KEY` está APENAS em variáveis de servidor (não `VITE_`)
- [ ] Revisar que `VITE_APP_URL` aponta para a URL de produção correta
- [ ] Executar deploy via `git push` ou Vercel Dashboard

### Ações pós-deploy

- [ ] Verificar que `/termos-de-uso`, `/politica-de-privacidade`, `/politica-de-cobranca`, `/suporte` carregam sem login
- [ ] Verificar que URLs diretas (ex: `/dashboard`) redirecionam corretamente para login ou dashboard
- [ ] Verificar headers de segurança: `curl -I https://<url> | grep -E "X-Frame|X-Content|Strict|Referrer"`
- [ ] Confirmar que `/api/` serverless functions respondem corretamente (não são redirecionadas para `index.html`)

---

## Domínio customizado (fora do escopo da Sprint 5)

Para adicionar um domínio próprio (ex: `app.herdon.com.br`):

1. Vercel Dashboard → Settings → Domains → Add Domain
2. Configurar DNS: CNAME apontando para `cname.vercel-dns.com` (ou A record para os IPs Vercel)
3. Vercel provisiona TLS automaticamente via Let's Encrypt
4. Atualizar `VITE_APP_URL` para o novo domínio

---

## Serverless functions atuais

| Arquivo | Rota |
|---------|------|
| `api/create-subscription.js` | `POST /api/create-subscription` |
| `api/webhook-asaas.js` | `POST /api/webhook-asaas` |
| `api/get-subscription.js` | `GET /api/get-subscription` |
| `api/cancel-subscription.js` | `POST /api/cancel-subscription` |
| `api/_asaas.js` | Helper interno (não é rota pública) |

O rewrite `(?!api/)` garante que essas rotas não são interceptadas pelo SPA handler.

---

## Resultado esperado

Após merge e deploy, qualquer usuário poderá acessar diretamente:
- `https://<app>.vercel.app/termos-de-uso`
- `https://<app>.vercel.app/politica-de-privacidade`
- `https://<app>.vercel.app/politica-de-cobranca`
- `https://<app>.vercel.app/suporte`

Sem receber 404 e sem precisar de autenticação.
