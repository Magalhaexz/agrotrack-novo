# Legal — Checklist HERDON

**Atualizado:** 2026-06-17 (Sprint 15)
**Histórico:** criado Sprint 4 como pendência; atualizado Sprint 15 com status real

---

## Páginas legais existentes

| Página | Arquivo | Rota | Status |
|--------|---------|------|--------|
| Termos de Uso | `src/pages/TermosPage.jsx` | `/termos-de-uso` | ✅ Existe |
| Política de Privacidade | `src/pages/PrivacidadePage.jsx` | `/politica-de-privacidade` | ✅ Existe |
| Política de Cobrança | `src/pages/CobrancaPage.jsx` | `/politica-de-cobranca` | ✅ Existe |
| Suporte / Contato | `src/pages/SuportePage.jsx` | `/suporte` | ✅ Existe |

---

## Acessibilidade pública

Todas as páginas legais estão no `publicPageMap` em `App.jsx` — **acessíveis sem login**.

Links visíveis no rodapé da tela de login (`LoginPage.jsx`):

- Termos de Uso → `/termos-de-uso`
- Privacidade → `/politica-de-privacidade`
- Cobrança → `/politica-de-cobranca`
- Suporte → `/suporte`

---

## Validação de conteúdo (verificação pendente)

Os arquivos JSX existem mas o **conteúdo** deve ser revisado manualmente:

| Item | Verificação necessária |
|------|----------------------|
| Termos de Uso — nome correto do produto (HERDON) | ⚠️ Revisar conteúdo |
| Termos de Uso — data de vigência atual | ⚠️ Atualizar se necessário |
| Política de Privacidade — conformidade LGPD | ⚠️ Revisar com jurídico |
| Política de Cobrança — preços e ciclo corretos | ⚠️ Confirmar valores atuais |
| Suporte — e-mail/canal de contato ativo | ⚠️ Confirmar contato funcional |

---

## Checklist LGPD mínimo (go-live controlado)

- [ ] Usuário consente com Termos de Uso ao criar conta (aceite explícito ou link visível)
- [ ] Política de Privacidade menciona que dados são armazenados no Supabase (infraestrutura USA/AWS)
- [ ] Titular pode solicitar exclusão de dados (artigo 18 LGPD)
- [ ] E-mail de suporte ativo para dúvidas e solicitações de exclusão
- [ ] Dados de pagamento processados pelo Asaas informados na Política de Cobrança

---

## Status geral

| Item | Status |
|------|--------|
| 4 páginas legais existem | ✅ |
| Rotas registradas | ✅ |
| Acessíveis sem login | ✅ |
| Links visíveis na tela de login | ✅ |
| Conteúdo revisado e atualizado | ⚠️ Pendente revisão manual |
| Conformidade LGPD confirmada | ⚠️ Pendente revisão jurídica |
