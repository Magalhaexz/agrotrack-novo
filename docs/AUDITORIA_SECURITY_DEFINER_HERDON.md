# Auditoria diagnóstica — Funções `SECURITY DEFINER` (Supabase HERDON)

**Tipo:** auditoria exclusivamente diagnóstica. Nenhuma alteração foi feita no banco, em RLS, em `search_path`, em índices ou no frontend.
**Projeto Supabase:** HERDON (`ljpiszxicmmuefbiixui`)
**Branch:** `audit/sprint7-security-definer-rpc` (criado a partir de `origin/main` atualizado — não reutiliza o branch da correção de estoque)
**Escopo:** todas as funções `SECURITY DEFINER` acessíveis por `anon` e/ou `authenticated`, mais o inventário completo para contexto.

---

## 1. Resumo executivo

O HERDON usa um padrão consistente de duas camadas para isolar contas:

1. **RLS em todas as tabelas de negócio**, sempre exigindo `app_is_same_account(owner_user_id)` — uma função que resolve a conta real do chamador a partir de `auth.uid()` (nunca de um parâmetro do cliente).
2. **RPCs `SECURITY DEFINER`** para operações compostas (criar lote, registrar saída, ajustar lotação, etc.), que recebem `p_owner_user_id` do cliente mas o **validam** logo na primeira linha via `app_assert_owner_write(p_owner_user_id)`, e além disso revalidam cada FK (`lote_id`, `faz_id`, `pastagem_id`, `destino_lote_id`) com `AND owner_user_id = p_owner_user_id` na própria consulta — ou seja, mesmo que o `owner_user_id` informado seja o do próprio atacante, qualquer `id` de outra conta simplesmente não é encontrado.

Testado ao vivo (transações com `ROLLBACK`, nenhum dado alterado): **todas as 6 tentativas de acesso/alteração entre contas foram bloqueadas**, e o caminho legítimo (mesma conta) funciona normalmente. Nenhuma das 24 funções usa SQL dinâmico — logo, não há vetor de SQL injection nelas.

Dois pontos **não** seguem esse padrão com segurança suficiente e foram classificados **P1**:

- **`app_can_access_fazenda`** — quando chamada isoladamente (inclusive por `anon`, sem login), retorna `true` para a fazenda de **qualquer conta**, sempre que o perfil do chamador não tem `fazenda_id` restrito (caso de praticamente todo proprietário de conta). Isso foi confirmado empiricamente. Ela não causa vazamento de dados hoje porque **todas** as ~40 policies que a usam a combinam com `app_is_same_account(owner_user_id) AND`, mas é uma função pública frágil: uma única policy ou RPC futura que a use sozinha abriria acesso cruzado real.
- **`handle_new_user_profile`** (trigger em `auth.users`) — ao criar uma conta nova, vincula automaticamente o perfil a um convite pendente só por correspondência de e-mail (case-insensitive), **no momento do INSERT em `auth.users`**, que ocorre a cada tentativa de cadastro — inclusive antes de qualquer confirmação de e-mail. Não foi possível confirmar, via SQL, se o projeto exige confirmação de e-mail antes de emitir sessão (essa configuração não é uma tabela do Postgres). Isso determina se o risco é apenas de "convite consumido antes da hora" (baixo impacto) ou de **acesso real à conta antes da posse comprovada do e-mail** (impacto alto).

Nenhum **P0** foi confirmado: nenhuma função permitiu, nos testes realizados, ler ou alterar dado de outra conta.

---

## 2. Quantidade total de funções

| Escopo | Quantidade |
|---|---|
| Funções `SECURITY DEFINER` no schema `public` (aplicação HERDON) | **24** |
| Funções `SECURITY DEFINER` em schemas de infraestrutura do Supabase (`pgbouncer`, `vault`) — fora da lógica de negócio, sem `EXECUTE` para `anon`/`authenticated` | 3 |
| **Total no banco** | **27** |

O restante deste relatório cobre as **24 funções de aplicação**. As 3 funções de infraestrutura (`pgbouncer.get_auth`, `vault.create_secret`, `vault.update_secret`) foram checadas apenas para confirmar que não têm `EXECUTE` para `anon`/`authenticated` — não fazem parte do modelo de contas do HERDON.

