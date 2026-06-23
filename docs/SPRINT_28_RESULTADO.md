# Sprint 28 — Resultado

## Funcionalidade entregue

**Planos, Limites e Asaas**

Esta foi principalmente uma sprint de **auditoria e organização** — o sistema de planos/assinatura e a integração com o Asaas já existiam e eram muito mais maduros do que o diagnóstico inicial sugeria (commitados em `main` há várias sprints, não criados agora). O trabalho real foi: confirmar segurança, criar uma camada de domínio com nomes mais claros (`src/domain/planos.js`), corrigir mensagens de limite que estavam com a redação errada, e documentar tudo com profundidade.

---

## 1. Planos que ficaram definidos

Nenhum plano novo foi criado. O catálogo existente foi mantido: **Essencial**, **PRO**, **PREMIUM**, **ENTERPRISE**, e o plano legado **FUNDADOR**. A sprint sugeriu nomes de marketing mais amigáveis ("Campo Plus", "Gestão Pro") e limites diferentes dos atuais — documentado como sugestão em [docs/PLANOS_HERDON.md](PLANOS_HERDON.md), **não aplicado no código**, porque os limites sugeridos divergem dos reais e alterar preço/limite real sem confirmação humana era exatamente o que a sprint pedia para evitar.

## 2. Limites implementados

Nenhum limite numérico novo — os limites já existentes (fazendas/cabeças/usuários por plano) foram organizados em `src/domain/planos.js` (`getLimitesPlano`, `verificarLimiteUso`) e as **mensagens de bloqueio foram reescritas** para serem mais corretas e amigáveis:

| Antes | Depois |
|---|---|
| "Seu plano permite até X fazendas. Regularize sua assinatura para continuar usando o HERDON." | "Seu plano atual permite 1 fazenda. Para cadastrar mais fazendas, escolha um plano superior." |
| (mesma fórmula genérica para cabeças/usuários) | Mensagens específicas por tipo de limite — ver [docs/LIMITES_PLANOS_HERDON.md](LIMITES_PLANOS_HERDON.md) |
| "Este recurso não está disponível no seu plano. Fale com o suporte para ajustar seu plano." | "Este recurso está disponível em outro plano. Veja Planos e Assinatura para escolher um plano superior." |

A mensagem antiga confundia "limite de plano atingido" com "assinatura com problema de pagamento" — agora são frases diferentes para situações diferentes.

## 3. Plano Fundador/legado

Mantido sem nenhuma alteração — `plan_code: 'fundador'`, todos os módulos liberados (`modules: ['*']`), limites generosos (50 fazendas / 10.000 cabeças / 50 usuários). Confirmado por teste (`tests/planos.test.js`) que continua funcionando exatamente como antes.

## 4. Proteção do beta/internal_test

Confirmado por leitura de código e reforçado por novos testes: `internal_test` está em `ACTIVE_STATUSES` e `ENTERABLE_STATUSES`, e em nenhum conjunto de bloqueio (`BLOCKED_STATUSES`). Não há caminho de código que bloqueie uma conta `internal_test`. A mensagem exibida para esse status também foi melhorada: "Você está usando o HERDON em acesso piloto. A cobrança ainda não está ativa." (antes: "Acesso de teste ativo." — vago, não dizia que a cobrança estava desligada). Detalhes em [docs/ASSINATURAS_HERDON.md](ASSINATURAS_HERDON.md).

## 5. Como o Asaas ficou configurado

**Sem nenhuma alteração.** Confirmado por auditoria completa (`api/_asaas.js`, `api/asaas-create-customer.js`, `api/asaas-create-subscription.js`, `api/asaas-webhook.js`, `src/services/asaasBilling.js`): ambiente sandbox por padrão (`ASAAS_ENV` não definido → `'sandbox'`), nenhuma URL de produção hardcoded, chaves só lidas server-side, webhook validado por token. Ver [docs/ASAAS_HERDON.md](ASAAS_HERDON.md) para o passo a passo de como ativar produção no futuro (não feito agora).

## 6. Cobrança real

**Continua desativada.** Nenhuma variável de ambiente foi alterada nesta sprint. `ASAAS_ENV=sandbox` continua sendo o valor de referência em `.env.example`.

