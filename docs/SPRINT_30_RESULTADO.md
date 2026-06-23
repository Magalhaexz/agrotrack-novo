# Sprint 30 — Resultado

## Funcionalidade entregue

**Segurança, Backup e Auditoria Final**

Auditoria completa de RLS, isolamento entre contas, service role, variáveis de ambiente, endpoints serverless, Asaas, permissões por perfil, logs e dados de teste. Dois achados reais corrigidos (ambos de severidade baixa-média, nenhum crítico). Documentação de backup/recuperação e checklist pré-piloto criados.

---

## 1. Achados de segurança

| # | Achado | Severidade |
|---|---|---|
| 1 | `docs/supabase-production-rls.sql` recriava policies de UPDATE/DELETE em `auditoria` se re-executado — uma trilha de auditoria editável/apagável pela própria conta auditada não serve para nada. A correção certa (Sprint 2) tinha sido aplicada manualmente no banco, mas o script-fonte nunca foi atualizado, então re-executá-lo regrediria a correção. | Baixa-média |
| 2 | `api/cloud-diagnostic.js` devolvia, para qualquer usuário autenticado, a contagem total de linhas de `lotes`/`fazendas` de **toda a plataforma** (via client `service_role`, que ignora RLS), não só da própria conta — e o frontend nunca usava esse número. | Baixa |

Nenhum achado crítico: nenhuma chave exposta, nenhuma tabela sem RLS, nenhum endpoint sem autenticação.

## 2. RLS — corrigido ou só auditado?

**Ambos.** Auditado tabela por tabela (28 tabelas, todas com RLS habilitado e forçado) e **corrigido** o script-fonte para o achado #1. A correção foi feita no arquivo `.sql` versionado, não no banco vivo — não tenho acesso ao Supabase nesta sessão para aplicar/confirmar diretamente. Detalhes completos: [docs/RLS_AUDITORIA_HERDON.md](RLS_AUDITORIA_HERDON.md).

## 3. Service role

Confirmado protegido — só é lido em `api/_supabaseAdmin.js` via `process.env`, nunca aparece em `src/` (código que vai para o bundle do navegador), nunca commitado em `.env.example` com valor real.

## 4. Asaas — continua seguro/sandbox?

Sim, revalidado. `ASAAS_ENV` continua sem valor de produção em qualquer lugar do repositório. Nenhuma variável de ambiente foi alterada nesta sprint. Ver [docs/ASAAS_HERDON.md](ASAAS_HERDON.md).

## 5. Cobrança real

**Continua desativada.** Nenhuma alteração de ambiente, preço ou plano comercial nesta sprint.

## 6. Dados de teste

Encontrados apenas em scripts de geração de planilha E2E (`scripts/gerar-planilha-e2e.mjs`) e documentação — nunca em código-fonte, migrações ou seed do banco real. Não foi possível verificar se restam registros de QA manual no banco de produção (sem acesso) — item incluído no checklist pré-piloto para verificação humana.

## 7. Backup e checklist

Ambos documentados nesta sprint: [docs/BACKUP_RECUPERACAO_HERDON.md](BACKUP_RECUPERACAO_HERDON.md) e [docs/CHECKLIST_PRE_PILOTO_HERDON.md](CHECKLIST_PRE_PILOTO_HERDON.md). Nenhum script de limpeza foi criado/executado — não há indício, por leitura de código, de dados fictícios persistidos por automação (só haveria se alguém os inseriu manualmente durante testes, o que não posso confirmar sem acesso ao banco).

---

## Arquivos modificados

| Arquivo | O que mudou |
|---|---|
| `docs/supabase-production-rls.sql` | `auditoria` removida do loop genérico de policies; ganhou bloco próprio sem UPDATE/DELETE |
| `api/cloud-diagnostic.js` | `runTableCheck` não devolve mais contagem quando a checagem não é filtrada por conta; função exportada para teste |
| `docs/ASAAS_HERDON.md` | Addendum de revalidação Sprint 30 |
| `docs/BETA_PILOTO_READY_HERDON.md` | Addendum Sprint 30 |

## Arquivos novos

| Arquivo | Descrição |
|---|---|
| `docs/SEGURANCA_HERDON.md` | Visão geral da auditoria, achados e correções |
| `docs/RLS_AUDITORIA_HERDON.md` | Auditoria detalhada de RLS, tabela por tabela |
| `docs/API_ENDPOINTS_HERDON.md` | Auditoria dos 5 endpoints serverless |
| `docs/BACKUP_RECUPERACAO_HERDON.md` | Como exportar, restaurar e proteger backups |
| `docs/CHECKLIST_PRE_PILOTO_HERDON.md` | Checklist objetivo pré-piloto |
| `docs/SEGURANCA_TESTE_MANUAL.md` | Roteiro de teste manual (com limitação de acesso documentada) |
| `docs/SPRINT_30_RESULTADO.md` | Este documento |
| `tests/cloudDiagnostic.test.js` | 4 testes da correção do vazamento de contagem |

## Decisões técnicas

### Por que corrigir o script em vez do banco

Sem acesso ao Supabase nesta sessão (MCP desconectado), a única correção segura possível foi no **arquivo-fonte versionado** — garante que, da próxima vez que alguém provisionar um ambiente ou re-rodar o bundle, a regressão não aconteça. A aplicação no banco vivo (confirmar que as policies erradas não existem hoje) fica como ação humana, documentada no checklist.

### Por que não criar RLS por papel/perfil nesta sprint

Identificada como lacuna real de defesa em profundidade (RLS isola por conta, não por papel — um visualizador poderia em teoria escrever via API direta, contornando os botões desabilitados da UI). Não corrigida porque exigiria mapear, tabela por tabela, qual perfil pode editar o quê — um erro nesse mapeamento bloquearia acesso legítimo de operador/gerente, e não há ambiente de teste real disponível para validar antes de aplicar. Fica como pendência para uma sprint dedicada, com ambiente de teste.

## Limitações conhecidas

- Nenhuma verificação em ambiente real (produção, banco vivo, duas contas reais) foi possível.
- A correção do script RLS não foi aplicada ao banco vivo — só ao arquivo-fonte.

## Pendências para Sprint 31

- Confirmar no Supabase real que as policies de `auditoria` estão corretas.
- Testar isolamento entre contas com credenciais reais.
- RLS por papel/perfil (defesa em profundidade), com ambiente de teste.
- Testar restore de backup pelo menos uma vez.
- Verificar/limpar dados de QA manual remanescentes no banco de produção, se existirem.
- Percorrer o checklist pré-piloto com acesso real à Vercel/Supabase.

## Teste manual

Não foi possível testar nada em ambiente real. Documentado honestamente em `docs/SEGURANCA_TESTE_MANUAL.md`.

## Resultado dos gates

| Gate | Resultado |
|---|---|
| `npm test` | 538 testes, 0 falhas (4 novos em `tests/cloudDiagnostic.test.js`) |
| `npm run lint` | 0 erros |
| `npm run build` | Build de produção concluído com sucesso |
