# Equipe e Permissões — HERDON

> Sprint 6: "Página de Equipe e Permissões"
> Data: 2026-07-04 · Branch `main` · Banco: Supabase `ljpiszxicmmuefbiixui`

## 1. Diagnóstico (antes desta sprint)

A infraestrutura de papéis/permissões já existia quase inteira (`src/auth/perfis.js`, `src/services/accessControl.js`, RLS `same_account`), mas faltava uma tela dedicada para o proprietário gerenciar quem acessa a conta. Achados do diagnóstico:

- **Já existia uma UI de equipe**, só que embutida como aba "Usuários e Acessos" dentro de `ConfiguracoesPage.jsx`, ligada a `services/userAccess.js` (`listProfiles`, `listInvites`, `createInvite`, `updateInvite`, `deleteInvite`) e às tabelas reais `profiles`/`invites` (confirmadas no Supabase, com RLS `same_account`/`app_can_manage_account` já configurado). Essa aba listava membros e convites, mas **não tinha nenhuma ação de alterar papel ou remover acesso para um membro já aceito** — só o caminho de fallback (tabela local `usuarios`, usado quando `profiles`/`invites` não estão disponíveis) tinha essas ações.
- **Colisão de nome**: o menu lateral já tinha um item chamado "Equipe" (`funcionarios`) — só que é sobre **mão de obra da fazenda** (cargo, status ativo/inativo/desligado), sem nenhuma relação com login/acesso ao sistema. Criar outro item "Equipe" duplicaria o rótulo e confundiria o produtor.
- **`profiles` não tinha coluna de status** e não tem policy de `DELETE` (por desenho) — não havia como marcar um membro já aceito como removido sem apagar a linha (arriscado: perde histórico/auditoria) nem como apagá-la (bloqueado pelo RLS, de propósito).
- **`app_can_manage_account` (RLS)** permitia `proprietario`, `gerente` **e** `admin` gerenciarem convites/perfis/assinatura/cobrança — incompatível com a regra desta sprint ("apenas proprietário/admin gerencia equipe e plano"). O mesmo valia no app: `gerente` tinha `'acessos:gerenciar'` na matriz de `perfis.js`.
- Auditoria de dados: hoje **todo profile é dono da própria conta** (`owner_user_id = id` em 100% das linhas) — não existe nenhum subusuário real em produção ainda. `invites` está vazia. Ou seja, a funcionalidade de equipe é nova na prática, mesmo com parte do código já existindo.

Essas descobertas foram levadas ao usuário antes de codar (rótulo do menu, unificar com a aba existente em vez de duplicar, e a mudança de schema/RLS necessária para "remover acesso" funcionar de verdade) — as três decisões abaixo refletem o que foi combinado.

## 2. Decisões tomadas

1. **Nome no menu**: "Equipe e Acessos" (não "Equipe" puro), para não colidir com o item "Equipe" já existente (Funcionários/mão de obra).
2. **Consolidação**: a aba "Usuários e Acessos" foi **removida de Configurações** e sua lógica foi extraída para a nova página dedicada `EquipePage.jsx` — mesma base de dados/serviço, sem duplicar duas UIs para a mesma coisa. Um atalho ("Abrir Equipe e Acessos") ficou em Configurações para quem for procurar lá.
3. **Migration aditiva** (ver §7) para permitir "remover acesso" de um membro já aceito sem apagar a linha de `profiles`.

## 3. Papéis oficiais

| Papel | Pode |
|---|---|
| **Proprietário/Admin** | Acessa tudo, gerencia a equipe e a assinatura, cria/edita/exclui qualquer dado, vê financeiro. |
| **Gerente** | Gerencia a operação (lotes, pesagens, sanidade, estoque, tarefas) e vê financeiro; **não** altera assinatura nem a equipe. |
| **Operador** | Registra atividades de campo (pesagens, sanidade, estoque, tarefas); **não** acessa cobrança nem gerencia equipe. |
| **Visualizador** | Só consulta — nenhuma permissão `:editar`/`:excluir`/`:movimentar`. |

Essa matriz já existia em `src/auth/perfis.js` (`permissoesPorPerfil`); esta sprint só **removeu** `'acessos:gerenciar'` da lista de Gerente (única mudança na matriz) para cumprir a regra "apenas proprietário/admin gerencia equipe".