## 3. Quantidade por classificação

| Classificação | Quantidade | Funções |
|---|---|---|
| **P0** | 0 | — |
| **P1** | 2 | `app_can_access_fazenda`, `handle_new_user_profile` |
| **P2** | 0 | — |
| **OK** | 18 | ver tabela §4 |
| **N/A** | 4 | `set_cenario_eventos_owner`, `set_cenarios_owner`, `set_pastagens_owner`, `validar_integridade_conta_fazenda` |

---

## 4. Tabela completa

Legenda de permissões: **A**=`anon`, **U**=`authenticated`, **S**=`service_role`, **P**=`PUBLIC` (grant explícito além dos roles de aplicação). Todas as 24 funções pertencem a `postgres` e têm `search_path` fixo (`public` ou `public, auth`) — nenhuma com `search_path` vazio ou dinâmico.

| Função | Exec (A/U/S/P) | RPC exposta? | search_path | Tabelas lidas | Tabelas escritas | Valida owner_user_id? | Valida fazenda_id? | Risco | Evidência |
|---|---|---|---|---|---|---|---|---|---|
| `aceitar_convite_equipe(p_invite_id)` | –/U/S/– | Sim | `public` | `invites`, `auth.users` (só o próprio e-mail) | `profiles` (só a própria linha), `invites` | Não recebe; usa `auth.uid()` + match de e-mail | N/A (define, não recebe) | **OK** | Testado: convite de outra conta/e-mail → `email_nao_corresponde` |
| `ajustar_lotacao_lote(p_owner_user_id, p_lote_id, ...)` | –/U/S/– | Sim | `public` | `lotes` | `lotes`, `movimentacoes_animais` | Sim (`app_assert_owner_write`) + recheck de linha | Indireto (via lote) | **OK** | Testado: `owner_user_id` de outra conta → bloqueado; `lote_id` de outra conta → bloqueado; mesma conta → sucesso |
| `app_assert_owner_write(p_owner_user_id)` | –/U/S/– | Sim (helper) | `public` | `profiles` (via funções aninhadas) | nenhuma | Sim, é a própria validação | — | **OK** | Código: bloqueia tudo que não seja `service_role` ou mesma conta+permissão de escrita |
| `app_can_access_fazenda(target_fazenda_id)` | A/U/S/P | Sim | `public` | `profiles` (próprio) | nenhuma | Não | **Não valida propriedade real da fazenda** — só compara com `fazenda_id` do próprio perfil, e retorna `true` se este for `null` | **P1** | Testado: `anon` e usuário autenticado sem `fazenda_id` restrito → `true` para fazenda de outra conta |
| `app_can_manage_account(target_owner_user_id)` | A/U/S/P | Sim | `public` | `profiles` (próprio) | nenhuma | Sim (via `app_is_same_account`) + exige perfil admin/proprietário | — | **OK** | Testado: `anon` → `false` |
| `app_current_fazenda_id()` | A/U/S/P | Sim | `public` | `profiles` (próprio) | nenhuma | N/A (leitura do próprio estado) | — | **OK** | Testado: `anon` → `null` |
| `app_current_owner_user_id()` | A/U/S/P | Sim | `public` | `profiles` (próprio) | nenhuma | N/A | — | **OK** | Testado: `anon` → `null` |
| `app_current_profile_role()` | A/U/S/P | Sim | `public` | `profiles` (próprio) | nenhuma | N/A | — | **OK** | Testado: `anon` → `null` |
| `app_current_role_can_write()` | A/U/S/P | Sim | `public` | `profiles` (próprio, via função aninhada) | nenhuma | N/A | — | **OK** | Testado: `anon` → `false` |
| `app_is_same_account(target_owner_user_id)` | A/U/S/P | Sim | `public` | `profiles` (próprio) | nenhuma | Sim — é o gate central usado por ~40 policies de RLS | — | **OK** | Testado: `anon` → `false`; base de todas as policies revisadas |
| `criar_lote_completo(p_owner_user_id, p_faz_id, ...)` | –/U/S/– | Sim | `public` | `fazendas`, `pastagens` | `lotes`, `animais`, `pesagens`, `lote_pastagens_historico` | Sim (`app_assert_owner_write`) + recheck de fazenda/pasto | Sim — `fazendas`/`pastagens` revalidadas com `owner_user_id = p_owner_user_id` | **OK** | Testado: `faz_id` de outra conta → `Fazenda não encontrada ou não pertence à sua conta` |
| `editar_ultima_pesagem_lote(p_owner_user_id, p_pesagem_id, ...)` | –/U/S/– | Sim | `public` | `pesagens`, `lotes` | `pesagens`, `lotes` | Sim (`app_assert_owner_write`) + recheck de linha | Indireto (via lote) | **OK** | Código idêntico ao padrão testado em `ajustar_lotacao_lote`; não executado ao vivo nesta rodada |
| `excluir_ultima_pesagem_lote(p_owner_user_id, p_pesagem_id)` | –/U/S/– | Sim | `public` | `pesagens`, `animais`, `lotes` | `pesagens` (delete), `lotes` | Sim (`app_assert_owner_write`) + recheck de linha | Indireto (via lote) | **OK** | Mesma observação acima |
| `finalizar_lote(p_owner_user_id, p_lote_id, ...)` | –/U/S/– | Sim | `public` | `lotes` | `lotes` | Sim (`app_assert_owner_write`) + recheck de linha | Indireto (via lote) | **OK** | Mesma observação acima |
| `handle_new_user_profile()` (trigger em `auth.users`) | A/U/S/P (grant de trigger, não chamável direto) | Não via RPC — **mas dispara automaticamente a cada signup público** | `public, auth` | `invites` | `profiles`, `invites` | N/A (é quem define o `owner_user_id` da conta nova) | N/A | **P1** | Vínculo por e-mail em texto, sem prova de posse antes do INSERT. Config. "Confirm email" não verificável via SQL — ver §7 |
| `mover_lote_para_pasto_bot(p_owner_user_id, p_lote_id, ...)` | –/U/S/– | Sim | `public` | `lotes`, `pastagens` | `lote_pastagens_historico`, `lotes` | Sim (`app_assert_owner_write`) + recheck de linha | Sim — pasto de destino deve pertencer à mesma conta e à mesma fazenda do lote | **OK** | Código revisado; mesmo padrão testado em `ajustar_lotacao_lote` |
| `parear_telegram_por_codigo(p_code, ...)` | –/–/S/– | Não (só `service_role`, via webhook) | `public` | `telegram_connection_codes` | `telegram_connections`, `telegram_connection_codes` | Não recebe `owner_user_id`/`fazenda_id` do cliente — vêm do código de pareamento já validado (não usado, não expirado) | Idem | **OK** | Código revisado; identificadores sensíveis vêm da linha do código, nunca de parâmetro |
| `registrar_entrada_estoque_telegram(p_owner_user_id, ...)` | –/–/S/– | Não (só `service_role`) | `public` | `estoque` | `estoque`, `movimentacoes_estoque` | `app_assert_owner_write` **não valida quando o papel é `service_role`** — confiança total no chamador | Indireto (via item) | **OK** | Confirmado (leitura de código, sem alterar nada): `p_owner_user_id` é resolvido no backend (`api/telegram-webhook.js`) a partir de `telegram_connections` pelo `chat_id` do Telegram, nunca de texto digitado pelo usuário; webhook exige segredo (`fail closed`) |
| `registrar_saida_estoque_telegram(p_owner_user_id, ...)` | –/–/S/– | Não (só `service_role`) | `public` | `estoque` | `estoque`, `movimentacoes_estoque`, `movimentacoes_financeiras` | Mesma observação acima | Indireto (via item) | **OK** | Mesma evidência acima |
| `registrar_saida_lote(p_owner_user_id, p_lote_id, ...)` | –/U/S/– | Sim | `public` | `lotes` | `movimentacoes_animais`, `lotes`, `animais`, `movimentacoes_financeiras` | Sim (`app_assert_owner_write`) + recheck de linha (origem e destino) | Indireto (via lote origem/destino) | **OK** | Código revisado; mesmo padrão testado em `ajustar_lotacao_lote` |
| `set_cenario_eventos_owner()` (trigger) | A/U/S/P (não chamável direto) | Não | `public` | — | `cenario_eventos` (via NEW, só se `owner_user_id` vier nulo) | Só preenche se nulo; RLS (`with_check`) revalida depois | — | **N/A** | Testado: chamada direta → erro do Postgres "trigger functions can only be called as triggers" |
| `set_cenarios_owner()` (trigger) | A/U/S/P (não chamável direto) | Não | `public` | — | `cenarios` (idem) | Idem | — | **N/A** | Idem |
| `set_pastagens_owner()` (trigger) | A/U/S/P (não chamável direto) | Não | `public` | — | `pastagens` (idem) | Idem | — | **N/A** | Testado diretamente: mesmo erro do Postgres |
| `validar_integridade_conta_fazenda()` (trigger) | A/U/S/P (não chamável direto) | Não | `public` | `lotes`, `fazendas`, `estoque`, `animais` | nenhuma (só valida, lança exceção) | Bloqueia se FK referenciada pertencer a outra conta | Sim, para `fazenda_id`/`faz_id` | **N/A** | Defesa adicional; só impede, nunca concede acesso |

