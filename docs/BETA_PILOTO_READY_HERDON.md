# Beta Piloto — Decisão de Prontidão

**Sprint 19 · Gerado em:** 2026-06-18
**Decisão:** ✅ **PRONTO PARA O PILOTO**

> **Atualização (Sprint 22):** desde esta decisão, a Sprint 21 adicionou
> movimentação de lotes entre pastos com histórico, e a Sprint 22 reformulou
> o Painel Geral ("Hoje na Fazenda") e corrigiu um bug que fazia alertas
> críticos nunca aparecerem. Ver [SPRINT_22_RESULTADO.md](SPRINT_22_RESULTADO.md).
> Pendência aberta: verificação visual real (mobile/desktop) do novo Painel
> Geral com uma conta autenticada, ainda não feita.

> **Atualização (Sprint 26):** o app agora tem orientação interna para o
> criador: página "Guia do Criador" (menu Ajuda), checklist de primeiros
> passos no Dashboard, ajuda contextual curta nas telas principais e a
> página de Suporte foi adicionada ao menu (antes só era alcançável por um
> banner). Reduz a dependência do `docs/GUIA_CRIADOR_PILOTO_HERDON.md`
> (documento interno) para orientar o piloto — agora o próprio app explica o
> básico. Ver [SPRINT_26_RESULTADO.md](SPRINT_26_RESULTADO.md). Pendência
> aberta: a mesma verificação visual real com conta autenticada, ainda não
> feita (sem credenciais de teste disponíveis).

> **Atualização (Sprint 27):** polimento visual e mobile geral. Corrigido um
> bug real de layout (`.action-row` sem `display: flex`, afetando o
> espaçamento de botões em toda a aplicação), desambiguado o menu
> ("Painel Gerencial" vs. "Relatórios") e melhorados estados vazios em 6
> telas. Auditoria de código não encontrou tabelas sem proteção responsiva,
> modais sem proteção de altura/largura mobile, ou jargão técnico vazando
> para a interface — pontos já endereçados em sprints anteriores. Ver
> [SPRINT_27_RESULTADO.md](SPRINT_27_RESULTADO.md). Pendência aberta (a
> mesma desde a Sprint 22): verificação visual real com conta autenticada,
> ainda não feita por falta de credenciais de teste. Também ficou pendente
> a consolidação dos breakpoints CSS e a duplicidade de regras
> `.header-tabs` no cabeçalho mobile (ver `docs/POLIMENTO_VISUAL_HERDON.md`).

> **Atualização (Sprint 28):** auditoria completa de planos e Asaas — a
> integração já existia e é mais madura do que o esperado (commitada há
> várias sprints). Confirmado que **a cobrança real continua desativada**
> (sandbox por padrão, nenhuma URL/chave de produção configurada) e que
> contas `internal_test`/piloto nunca são bloqueadas pelo fluxo de
> assinatura. Mensagens de limite e de módulo bloqueado foram reescritas
> para serem mais corretas e amigáveis. Nenhum plano, preço ou limite real
> foi alterado — a sprint sugeriu nomes/limites novos, documentados em
> `docs/PLANOS_HERDON.md` como sugestão, não aplicados sem confirmação
> humana. Ver [SPRINT_28_RESULTADO.md](SPRINT_28_RESULTADO.md). Pendência
> aberta (mesma desde a Sprint 22): verificação visual/funcional real com
> conta autenticada e ambiente Asaas sandbox configurado.

> **Atualização (Sprint 29):** identificado e corrigido, com medição
> concreta (não só leitura de código), o bug estrutural real do "Menu Mais
> opções cortado": `src/styles/layout.css` reservava espaço de sidebar fixa
> em qualquer modal do app, sem media query — no mobile isso espremia o
> modal a ~78px de largura. Corrigido restringindo a regra ao desktop;
> medido que o desktop não regrediu. Como a correção é compartilhada
> (`Modal.jsx`), todos os modais de cadastro do app (Fazenda, Pasto, Lote,
> Pesagem) se beneficiam. Também corrigido o indicador de conexão do header
> mobile (colapsa para um ponto, antes competia por espaço com a marca
> HERDON) e portalizado o painel "⋯" do header por segurança estrutural.
> Ver [SPRINT_29_RESULTADO.md](SPRINT_29_RESULTADO.md). Pendência aberta
> (mesma desde a Sprint 22): verificação visual real com conta autenticada.

