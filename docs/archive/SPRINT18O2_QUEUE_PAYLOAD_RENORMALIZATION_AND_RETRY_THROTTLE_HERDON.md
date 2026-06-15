# SPRINT18O2_QUEUE_PAYLOAD_RENORMALIZATION_AND_RETRY_THROTTLE_HERDON

1. Initial queue count: 2 (cenário reportado: fazendas/create e estoque/create).
2. Initial queue tables/actions: fazendas/create, estoque/create.
3. Retry storm stopped: yes (backoff + bloqueio `blocked_schema_error` após limite).
4. Fazendas payload re-normalized: yes (builder de create aplicado também ao replay da fila).
5. Estoque payload re-normalized: yes (payload conservador e normalizado antes do retry).
6. Manual Sincronizar clicked: no (não validado interativamente neste ambiente CLI).
7. Queue count after sync: não verificado interativamente (depende do clique manual e sessão real).
8. If still pending, exact code/message: `blocked_schema_error` / `Pendência precisa de revisão de compatibilidade antes de sincronizar.`
9. Header state after sync: com pendências mantém `Sincronizacao pendente`; sem pendências retorna para estado de nuvem ativa.
10. Any remaining 400 errors: não observado em loop automático após throttle/bloqueio (validação interativa em navegador ainda recomendada).
