# Role QA — Fluxo de Funcionários e Equipe

> Sprint 4 · Etapa 6 · Gerado em 2026-06-15  
> Análise via código (`perfis.js`, `userAccess.js`) e Supabase RLS

---

## Resumo executivo

| Role | Código frontend OK? | RLS OK? | Invite funciona? |
|------|--------------------|---------|--------------------|
| `proprietario` | ✅ | ✅ | ❌ Bug crítico |
| `gerente` | ✅ | ✅ | ❌ Bug crítico |
| `operador` | ✅ | ✅ | — (gerente/proprietário convida) |
| `visualizador` | ✅ | ✅ | — (gerente/proprietário convida) |

**Bug crítico:** `app_can_manage_account` verifica roles em lowercase mas a tabela armazena `'PROPRIETARIO'` (maiúsculas) → nenhum usuário consegue gerenciar convites. Ver [SUPABASE_HOMOLOGACAO.md](SUPABASE_HOMOLOGACAO.md) seção 7.

---

## Mapa de roles

### Definição em `src/auth/perfis.js`

```js
PERFIS.PROPRIETARIO = 'proprietario'  // também aceita alias 'admin'
PERFIS.GERENTE      = 'gerente'
PERFIS.OPERADOR     = 'operador'
PERFIS.VISUALIZADOR = 'visualizador'
```

### Normalização

`normalizarPerfil(bruto)` converte para lowercase e resolve aliases:
- `'PROPRIETARIO'` → `'proprietario'` ✅
- `'admin'` → `'proprietario'` ✅ (alias)
- `'Administrator'` → `'proprietario'` (via lowercase + alias)
- Qualquer valor desconhecido → `'visualizador'` (fallback seguro)

---

## Permissões por role

| Permissão | Proprietário | Gerente | Operador | Visualizador |
|-----------|:-----------:|:-------:|:--------:|:------------:|
| Dashboard | ✅ | ✅ | ✅ | ✅ |
| Fazendas ver | ✅ | ✅ | ❌ | ✅ |
| Fazendas editar | ✅ | ✅ | ❌ | ❌ |
| Lotes ver/editar | ✅ | ✅ | ✅ | ✅/❌ |
| Animais movimentar | ✅ | ✅ | ✅ | ❌ |
| Pesagens editar | ✅ | ✅ | ✅ | ❌ |
| Sanitário editar | ✅ | ✅ | ✅ | ❌ |
| Estoque movimentar | ✅ | ✅ | ✅ | ❌ |
| Financeiro ver | ✅ | ✅ | ❌ | ✅ |
| Financeiro editar | ✅ | ✅ | ❌ | ❌ |
| Configurações editar | ✅ | ✅ | ❌ | ❌ |
| Funcionários ver | ✅ | ✅ | ❌ | ✅ |
| Acessos gerenciar | ✅ | ✅ | ❌ | ❌ |
| Resultados/Comparativo | ✅ | ✅ | ✅ | ✅ |
| Cenários editar | ✅ | ✅ | ✅ | ❌ |
| Dados importar/limpar | ✅ | ✅ | ❌ | ❌ |

Proprietário: permissão `['*']` — acesso total.

---

## Fluxo de convite (estado atual)

### O que deveria acontecer

```
1. Proprietário/Gerente → FuncionariosPage → "Convidar funcionário"
2. App → POST /invites (INSERT na tabela invites)
3. Convidado recebe email → aceita convite
4. Supabase trigger cria profile com perfil e owner_user_id do proprietário
5. Funcionário faz login → acessa dados da conta do proprietário
```

### O que acontece hoje

```
2. App → INSERT em invites
   └─ Policy: WITH CHECK app_can_manage_account(owner_user_id)
   └─ app_can_manage_account checa: app_current_profile_role() in ('proprietario', 'gerente')
   └─ app_current_profile_role() retorna 'PROPRIETARIO' (maiúsculas do trigger)
   └─ 'PROPRIETARIO' in ('proprietario', 'gerente') → FALSE (case-sensitive)
   └─ INSERT BLOQUEADO → erro de RLS
```

