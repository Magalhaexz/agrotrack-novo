# Teste manual — Segurança, Backup e Auditoria Final (Sprint 30)

## Limitação honesta

Sem credenciais de conta autenticada, sem acesso ao painel do Supabase (MCP desconectado nesta sessão) e sem acesso ao ambiente de produção na Vercel, **nenhum dos itens de teste manual em produção pôde ser executado de fato**. Esta auditoria foi inteiramente baseada em leitura de código-fonte (schema SQL, policies RLS, endpoints serverless, variáveis de ambiente documentadas) — não em observação do sistema em execução com dados reais.

## O que foi verificado (por leitura de código, não por execução)

| Item pedido na Etapa 14 | Verificado? | Como |
|---|---|---|
| Abrir app em produção | Não | Sem acesso à URL/ambiente de produção |
| Login | Não | Sem credenciais |
| Usuário comum | Não | Sem credenciais |
| Usuário piloto | Não | Sem credenciais |
| Planos/Assinatura | Parcial | Página já auditada no código nas Sprints 28/30; comportamento confirmado por leitura, não por clique real |
| Webhook Asaas sem cobrança real | Parcial | Confirmado por leitura que o webhook só atualiza o banco com base em eventos recebidos, nunca inicia uma cobrança; não testado com um evento real do Asaas sandbox |
| Endpoints | Parcial | Auditados por leitura (`docs/API_ENDPOINTS_HERDON.md`); não testados com requisições reais |
| Erro no console | Parcial | Confirmado sem erros na tela de Login (única acessível sem login), via `npm run dev` + DevTools |
| Menu mobile corrigido no ar | Não | Correção da Sprint 29 foi medida localmente (`npm run dev`), não verificada em produção publicada |
| Dados de outra conta não aparecem | Não | Exigiria duas contas reais logadas simultaneamente |

## Gates automatizados (executados de fato)

1. `npm run dev` sobe normalmente; console sem erros na tela de Login.
2. `npm test` — 538 testes, 0 falhas (4 novos: `tests/cloudDiagnostic.test.js`, cobrindo a correção do vazamento de contagem entre contas).
3. `npm run lint` — 0 erros.
4. `npm run build` — build de produção concluído com sucesso.

## Roteiro para quando houver acesso real

1. Logar com uma conta de teste e confirmar acesso normal ao Dashboard.
2. Logar com uma segunda conta de teste (conta diferente) e confirmar que **nenhum** dado (fazenda, lote, animal, valor financeiro) da primeira conta aparece em nenhuma tela da segunda.
3. Tentar, com o token de sessão da segunda conta, fazer uma chamada direta à API REST do Supabase (`/rest/v1/lotes?owner_user_id=eq.<uuid-da-primeira-conta>`) e confirmar que a policy RLS bloqueia (retorna vazio, não os dados da conta 1) — testa a defesa de RLS diretamente, fora da interface.
4. No painel do Supabase, confirmar que `auditoria` não tem policies de UPDATE/DELETE (achado desta sprint).
5. Conceder acesso piloto via `supabase/sql/grant_pilot_access.sql` a uma conta de teste e confirmar que ela nunca é bloqueada pelo fluxo de assinatura.
6. Abrir "Planos e Assinatura" com a conta piloto e confirmar a mensagem "Você está usando o HERDON em acesso piloto..." (Sprint 28).
7. Disparar um evento de teste no Asaas sandbox (ex.: criar uma cobrança de teste) e confirmar que o webhook atualiza `customer_subscriptions`/`billing_events` sem nenhuma chamada chegar à API de produção do Asaas.
8. Chamar `/api/cloud-diagnostic` autenticado e confirmar que a resposta não contém mais contagens agregadas de outras contas (achado corrigido nesta sprint).
9. Verificar no Supabase (Table Editor) se restam fazendas/lotes com nomes claramente de teste ("Fazenda Modelo HERDON", "HRD-001" etc.) e, se forem de fato dados de QA (não de um cliente real), limpar com cuidado.
10. Testar o menu "Mais opções" em um iPhone real com Safari, em 375px-430px, confirmando a correção da Sprint 29.

## Resultado

Auditoria de código completa e dois achados corrigidos (script RLS de `auditoria`, vazamento de contagem em `cloud-diagnostic.js`). Nenhuma verificação em ambiente real foi possível — mesma limitação de todas as sprints desde a 22. Ver `docs/CHECKLIST_PRE_PILOTO_HERDON.md` para a lista completa do que precisa de confirmação humana antes do piloto.