## 5. Detalhamento dos itens P1

### 5.1 `app_can_access_fazenda(target_fazenda_id bigint)` — P1

**O que faz:** `select app_current_fazenda_id() is null or target_fazenda_id is null or target_fazenda_id = app_current_fazenda_id()`.

**Por que é um problema:** todo perfil de proprietário/administrador de conta (e qualquer membro sem restrição de fazenda) tem `fazenda_id = null` no próprio perfil. Como o primeiro termo do `OR` é `app_current_fazenda_id() is null`, a função retorna `true` **para qualquer `target_fazenda_id`**, de qualquer conta, sempre que o chamador não tem fazenda fixa — o que é a maioria dos casos de uso reais do HERDON.

**Evidência (testado, com `ROLLBACK`, nada alterado):**
- `anon` (sem login nenhum) chamando `app_can_access_fazenda(<fazenda de outra conta>)` → **`true`**.
- Usuário autenticado real (proprietário, `fazenda_id = null` no próprio perfil) chamando com o `fazenda_id` de outra conta → **`true`**.

**Por que não é P0 hoje:** todas as ~40 RLS policies revisadas que a chamam sempre a combinam como `app_is_same_account(owner_user_id) AND app_can_access_fazenda(fazenda_id)`. Como `app_is_same_account` já exige que a linha pertença à conta do chamador, o `OR` permissivo de `app_can_access_fazenda` nunca chega a ser decisivo nessas policies. Não foi encontrado nenhum lugar (RLS ou RPC) onde ela seja usada sozinha.