**O invite nunca é criado.** A FuncionariosPage pode mostrar mensagem de erro ou falhar silenciosamente.

### Correção necessária (Sprint 4 — Etapa 10)

```sql
CREATE OR REPLACE FUNCTION public.app_can_manage_account(target_owner_user_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN public.app_is_same_account(target_owner_user_id)
    AND lower(coalesce(public.app_current_profile_role(), '')) IN ('proprietario', 'gerente', 'admin');
END;
$$;
```

---

## QA por role — o que testar quando o bug for corrigido

### Proprietário

| Passo | Esperado |
|-------|---------|
| Login | Acesso total — todas as páginas visíveis |
| Criar fazenda | ✅ |
| Criar lote | ✅ |
| Registrar movimentação financeira | ✅ |
| Convidar funcionário | ✅ (após correção do bug) |
| Ver página de funcionários | ✅ |
| Acessar configurações | ✅ |

### Gerente

| Passo | Esperado |
|-------|---------|
| Login como gerente (após convite aceito) | Acesso às páginas de gerente |
| Tentar acessar configurações da conta | ✅ (tem `configuracoes:ver` e `configuracoes:editar`) |
| Convidar outro funcionário | ✅ (tem `acessos:gerenciar`) |
| Ver financeiro | ✅ |
| Deletar fazenda | ⚠️ Verificar — não está explícito nas permissões de gerente |

### Operador

| Passo | Esperado |
|-------|---------|
| Login como operador | Acesso a lotes, animais, pesagens, sanitário, estoque |
| Tentar acessar `/financeiro` | ❌ Deve ser bloqueado (`financeiro:ver` não está em operador) |
| Tentar editar fazenda | ❌ Deve ser bloqueado |
| Registrar pesagem | ✅ |
| Registrar movimentação de estoque | ✅ |

### Visualizador

| Passo | Esperado |
|-------|---------|
| Login como visualizador | Acesso somente leitura |
| Tentar criar lote | ❌ Deve ser bloqueado |
| Ver dashboard | ✅ |
| Ver financeiro | ✅ (tem `financeiro:ver`) |
| Tentar editar qualquer coisa | ❌ Deve ser bloqueado |

---

## Isolamento de conta — testes RLS

| Teste | Método | Esperado |
|-------|--------|---------|
| Funcionário de conta A tenta acessar dados de conta B | `app_is_same_account` verifica `owner_user_id` | ❌ Deve falhar |
| Convite criado para conta A aparece para conta B | Policy `invites` usa `app_can_manage_account` | ❌ Deve falhar |
| Perfil de funcionário de conta A visível para conta B | Policy `profiles_select_same_account` | ❌ Deve falhar |

---

## Estado do banco — profiles para funcionários

Quando um funcionário aceita o convite, um profile é criado com:
- `id` = UID do funcionário (auth.uid)
- `perfil` = role do convite (ex: `'operador'`)
- `owner_user_id` = UID do proprietário da conta

`app_is_same_account()` então valida que `app_current_owner_user_id()` do funcionário = `owner_user_id` dos dados → acesso correto.

**Atenção:** se o perfil do funcionário for criado com `perfil = 'OPERADOR'` (maiúsculas), o mesmo bug de case afeta o frontend. `normalizarPerfil` resolve isso no frontend, mas `app_current_profile_role()` retornaria `'OPERADOR'` (maiúsculas) para o DB.

---

## Critério de aceite

| Critério | Status |
|---------|--------|
| Proprietário consegue enviar convite | ❌ Bloqueado por bug — corrigir em Etapa 10 |
| Funcionário aceita convite e faz login | ⬜ Testar após correção |
| Funcionário tem acesso apenas ao escopo do role | ⬜ Testar manualmente |
| Funcionário não acessa dados de outra conta | ⬜ Testar com dois usuários |
