# Asaas — Diagnóstico: Ausência de PIX no Checkout

**Sprint 17A · Hotfix**
**Data:** 2026-06-17
**Ambiente:** Sandbox

---

## Sintoma

No teste sandbox do checkout Asaas, a tela exibiu apenas:
- Boleto Bancário
- Cartão de Crédito

**PIX não apareceu.**

Plano testado: HERDON - FUNDADOR / R$ 297,00 mensal.

---

## Análise da integração

### Fluxo de criação do checkout

```
Frontend (MinhaAssinaturaPage)
  → POST /api/asaas-create-subscription
    { planCode: 'fundador', customer: {...} }
      ↓
handleCreateSubscriptionRequest (api/_asaas.js)
  → createRecurringPaymentLinkOnAsaas()
    POST /paymentLinks
    { billingType: 'UNDEFINED', chargeType: 'RECURRENT', subscriptionCycle: 'MONTHLY', ... }
      ↓
Asaas retorna URL do checkout
  → Usuário vê tela de pagamento
```

### O que `billingType: 'UNDEFINED'` significa

`UNDEFINED` instrui o Asaas a exibir **todos os meios de pagamento habilitados na conta**.

- Se apenas Boleto e Cartão estão habilitados → checkout exibe só esses dois
- Se PIX estiver habilitado → checkout exibe PIX também

### Por que PIX não apareceu

**Causa raiz: PIX não está habilitado para assinaturas recorrentes na conta Asaas sandbox.**

No Asaas, pagamento via PIX em cobranças recorrentes é uma funcionalidade separada chamada **"Assinatura via PIX"**. Ela não vem ativada por padrão — o proprietário da conta precisa habilitá-la manualmente no painel.

Isso não é um bug no código HERDON — o `billingType: 'UNDEFINED'` é o valor correto para mostrar todos os métodos disponíveis.

---

## Bugs de código encontrados

### Bug 1 (corrigido): Override de `billingType` pelo cliente

**Antes (`api/_asaas.js` linha 725):**
```js
billingType: normalizeText(body?.billingType || 'UNDEFINED') || 'UNDEFINED',
```

**Problema:** O frontend poderia enviar `billingType` arbitrário no corpo da requisição, e o servidor aceitaria sem validação. Isso permitiria, por exemplo, forçar `billingType: 'BOLETO'` e remover o Cartão de Crédito do checkout.

**Depois (corrigido):**
```js
billingType: 'UNDEFINED', // UNDEFINED = Asaas mostra todos os meios ativos na conta (PIX, BOLETO, CREDIT_CARD). PIX requer "Assinatura via PIX" habilitado no painel Asaas.
```

O servidor agora sempre envia `UNDEFINED` — o meio de pagamento nunca pode ser restringido pelo cliente.

---

## Correção necessária no painel Asaas

Para que PIX apareça no checkout:

### Sandbox (para testes)

1. Acessar [sandbox.asaas.com](https://sandbox.asaas.com)
2. Fazer login com a conta sandbox
3. Ir para **Configurações → Formas de Pagamento**
4. Localizar **"PIX"** ou **"Assinatura via PIX"**
5. Habilitar a opção
6. Salvar

### Produção (quando for ao ar)

1. Acessar [app.asaas.com](https://app.asaas.com)
2. Fazer login com a conta de produção
3. Mesmo caminho: **Configurações → Formas de Pagamento → PIX → Habilitar**
4. Aguardar aprovação (pode exigir validação bancária)

---

## Como testar após a habilitação

1. Com PIX habilitado no painel Asaas sandbox:
2. Abrir HERDON em `https://agrotrack-novo.vercel.app`
3. Fazer login com usuário de teste
4. Ir para **Planos e Assinatura**
5. Clicar em "Assinar" no plano FUNDADOR
6. O checkout Asaas deve exibir 3 opções: **PIX**, **Boleto** e **Cartão de Crédito**

---

## Meios de pagamento suportados

| Meio | Código Asaas | Status no HERDON |
|------|-------------|-----------------|
| PIX | `PIX` | ✅ Suportado pelo código — requer habilitação no painel |
| Boleto Bancário | `BOLETO` | ✅ Exibido no checkout |
| Cartão de Crédito | `CREDIT_CARD` | ✅ Exibido no checkout |

---

## Arquivos modificados nesta sprint

| Arquivo | Mudança |
|---------|---------|
| `api/_asaas.js` linha 725 | Removido override de `billingType` pelo cliente; hardcoded `'UNDEFINED'` |
| `src/services/asaasBilling.test.js` | Criado: 25 testes para funções puras de billing + documentação do comportamento esperado do PIX |
| `docs/ASAAS_DIAGNOSTICO_HERDON.md` | Este arquivo |

---

## Dependências externas (sem código)

| Item | Responsável | Status |
|------|------------|--------|
| Habilitar PIX no Asaas sandbox | Herdon (painel Asaas) | ⚠️ Pendente |
| Habilitar PIX no Asaas produção | Herdon (painel Asaas) | ⚠️ Pendente |
| Verificar se conta Asaas tem PIX ativo | Herdon | ⚠️ Pendente |
| Reconfirmar checkout após habilitação | Herdon | ⚠️ Pendente |

---

## Conclusão

O código HERDON está correto: `billingType: 'UNDEFINED'` é a instrução certa para mostrar todos os meios de pagamento disponíveis. A ausência do PIX no checkout é causada pela falta de configuração na conta Asaas — não por bug no produto.

Ação necessária: **habilitar PIX para assinaturas no painel Asaas** (sandbox e produção separadamente).
