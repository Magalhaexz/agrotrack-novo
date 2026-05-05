# Sprint 10B.14 — Cloud UI Polish

## O que foi alterado
- Atualização do chip superior de nuvem para refletir estado positivo após diagnóstico serverless bem-sucedido.
- Evento de estado de diagnóstico (`herdon-cloud-diagnostic-state`) enviado pela tela de Fazendas e consumido no App para atualizar o header.
- Remoção de mensagens genéricas duplicadas no fluxo de toasts do diagnóstico; priorização de mensagens explícitas e amigáveis em português.
- Mantido o diagnóstico serverless como única fonte de verdade para o botão “Testar conexão com a nuvem”.

## Por que o chip superior foi corrigido
- Antes, mesmo após sucesso do `/api/cloud-diagnostic`, o header podia continuar em fallback visual (“Nuvem não verificada”) por depender apenas do estado operacional de sync.
- Agora, sucesso do diagnóstico atualiza estado global de verificação e o chip mostra estado positivo (“Nuvem verificada” / “Nuvem ativa”).

## Como as duplicidades foram removidas
- O fluxo de toasts deixou de gerar entradas genéricas redundantes como “Diagnóstico: OK”.
- Permanecem mensagens explícitas por etapa (Ambiente/Fazendas/Lotes) e conclusão (“Nuvem conectada pelo servidor.”).

## O que intencionalmente não foi alterado
- Não houve alteração de schema Supabase, RLS, autenticação, regras de negócio, ou lógica de sincronização funcional.
- Não foi reintroduzido fallback automático antigo de diagnóstico direto no browser.
- Logging seguro preservado (sem tokens, headers, sessões completas, chaves ou segredos).

## Resultados dos testes
- `npm run build`: sucesso.
- `npm run lint`: sucesso com warnings preexistentes (sem erros).