## 4. O que foi implementado

| Arquivo | O que é |
|---|---|
| `src/pages/EquipePage.jsx` (novo) | A página: proprietário, membros, convites pendentes, resumo de permissões |
| `src/components/equipe/MembroEquipeCard.jsx` (novo) | Card de um membro: nome, e-mail, papel, data de entrada, status, ações |
| `src/components/equipe/ConviteEquipeModal.jsx` (novo) | Modal de convite (nome, e-mail, papel — só gerente/operador/visualizador) |
| `src/components/equipe/PermissoesPerfilResumo.jsx` (novo) | Resumo fixo do que cada papel pode fazer |
| `src/domain/equipe.js` (novo) | Regras puras: quem pode alterar papel/remover acesso, proteção do único proprietário, resumo de permissões |
| `src/domain/equipe.test.js` (novo, 16 testes) | Cobre a Parte 10 do enunciado (ver §8) |
| `src/services/userAccess.js` | +`updateProfilePerfil`, +`updateProfileStatus`; `status` incluído em `PROFILE_COLUMNS` |
| `src/auth/perfis.js` | Remove `'acessos:gerenciar'` de Gerente; registra `equipeAcessos: 'acessos:gerenciar'` em `permissoesPorPagina` |
| `src/services/subscriptions.js` | `'equipeAcessos'` adicionado a `MODULES_BASIC` (disponível em todos os planos pagos) |
| `src/navigation/navConfig.js` | Item "Equipe e Acessos" na seção "Gestão" |
| `src/App.jsx` | Import lazy + entrada em `pageMap` |
| `src/pages/ConfiguracoesPage.jsx` | Aba "Usuários e Acessos" removida; atalho para a nova página adicionado |
| `supabase/migrations/20260704120000_equipe_profiles_status_and_manage_account_role.sql` (novo) | Ver §7 |

## 5. Convite de membro

Reaproveita a tabela `invites` já existente (confirmada no Supabase antes de qualquer código — **nenhuma tabela nova foi criada** para convites). Fluxo:

1. Proprietário informa nome, e-mail e papel (gerente, operador ou visualizador — **não é possível convidar outro proprietário por aqui**, decisão desta sprint para reduzir risco de conta com múltiplos donos por engano).
2. O app cria uma linha em `invites` com `status: 'pendente'`.
3. **Não há envio de e-mail real** — o convite fica pendente na lista; o papel é aplicado automaticamente quando a pessoa se cadastra com aquele e-mail (mecanismo de aceite já existente na infraestrutura de `invites`, anterior a esta sprint). Envio de e-mail transacional fica como sprint futura (§9).
4. Convite pendente pode ser cancelado (`status: 'cancelado'`) ou removido (`delete`, com fallback para cancelar se o RLS negar o delete).

## 6. Alterar papel / Remover acesso

Ambas as ações passam primeiro por `domain/equipe.js` (puro, testado) antes de qualquer chamada ao Supabase:

- **`podeAlterarPapel`**: só quem tem `'acessos:gerenciar'` pode agir; ninguém pode alterar o próprio papel se isso deixar a conta sem nenhum proprietário/admin ativo; a conta nunca fica com zero administradores.
- **`podeRemoverAcesso`**: mesma checagem de permissão; ninguém remove o próprio acesso; o único proprietário nunca pode ser removido.

Se a checagem local permitir, a página chama `updateProfilePerfil`/`updateProfileStatus` (`services/userAccess.js`), que fazem `UPDATE` em `profiles` — a RLS (`profiles_update_self_or_manager` + `app_can_manage_account`) valida de novo no banco que quem está de fato autenticado tem permissão, então a checagem do frontend é conveniência de UX, não a única barreira de segurança. Toda alteração de papel e remoção de acesso gera um evento em `eventos_operacionais` via `createAuditEvent` (mesmo mecanismo de auditoria já usado por Configurações).

**Remover acesso não apaga a linha de `profiles`** — marca `status = 'removido'` (ver §7). O membro deixa de aparecer na lista de "Membros da equipe" (vai para uma seção separada "Acessos removidos") e o histórico/auditoria continuam íntegros.