**Risco residual:** é uma função pública (`anon` incluso), com uma lógica que responde errado a uma pergunta de segurança ("este usuário pode acessar esta fazenda?"). Qualquer código futuro — uma nova policy, uma nova RPC, ou até um uso direto no frontend para decidir o que mostrar — que confie nela isoladamente reintroduz acesso cruzado real.

### 5.2 `handle_new_user_profile()` (trigger `on auth.users after insert`) — P1

**O que faz:** ao ser criado um novo usuário em `auth.users` (isto é, a cada tentativa de cadastro, autenticada ou não — cadastro é uma ação pública), a função procura um convite `pendente`, não expirado, cujo `email` bate (case-insensitive) com o e-mail informado no cadastro. Se encontrar, cria o perfil já com o `owner_user_id`, `fazenda_id` e `perfil` do convite — sem qualquer prova adicional de que quem está se cadastrando é o dono real daquele e-mail.

**Por que é um problema em potencial:** o gatilho dispara no `INSERT` em `auth.users`, que ocorre no momento da requisição de cadastro — **antes** de qualquer confirmação de e-mail (clique no link de verificação). Se a política de autenticação do projeto permitir login/sessão válida antes da confirmação, um atacante que soubesse (ou adivinhasse) que `fulano@empresa.com` foi convidado para uma conta HERDON poderia se cadastrar com esse mesmo e-mail e herdar imediatamente o `owner_user_id`/`fazenda_id`/`perfil` do convite, obtendo acesso à conta e à fazenda de outra pessoa.

