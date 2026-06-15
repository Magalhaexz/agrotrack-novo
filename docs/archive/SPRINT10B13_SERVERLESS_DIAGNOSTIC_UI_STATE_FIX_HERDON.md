# Sprint 10B.13 — Serverless Diagnostic UI State Fix

## Ajustes principais
- O diagnóstico manual agora usa prioritariamente `/api/cloud-diagnostic` e consome o resultado serverless como fonte de verdade para a UI.
- Após sucesso serverless (`ok: true`), a UI exibe "Nuvem conectada pelo servidor." e etapas de sucesso (Ambiente/Fazendas/Lotes), sem executar automaticamente diagnóstico antigo direto no browser.
- Em falha serverless, a UI mostra mensagem segura com status quando disponível e mantém modo local ativo, sem fallback automático para diagnóstico direto.
- Logs seguros padronizados em `[HERDON_SERVERLESS_CLOUD_DIAGNOSTIC]`, sem exposição de tokens/chaves/sessão.

## Sincronização manual
- Mantido `/api/cloud-sync` como caminho primário.
- Em sucesso: mensagens de sincronização de Fazendas e Lotes + reconciliação local quando payload retorna dados.
- Em falha: mensagem segura e preservação dos dados locais, sem spam de fallback automático.

## Validação
- `npm run build` executado com sucesso.
- `npm run lint` executado com sucesso (apenas warnings preexistentes).