> **Atualização (Sprint 30):** auditoria final de segurança antes do piloto.
> Confirmado: RLS habilitado e forçado em todas as 28 tabelas, service role
> nunca exposto ao frontend, Asaas continua em sandbox sem cobrança real
> ativa, nenhuma chave commitada. Dois achados reais corrigidos (ambos
> baixa-média severidade): o script-fonte de RLS recriava policies de
> UPDATE/DELETE em `auditoria` se re-executado (corrigido no arquivo, banco
> vivo precisa de confirmação humana); e `cloud-diagnostic.js` expunha
> contagem de registros agregada entre contas (corrigido + testado).
> Documentado backup/recuperação e um checklist objetivo pré-piloto. Ver
> [SPRINT_30_RESULTADO.md](SPRINT_30_RESULTADO.md) e
> [SEGURANCA_HERDON.md](SEGURANCA_HERDON.md). Pendência aberta (mesma desde
> a Sprint 22): nenhuma verificação em ambiente real foi possível.

> **Atualização (Sprint 31):** criado o Modo Curral — uma página dedicada
> de registro rápido (pesagem, movimentação de pasto, despesa, ocorrência)
> reaproveitando inteiramente os formulários e a fila offline já existentes
> desde a Sprint 23. Nenhuma regra de negócio nova, nenhuma tabela nova,
> nada em Asaas/planos foi alterado. Ver
> [SPRINT_31_RESULTADO.md](SPRINT_31_RESULTADO.md) e
> [MODO_CURRAL_HERDON.md](MODO_CURRAL_HERDON.md). Pendência aberta (mesma
> desde a Sprint 22): verificação visual real com conta autenticada — não
> foi possível abrir o Modo Curral logado nesta sessão por falta de
> credenciais de teste; ver
> [MODO_CURRAL_TESTE_MANUAL.md](MODO_CURRAL_TESTE_MANUAL.md).

> **Atualização (Sprint 32):** criada a Decisão de Venda e Custo por
> Arroba — leitura prática de "este lote já está no ponto de venda?" e
> "quanto custa produzir uma arroba neste lote?", reaproveitando
> inteiramente os cálculos de GMD/arrobas/custo/lucro já existentes desde
> sprints anteriores. Aparece no Relatório do Lote, em Resultado dos
> Lotes, no resumo WhatsApp e como prioridade no Dashboard. Nenhuma regra
> comercial, Asaas, plano, RLS ou migration foi alterada. Ver
> [SPRINT_32_RESULTADO.md](SPRINT_32_RESULTADO.md) e
> [DECISAO_VENDA_HERDON.md](DECISAO_VENDA_HERDON.md). Pendência aberta
> (mesma desde a Sprint 22): verificação visual real com conta
> autenticada — não foi possível nesta sessão; ver
> [DECISAO_VENDA_TESTE_MANUAL.md](DECISAO_VENDA_TESTE_MANUAL.md).

> **Atualização (Sprint 33):** sanidade e suplementação foram conectadas
> ao resultado do lote — status sanitário, custo de suplemento por
> cabeça/arroba e relação com o GMD, lendo dados que já existiam
> (`sanitario`, `consumo_suplementacao`) sem criar tabela nova. Aparece no
> Relatório do Lote, como sinal complementar na Decisão de Venda, no
> resumo WhatsApp e como prioridade combinada no Dashboard. Avaliado e
> **não** adicionado: atalho de sanidade/suplemento no Modo Curral (os
> formulários atuais não são offline-safe) — documentado como pendência.
> Nenhuma regra comercial, Asaas, plano, RLS ou migration foi alterada.
> Ver [SPRINT_33_RESULTADO.md](SPRINT_33_RESULTADO.md) e
> [MANEJO_RESULTADO_HERDON.md](MANEJO_RESULTADO_HERDON.md). Pendência
> aberta (mesma desde a Sprint 22): verificação visual real com conta
> autenticada — não foi possível nesta sessão; ver
> [MANEJO_RESULTADO_TESTE_MANUAL.md](MANEJO_RESULTADO_TESTE_MANUAL.md).

---

## Critérios de aprovação