**O que foi confirmado:**
- O código da função usa apenas `new.email` (o valor fornecido no cadastro) e `lower(email) = lower(invite.email)` — não há verificação de posse do e-mail dentro da própria função.
- Existe pelo menos 1 usuário em `auth.users` com e-mail não confirmado há mais de 1 dia (de 36 usuários totais, 35 confirmados) — confirma que contas não confirmadas **conseguem ser criadas e persistir**, ou seja, o gatilho já roda para elas independentemente de confirmação.

**O que não foi possível confirmar:** se o projeto exige confirmação de e-mail antes de emitir uma sessão válida (JWT utilizável pela API) — essa é uma configuração do serviço de Auth do Supabase (`Confirm email`), não uma tabela do Postgres, e não há tabela `auth.config` acessível via SQL neste projeto hospedado. Essa configuração é o fator decisivo entre:
- **Confirmação obrigatória e reforçada no login:** o vínculo à conta convidada acontece, mas o atacante não consegue efetivamente logar e usar a API antes de confirmar o e-mail (que ele não possui) — impacto limitado a "convite consumido/perfil pré-criado indevidamente", sem exposição de dados.
- **Confirmação não obrigatória, ou sessão emitida antes da confirmação:** o atacante ganha acesso real e imediato aos dados da conta e fazenda do convite — **isso elevaria a classificação para P0**.

## 6. O que foi testado ao vivo (todas as transações terminaram em `ROLLBACK`; nenhum dado foi alterado)

| # | Cenário | Resultado |
|---|---|---|
| 1 | Usuário autenticado da conta A chama `ajustar_lotacao_lote` informando `owner_user_id` da conta B | **Bloqueado** — erro 42501 "Não pertence à sua conta." |
| 2 | Usuário autenticado da conta A chama `ajustar_lotacao_lote` com o próprio `owner_user_id`, mas `lote_id` pertencente à conta B | **Bloqueado** — erro 42501 "Lote não encontrado ou não pertence à sua conta." |
| 3 | Usuário autenticado da conta A chama `criar_lote_completo` com `faz_id` pertencente à conta B | **Bloqueado** — erro 42501 "Fazenda não encontrada ou não pertence à sua conta." |
| 4 | Chamada anônima (`anon`, sem JWT) a `ajustar_lotacao_lote` | **Bloqueado** no nível de `GRANT` — "permission denied for function", nem chega a executar o corpo da função |
| 5 | Usuário autenticado da conta A chama `ajustar_lotacao_lote` no próprio lote, com dados válidos (controle positivo) | **Permitido** — confirma que a função não está apenas bloqueando tudo; reversão confirmada (saldo do lote e contagem de movimentações intactos após o `ROLLBACK`) |
| 6 | Usuário autenticado da conta A chama `aceitar_convite_equipe` com o `id` de um convite pendente de e-mail/conta diferentes | **Bloqueado** — retorna `sucesso=false, motivo='email_nao_corresponde'` |
| 7 | Chamada direta (fora de contexto de trigger) a `set_pastagens_owner()` | **Bloqueado** pelo próprio Postgres — "trigger functions can only be called as triggers" |
| 8 | `app_can_access_fazenda` chamada isoladamente por `anon` e por usuário autenticado sem fazenda restrita, com `fazenda_id` de outra conta | **Retornou `true`** nos dois casos (achado P1, ver §5.1) |
| 9 | Leitura direta via RLS (não RPC): usuário autenticado da conta A tenta contar linhas de `lotes` da conta B | **0 linhas retornadas** — RLS isola corretamente mesmo com a falha isolada do item 8 |

Consultas de apoio usadas (todas `SELECT` de metadados, sem efeito): `pg_proc`/`pg_namespace`/`pg_roles` para inventário e permissões; `has_function_privilege(...)` para grants por papel; `pg_policies` para as ~40 policies que usam `app_can_access_fazenda`; `pg_settings` (sem resultado — configuração do PostgREST não fica em GUC neste projeto); `auth.users` (contagem agregada de confirmação, sem expor e-mails).

