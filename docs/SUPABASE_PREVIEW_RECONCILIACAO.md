# Reconciliação Supabase Preview (Sprint 30.1)

## Erro original

```
Remote migration versions not found in local migrations directory.
```

## Causa

`supabase/migrations/` continha 3 arquivos cujo **prefixo de versão** (o timestamp no nome do arquivo) não batia com a versão real registrada em `supabase_migrations.schema_migrations` no projeto remoto — o Supabase identifica cada migration pelo timestamp de quando ela foi de fato aplicada (via `supabase db push` ou dashboard), não pelo nome escolhido ao criar o arquivo localmente. Os arquivos locais usavam timestamps "redondos" (`...000000`) escolhidos na hora de escrever o SQL, diferentes do momento real de aplicação.

## Remoto x Local (antes da correção)

| Remoto (`schema_migrations`) | Local (arquivo) | Situação |
|---|---|---|
| `20260617020950_financial_status_fields` | `20260616000000_financial_status_fields.sql` | Mesmo conteúdo, versão diferente |
| `20260619113446_lote_pastagens_historico` | `20260619000000_lote_pastagens_historico.sql` | Mesmo conteúdo, versão diferente |
| *(nenhum)* | `20260618000000_lotes_pastagem_id_uuid.sql` | Aplicada no banco (confirmado: `lotes.pastagem_id` já é `uuid`), mas nunca registrada em `schema_migrations` — foi aplicada via SQL direto, não via `supabase db push` |

## Estratégia de correção escolhida

Conforme orientação: **evitar duplicar arquivos com versões diferentes e o mesmo conteúdo.**

1. **Para as 2 migrations com conteúdo já equivalente:** os arquivos locais foram **renomeados** (`git mv`) para o prefixo de versão exato do remoto — sem criar arquivo novo, sem duplicar. Cada um ganhou um comentário no topo explicando a renomeação, para quem ler o histórico não estranhar a data do cabeçalho ("Sprint 10"/"Sprint 21") não bater com o prefixo do nome do arquivo.
2. **Para a migration aplicada mas não registrada (`lotes_pastagem_id_uuid`):** o comando recomendado é `supabase migration repair --status applied 20260618000000`, mas **o Supabase CLI não está instalado/autenticado neste ambiente** (`supabase: command not found`). Como a instrução do projeto foi explícita em não editar `supabase_migrations.schema_migrations` manualmente sem autorização, e eu não tinha autorização separada para isso, o arquivo foi mantido como está (idempotente — seguro rodar de novo, sem efeito, já que o schema já reflete a mudança) com um comentário documentando a limitação. **Pendência:** alguém com o Supabase CLI autenticado precisa rodar o `migration repair` para este item ficar 100% reconciliado.
3. **Para a correção de segurança (RLS)**, que exigia uma alteração real no banco: usei a ferramenta `apply_migration` do MCP do Supabase (equivalente a `supabase db push` para uma migration nova), que aplicou o SQL **e já registrou a migration** em `schema_migrations` com a versão `20260623220539`. O arquivo local correspondente (`20260623220539_fix_insecure_insert_policies.sql`) foi criado com o mesmo conteúdo exato que foi aplicado.

## Remoto x Local (depois da correção)

| Remoto (`schema_migrations`) | Local (arquivo) | Situação |
|---|---|---|
| `20260617020950_financial_status_fields` | `20260617020950_financial_status_fields.sql` | ✅ Bate |
| `20260619113446_lote_pastagens_historico` | `20260619113446_lote_pastagens_historico.sql` | ✅ Bate |
| `20260623220539_fix_insecure_insert_policies` | `20260623220539_fix_insecure_insert_policies.sql` | ✅ Bate (nova migration desta sprint) |
| *(nenhum)* | `20260618000000_lotes_pastagem_id_uuid.sql` | ⚠️ Ainda pendente — precisa de `supabase migration repair` com CLI autenticado |

## `supabase migration list`

Não pude rodar o comando real do CLI (não instalado nesta sessão). Usei a ferramenta equivalente do MCP do Supabase (`list_migrations`), que consulta a mesma tabela (`supabase_migrations.schema_migrations`) que o CLI usaria. Resultado já mostrado na tabela acima — 3 das 4 migrations locais agora têm correspondência exata; a 4ª é a pendência documentada.

## O check Supabase Preview deve passar agora?

**Provavelmente sim, para a divergência original** (as 2 migrations com versão trocada agora batem exatamente). A migration nova (`20260623220539`) também tem arquivo local correspondente, então não deve gerar uma nova divergência. A única pendência (`20260618000000` sem registro remoto) é a mesma categoria de problema que causava o erro original — se o check do GitHub for estrito o suficiente para notar "existe um arquivo local sem versão remota correspondente" (e não só o inverso), pode continuar reclamando até alguém rodar o `migration repair`. Recomendo clicar em "Re-run checks" no GitHub para confirmar o resultado real.

## Risco desta reconciliação

Baixo. Nenhum SQL novo foi executado para as 2 renomeações (são só nomes de arquivo); a migration nova foi escrita para ser idempotente e só corrige uma regra de acesso, sem alterar dados. Nada foi resetado, nenhum histórico do Supabase foi editado manualmente.
