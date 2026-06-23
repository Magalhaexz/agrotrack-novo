# Teste manual — Planos, Limites e Asaas (Sprint 28)

## Limitação honesta

Como em todas as sprints anteriores, não tenho credenciais de conta autenticada do HERDON nem acesso a um ambiente Asaas sandbox configurado com chaves reais. **Nenhum item desta lista pôde ser testado de fato no navegador com uma conta real.** Tudo abaixo é auditoria de código + testes automatizados.

## O que foi verificado de fato

1. `npm run dev` sobe normalmente; console do navegador sem erros na tela de Login (única tela acessível sem login).
2. `npm test` — 534 testes, 0 falhas, incluindo os 24 novos testes de `tests/planos.test.js` cobrindo: plano Essencial, plano "pro" (sugestão "Campo Plus"), plano "premium" (sugestão "Gestão Pro"), Enterprise, Fundador/legado, plano desconhecido, internal_test, usuário sem assinatura, assinatura ativa, assinatura vencida (`past_due`), limite de fazendas, limite de cabeças, módulo liberado, módulo bloqueado, resumo de uso, e as mensagens amigáveis de limite/módulo bloqueado.
3. `npm run lint` — 0 erros.
4. `npm run build` — build de produção concluído com sucesso, incluindo o chunk atualizado que usa `src/domain/planos.js`.
5. Leitura de código confirma: nenhuma variável de ambiente do Asaas foi alterada; `ASAAS_ENV` continua sem valor de produção em nenhum lugar do repositório; nenhuma chave foi exposta no frontend.

## Roteiro para quando houver conta de teste + Asaas sandbox configurado

1. **Usuário `internal_test`**: confirmar que o Dashboard carrega normalmente, sem bloqueio, e que a página "Planos e Assinatura" mostra a mensagem "Você está usando o HERDON em acesso piloto. A cobrança ainda não está ativa."
2. **Usuário sem assinatura**: confirmar a mensagem "Escolha um plano para continuar usando o HERDON." na página de Planos, e que o app ainda permite navegar (não bloqueia por padrão).
3. **Usuário com plano ativo** (ex.: Essencial): confirmar que o resumo de uso (fazendas/animais/usuários) aparece corretamente comparado aos limites do plano.
4. **Limite de fazendas**: com uma conta no plano Essencial (limite 1) e 1 fazenda já cadastrada, tentar cadastrar uma segunda — confirmar a mensagem "Seu plano atual permite 1 fazenda. Para cadastrar mais fazendas, escolha um plano superior." e que a fazenda não é criada, mas a já existente continua visível.
5. **Limite de cabeças**: análogo, com animais.
6. **Módulo bloqueado**: com uma conta Essencial, tentar abrir "Financeiro" pelo menu — confirmar a mensagem "Este recurso está disponível em outro plano. Veja Planos e Assinatura para escolher um plano superior."
7. **Página Planos e Assinatura**: confirmar plano atual, status, uso atual, limites, módulos, lista de planos disponíveis e botão de escolher plano.
8. **Botão de checkout em sandbox**: clicar em "Escolher plano" para um plano pago, confirmar que abre uma URL de checkout do Asaas **sandbox** (`sandbox.asaas.com`), nunca produção.
9. **Retorno do checkout**: completar um pagamento de teste no sandbox do Asaas e confirmar que a página de retorno (`VITE_CHECKOUT_URL`) funciona.
10. **Webhook**: em ambiente seguro (não local), confirmar que um evento de teste do Asaas sandbox atualiza `customer_subscriptions.status` corretamente, e que o token do webhook é validado (testar com token errado deve retornar 401).

## Resultado

Sem acesso a conta de teste ou ambiente Asaas configurado, esta sprint se apoiou em auditoria de código completa (a integração já existente foi lida arquivo por arquivo) e em testes automatizados novos para a lógica de domínio de planos/limites. Nenhuma chamada real de cobrança foi feita ou habilitada. A verificação visual/funcional completa com conta e ambiente reais continua pendente — mesma limitação recorrente desde a Sprint 22.