## 7. Ordem recomendada de correção

1. **`app_can_access_fazenda`** — trocar o `OR ... is null` por uma checagem real de propriedade (ex.: `exists (select 1 from fazendas f where f.id = target_fazenda_id and f.owner_user_id = app_current_owner_user_id())`), preservando a semântica de "sem fazenda restrita = vê todas as fazendas **da própria conta**".
2. **Confirmar a configuração "Confirm email" do projeto** (Painel Supabase → Authentication → Settings) — isso decide se `handle_new_user_profile` é P1 (mitigado) ou P0 (explorável). Esta verificação não depende de nenhuma migration e pode ser feita imediatamente.
3. Se a confirmação de e-mail não for obrigatória (ou não bloquear sessão), endurecer `handle_new_user_profile` para só vincular ao convite após confirmação (`new.email_confirmed_at is not null`), ou mover o vínculo para um passo explícito pós-confirmação — a decidir em sprint de correção, não nesta auditoria.
4. Sem mais achados P0/P1 pendentes após os dois itens acima.

## 8. Divisão proposta em sprints pequenas (apenas proposta — nenhuma execução nesta auditoria)

- **Sprint A (1 função, baixo risco de regressão):** corrigir `app_can_access_fazenda` isoladamente + rodar a suíte de testes de RLS existente (`docs/RLS_AUDITORIA_HERDON.md` e migrations de RLS já existentes) para confirmar que nenhuma policy muda de comportamento observável (já que hoje ela nunca é decisiva sozinha).
- **Sprint B (config + trigger, depende da resposta do item 2):** ajustar `handle_new_user_profile` conforme a configuração de confirmação de e-mail confirmada.
- **Sprint C (opcional, não é vulnerabilidade confirmada):** revisar a política de "último pareamento vence" em `parear_telegram_por_codigo` (rebind silencioso quando o mesmo `user_id` do Telegram usa um novo código) — comportamento observado, não é acesso cruzado, mas pode confundir o dono da conta anterior.

## 9. O que não foi possível confirmar

- **Configuração "Confirm email" / exigência de confirmação antes de sessão válida** — não existe tabela `auth.config` acessível via SQL neste projeto Supabase hospedado; requer checagem manual no Painel (Authentication → Settings) ou via Management API, fora do escopo desta auditoria SQL.
- **Entropia e taxa de expiração/tentativas do código de pareamento do Telegram** (`telegram_connection_codes.code`) — o código em si (comprimento, alfabeto, geração) não está no corpo da função `parear_telegram_por_codigo`, e não foi localizado nem inspecionado o gerador nesta auditoria (fora do escopo "funções SECURITY DEFINER").
- **Uso de `app_can_access_fazenda` no frontend** — não foi feita revisão de frontend nesta auditoria (fora do escopo definido). Não é possível garantir que nenhum componente cliente decida algo relevante de segurança confiando apenas no retorno dessa função sem uma policy de RLS por trás.
- **Exposição de schemas adicionais ao PostgREST** — a lista de schemas expostos pela API (`public`, e possivelmente outros) é uma configuração do serviço, não uma tabela; confirmou-se indiretamente que `public` está exposto (os avisos do linter do Supabase citam URLs `/rest/v1/rpc/<função>` para funções deste schema), mas não foi possível consultar a lista completa de schemas expostos via SQL.
- **`editar_ultima_pesagem_lote`, `excluir_ultima_pesagem_lote`, `finalizar_lote`, `mover_lote_para_pasto_bot`, `registrar_saida_lote`** — tiveram o código-fonte integralmente revisado e seguem exatamente o mesmo padrão testado ao vivo em `ajustar_lotacao_lote`/`criar_lote_completo` (mesma função `app_assert_owner_write` + recheck de linha), mas **não foram individualmente executados** nesta rodada de testes (por economia de chamadas); o padrão é idêntico e a validação estrutural foi feita por leitura de código, não por execução.