## 7. Migration aplicada (aditiva, sem perda de dado)

Arquivo: `supabase/migrations/20260704120000_equipe_profiles_status_and_manage_account_role.sql`. Duas mudanças, ambas confirmadas com o usuário antes de aplicar:

1. `alter table public.profiles add column if not exists status text not null default 'ativo'` + `check (status in ('ativo','removido'))`. Nenhuma linha existente muda de comportamento (default `'ativo'` preenche tudo). Nenhuma tabela dropada, nenhuma coluna removida, nenhum dado apagado.
2. `app_can_manage_account(target_owner_user_id)` (função `SECURITY DEFINER` usada pelas policies de `profiles`, `invites`, `billing_events`, `checkout_sessions`, `customer_subscriptions`) deixou de aceitar `'gerente'` — agora só `'proprietario'`/`'admin'`. Consequência direta e desejada: gerente também deixa de conseguir gravar em tabelas de cobrança/assinatura, reforçando "gerente não altera plano" no próprio banco, não só na UI. **Confirmado antes de aplicar**: não existe nenhum profile com `perfil='gerente'` em produção hoje, então o impacto imediato é zero.

**Nenhuma outra policy de RLS foi tocada.** Login, Asaas e as tabelas operacionais (lotes, pesagens, etc.) não foram alterados.

## 8. Testes (`src/domain/equipe.test.js`, 16 casos)

Cobre exatamente a Parte 10 do enunciado: admin gerencia equipe · gerente não gerencia (após a mudança desta sprint) · operador não gerencia · visualizador não gerencia · subusuário herda o status comercial do proprietário (reaproveitando `buildAccountAccessGate`, sem duplicar a regra) · visualizador não tem nenhuma permissão de escrita mesmo com assinatura ativa · não permite remover o único proprietário (self e defesa em profundidade para ator externo) · não permite ao único proprietário rebaixar o próprio papel · permite as mesmas ações quando há um segundo administrador · resumo de permissões usa o texto exato pedido · `separarProprietarioEMembros` isola a raiz da conta corretamente.

`tests/perfis.test.js`/`tests/userAccess-role-fallback.test.js` já eram escritos de forma defensiva (comparando contra a própria matriz em vez de um valor fixo) e continuaram passando sem alteração após a mudança da matriz — só o título de um teste foi ajustado para não ficar desatualizado ("gerente gerencia" → "conforme a matriz").

## 9. Como isto se encaixa na venda (ver também `docs/PRONTIDAO_COMERCIAL_HERDON.md`)

Gestão de equipe é um recurso comercialmente relevante: planos vendem "N usuários" (`canInviteUser`/limite do plano, já existente), e até esta sprint não havia como o proprietário efetivamente adicionar/remover pessoas fora do fallback local. Subusuários continuam herdando o status comercial do proprietário via `owner_user_id`/RLS `same_account` — nada mudou nessa herança, só ficou mais fácil de gerenciar quem está na conta.

## 10. Limites e próximos passos

- **Convite por e-mail real não foi implementado** — o convite fica pendente na lista até a pessoa se cadastrar com aquele e-mail; não há disparo de e-mail transacional. Próxima sprint, se houver necessidade comercial.
- **"Remover acesso" marca `status='removido'` mas não derruba uma sessão já aberta nem bloqueia escrita em tempo real**: isso exigiria alterar o gate de acesso central (`App.jsx`/`accessControl.js`), que é código crítico de login/sessão — fora do escopo desta sprint por exigir diagnóstico dedicado (mesma régua já usada para não mexer em RLS/login sem necessidade). Hoje, um membro removido some da lista de membros ativos e (se o RLS de outras tabelas também checar o status no futuro) perde acesso no próximo login; **até lá, o efeito imediato é apenas de gestão/registro, não de bloqueio instantâneo**. Documentado aqui para não ser lido como "removido = trancado na hora".
- **Convidar um segundo proprietário não é possível pela tela** (decisão desta sprint) — se for necessário, hoje só via alteração direta de papel de um membro já existente para "Proprietário".
- Nenhuma mudança de RLS além da descrita em §7; nenhuma migration destrutiva; nenhum dado apagado.