---

## Arquivos novos

| Arquivo | Descrição |
|---|---|
| `src/domain/planos.js` | `getPlanoConfig`, `getLimitesPlano`, `getModulosPlano`, `verificarLimiteUso`, `verificarAcessoModulo`, `obterResumoUso` |
| `tests/planos.test.js` | 24 testes do domínio de planos e mensagens amigáveis |
| `docs/PLANOS_HERDON.md` | Planos existentes, sugestão de nomes/limites não aplicada, tratamento do Fundador |
| `docs/LIMITES_PLANOS_HERDON.md` | Limites por plano, mensagens amigáveis, garantias de não bloquear dados existentes |
| `docs/ASAAS_HERDON.md` | Auditoria completa do fluxo Asaas (checkout, webhook, variáveis de ambiente) |
| `docs/ASSINATURAS_HERDON.md` | Estados da assinatura, mapeamento de nomes, separação beta/sandbox/produção, upgrade/downgrade |
| `docs/PLANOS_ASSINATURA_TESTE_MANUAL.md` | Roteiro de teste manual (com limitação de autenticação/sandbox documentada) |
| `docs/SPRINT_28_RESULTADO.md` | Este documento |

## Arquivos modificados

| Arquivo | O que mudou |
|---|---|
| `src/services/subscriptions.js` | Mensagens de `getSubscriptionDisplayCopy` (internal_test, sem assinatura) e `getSubscriptionLimitMessage` reescritas; nova função `getModuleBlockedMessage()` |
| `src/App.jsx` | `subscriptionUsage` agora vem de `obterResumoUso()` (mesmo resultado, lógica centralizada); mensagem de módulo bloqueado usa `getModuleBlockedMessage()` |
| `tests/subscriptions.test.js` | 3 asserts atualizados para as novas mensagens (mudança de copy intencional, não regressão) |
| `docs/BETA_PILOTO_READY_HERDON.md` | Addendum Sprint 28 |

---

## Decisões técnicas

### Por que não alterar preços/limites reais

A sprint foi explícita: "não alterar preços reais sem confirmação humana" e tratar os novos limites sugeridos como "sugestão interna, não cobrança real ativa". Como os limites sugeridos divergem dos já presentes no catálogo (que pode já ter assinaturas reais vinculadas via Asaas), a escolha mais segura foi documentar a sugestão sem aplicá-la, deixando a decisão final para um humano.

### `planos.js` como wrapper, não substituto

`src/domain/planos.js` não duplica o catálogo de planos nem a lógica de bloqueio por status de assinatura (que continua em `subscriptions.js`, já testada e usada em produção). Ele expõe nomes de função em português pedidos pela sprint, focados em regras de plano "puras" (limite vs. uso, módulo vs. plano) — uma camada adicional, não uma reescrita.

## Limitações conhecidas

- Não foi possível testar nada com conta autenticada real ou ambiente Asaas sandbox configurado.
- Os nomes de marketing sugeridos pela sprint ("Campo Plus", "Gestão Pro") não foram aplicados na interface — ainda aparecem como "PRO"/"PREMIUM".

## Pendências para Sprint 29

- Confirmar humanamente os limites/nomes sugeridos e decidir se substituem os atuais.
- Cupom, teste grátis automático, upgrade/downgrade automático, nota fiscal, cobrança anual, inadimplência automática, portal do cliente (lista de pendências futuras da própria sprint, nenhuma implementada aqui por estarem fora do escopo).
- Avisos preventivos de limite (ex.: "9 de 10 fazendas usadas").
- Decidir o destino das contas `internal_test`/piloto quando a cobrança real for ativada.

## Teste manual

Não foi possível testar com conta autenticada real nem ambiente Asaas configurado. Documentado honestamente em `docs/PLANOS_ASSINATURA_TESTE_MANUAL.md`.

## Resultado dos gates

| Gate | Resultado |
|---|---|
| `npm test` | 534 testes, 0 falhas (24 novos em `tests/planos.test.js`; 3 asserts existentes atualizados para a nova copy) |
| `npm run lint` | 0 erros |
| `npm run build` | Build de produção concluído com sucesso |
