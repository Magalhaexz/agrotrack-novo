# Sprint 10B.10 — Fix Serverless Authorization Header 494

## O que foi corrigido
- Pré-validação segura do token antes de chamar `/api/cloud-diagnostic` e `/api/cloud-sync`.
- Uso explícito de `supabase.auth.getSession()` e envio apenas de `session.access_token` no header `Authorization`.
- Bloqueio de chamadas quando token ausente/inválido com mensagem: `Sessão inválida. Reconecte à nuvem.`
- Remoção de fallback automático para chamadas diretas no diagnóstico (evita spam e comportamento divergente).
- Fallback automático de sync para chamadas diretas removido; mantém modo local ativo e mensagem segura.
- Endpoints serverless endurecidos para Authorization malformado com `401` e mensagem segura.
- Adicionado diagnóstico seguro `[HERDON_SERVERLESS_AUTH_HEADER_DIAGNOSTIC]` sem segredos.

## Segurança aplicada
- Não há log de token, refresh token, header Authorization bruto, sessão completa, anon key ou service role.
- Apenas métricas seguras são registradas: endpoint, status, hasAccessToken, tokenLooksJwt, tokenLength, failureType, safeMessage.

## Comportamento esperado
- Usuário deslogado: resposta 401 segura.
- Usuário logado: requisições não devem mais cair em 494 por header malformado/objeto.
- Header enviado no formato: `Bearer <JWT>`.
- Sync via servidor preservado para Fazendas e Lotes.
- Modo local/offline preservado.
