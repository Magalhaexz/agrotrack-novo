# LEGAL_IMPLEMENTADO_HERDON

Sprint 5 — Etapa 2  
Data: 2026-06-15  
Status: IMPLEMENTADO

---

## O que foi feito

### Páginas criadas

| Arquivo | Rota | Conteúdo |
|---------|------|----------|
| `src/pages/TermosPage.jsx` | `/termos-de-uso` | 11 seções: o que é o HERDON, uso permitido, responsabilidade pelos dados, natureza dos cálculos, planos, disponibilidade, PI, encerramento, alterações, legislação aplicável, contato |
| `src/pages/PrivacidadePage.jsx` | `/politica-de-privacidade` | 8 seções: quem somos, dados coletados (tabela), parceiros (tabela), proteção, direitos LGPD Art.18, cookies/localStorage, retenção, DPO/contato |
| `src/pages/CobrancaPage.jsx` | `/politica-de-cobranca` | 9 seções: planos (cards com valores), processamento Asaas, ciclo de cobrança, falha de pagamento, cancelamento, reembolso, alteração de preços, ambiente sandbox, contato |
| `src/pages/SuportePage.jsx` | `/suporte` | Canal único (herdonapp@gmail.com), formatos de assunto, bugs críticos, o que incluir no e-mail, solicitações de conta, cancelamento/reembolso, horário |

Todas as páginas:
- São públicas — não exigem autenticação
- Usam CSS variables do design system (`var(--color-bg)`, `var(--color-primary)`, etc.)
- Têm header com marca HERDON e link "← Voltar ao sistema" (→ `/`)
- Têm footer com links entre si e link para início
- São lazy-loaded (chunks separados no build)

### Roteamento

**`src/navigation/routes.js`** — adicionadas 4 rotas:
```js
termos: '/termos-de-uso',
privacidade: '/politica-de-privacidade',
cobranca: '/politica-de-cobranca',
suporte: '/suporte',
```

**`src/App.jsx`** — dois pontos alterados:

1. Após `const LoginPage = lazy(...)`, adicionados:
```js
const TermosPage = lazy(() => import('./pages/TermosPage'));
const PrivacidadePage = lazy(() => import('./pages/PrivacidadePage'));
const CobrancaPage = lazy(() => import('./pages/CobrancaPage'));
const SuportePage = lazy(() => import('./pages/SuportePage'));

const publicPageMap = {
  termos: TermosPage,
  privacidade: PrivacidadePage,
  cobranca: CobrancaPage,
  suporte: SuportePage,
};
```

2. Antes do auth gate (`if (forcarTelaLogin || !session)`), adicionado interceptor:
```js
if (Object.prototype.hasOwnProperty.call(publicPageMap, currentPage)) {
  const PublicPage = publicPageMap[currentPage];
  return (
    <Suspense fallback={<div className="app-loading">Carregando...</div>}>
      <PublicPage />
    </Suspense>
  );
}
```

**`src/pages/LoginPage.jsx`** — footer atualizado com links legais:
```jsx
<div className="login-card-foot">
  HERDON centraliza o essencial da operacao sem tirar velocidade do dia a dia.
  <div style={{ marginTop: 12, display: 'flex', gap: 12, ... }}>
    <a href="/termos-de-uso">Termos de Uso</a>
    <a href="/politica-de-privacidade">Privacidade</a>
    <a href="/politica-de-cobranca">Cobrança</a>
    <a href="/suporte">Suporte</a>
  </div>
</div>
```

### Vercel

**`vercel.json`** criado na raiz do repositório — ver `docs/VERCEL_GO_LIVE_HERDON.md`.

---

## Verificação de build

`npm run build` executado após todas as alterações:
- 196 módulos transformados (192 antes + 4 novas pages)
- Chunks gerados: `TermosPage-*.js`, `PrivacidadePage-*.js`, `CobrancaPage-*.js`, `SuportePage-*.js`
- Sem erros ou warnings

---

## Acesso sem autenticação — fluxo

```
URL → App.jsx inicializa →
  getPageFromPathname('/termos-de-uso') → 'termos'
  isBootLoading? → renderiza loading
  publicPageMap.hasOwnProperty('termos')? → SIM → renderiza TermosPage
  (auth gate nunca é atingido)
```

Qualquer utilizador (autenticado ou não) pode acessar `/termos-de-uso`, `/politica-de-privacidade`, `/politica-de-cobranca` e `/suporte` sem login.

---

## Conteúdo legal — avisos

- Documentos em Versão 1.0, vigentes de 2026-06-15
- Valores dos planos refletem os planos atuais no sistema (Fundador R$297, Essencial R$197, Pro R$397, Premium R$697)
- Contato único: herdonapp@gmail.com
- LGPD: controlador = desenvolvedor (pessoa física); operador dos dados inseridos = HERDON
- Parceiros documentados: Supabase (EUA), Asaas (Brasil), Vercel (EUA)
- Seção "Ambiente de teste controlado" na CobrancaPage esclarece que ainda estamos em sandbox

---

## Pendências (fora do escopo da Sprint 5)

- Revisar com advogado para uso em produção real
- Adicionar checkbox "Li e aceito os Termos de Uso" no fluxo de cadastro
- Considerar versionamento dos documentos legais no git com tags