| Critério | Status | Evidência |
|---------|--------|----------|
| Nenhum bloqueador crítico de acesso | ✔ | `canAccessModule` retorna `true` para usuário sem assinatura; plano Fundador cobre todos os módulos |
| Sistema de assinatura funcional | ✔ | 1 linha admin em `customer_subscriptions` validada; lógica `internal_test` testada |
| Módulo Pastos funcional | ✔ | Sprint 18 — CRUD funcional + FK lote→pasto com ON DELETE SET NULL |
| LoteForm estável | ✔ | Sprint 18 — validação condicional, limpeza ao trocar fazenda, payload correto |
| Financeiro funcional | ✔ | Sprint 18 — KPIs do FluxoCaixa, CustosCompartilhados e Estoque corrigidos |
| Nenhuma chave/secret exposta no frontend | ✔ | `VITE_` não prefixado em `SUPABASE_SERVICE_ROLE_KEY`; sem hardcoded emails |
| Script de acesso piloto pronto | ✔ | `supabase/sql/grant_pilot_access.sql` — INSERT com ON CONFLICT |
| Golden Path documentado | ✔ | `docs/BETA_PILOTO_GOLDEN_PATH.md` |
| Guia do piloto documentado | ✔ | `docs/GUIA_CRIADOR_PILOTO_HERDON.md` |
| Rotas mapeadas | ✔ | `docs/ROTAS_BETA_PILOTO_HERDON.md` — 29 rotas |
| Isolamento de dados por conta | ✔ | RLS `app_is_same_account()` em todas as tabelas |
| Sem dependência de Asaas | ✔ | `billing_provider = 'manual'`; sem webhook, sem checkout |
| Nenhum bypass no frontend | ✔ | Acesso via INSERT no banco, não por lógica frontend |

---

## O que NÃO está em escopo para este piloto

| Item | Motivo |
|------|--------|
| Teste em dispositivo iOS real | Fora do ambiente de desenvolvimento atual |
| Teste em dispositivo Android real | Idem |
| E-mail de confirmação de cadastro | Depende de prod; não testável aqui |
| Performance com carga real | Apenas 1 piloto; não é requisito desta fase |
| Plano comercial definitivo | Não alterado nesta sprint |
| Ativação de Asaas | Proibido nesta sprint |

---

## Itens pendentes pós-piloto (não bloqueadores)

- [ ] Validar em browser 375px as telas com `⚠` no Golden Path
- [ ] Testar fluxo completo de e-mail de confirmação de cadastro
- [ ] Monitorar erros via Supabase Logs durante o uso do piloto
- [ ] Coletar feedback do piloto após 7 dias de uso

---

## Processo de ativação do piloto

### Passo a passo para o admin (Herdon)

1. **Piloto se cadastra** na URL de produção
2. **Confirma e-mail** (Supabase Auth)
3. **Você busca o UUID** em Supabase > Authentication > Users
4. **Executa** `supabase/sql/grant_pilot_access.sql` substituindo `<UUID-DO-PILOTO>`
5. **Piloto faz logout + login** → plano Fundador ativo por 30 dias
6. **Você envia** a mensagem inicial (ver `docs/GUIA_CRIADOR_PILOTO_HERDON.md`)

### Como verificar que funcionou (após o INSERT)

```sql
SELECT plan_code, status, current_period_end, raw_payload
FROM customer_subscriptions
WHERE owner_user_id = '<UUID-DO-PILOTO>';
-- Esperado: fundador | internal_test | +30 dias | {beta_piloto: true}
```

---

## Reversão de acesso

```sql
UPDATE customer_subscriptions
SET status = 'canceled', updated_at = now()
WHERE owner_user_id = '<UUID-DO-PILOTO>';
```

O piloto será redirecionado para `AssinaturaBloqueadaPage` no próximo carregamento.

---

## Decisão final

**O HERDON está pronto para receber 1 criador piloto real.**

Condições atendidas:
- Sistema funcional end-to-end para o fluxo de fazenda → pasto → lote → financeiro → resultado
- Acesso controlado, sem custo, reversível, sem dependência de pagamento
- Isolamento de dados garantido por RLS
- Suporte via e-mail (herdonapp@gmail.com) com SLA de 48h úteis

**Próxima decisão:** após 7-14 dias de uso do piloto, avaliar feedback antes de abrir para mais usuários.
