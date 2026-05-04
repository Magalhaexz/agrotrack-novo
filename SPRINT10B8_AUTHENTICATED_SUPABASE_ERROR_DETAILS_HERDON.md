# Sprint 10B.8 — Expose Authenticated Supabase Error Details and Fix RLS Diagnostics

## 1. Objetivo
Melhorar o diagnóstico de nuvem para expor causa real nas etapas autenticadas (`REST com sessão` e `Supabase client`), incluindo status HTTP, código PostgREST, tipo de falha e mensagem segura.

## 2. Alterações Implementadas

### 2.1 Classificação de erro refinada (`runMinimalCloudDiagnostic`)
Arquivo: `src/services/supabaseDiagnostics.js`

Classificação atual:
- `401` -> **"Sessão inválida ou expirada."**
- `403` / `42501` -> **"Permissão insuficiente. Verifique as políticas RLS no Supabase."**
- `400` / `42703` / `PGRST204` -> **"Estrutura da tabela incompatível com o app."**
- `404` / `PGRST205` / `42P01` -> **"Tabela não encontrada na nuvem."**
- sem resposta / transporte (`timeout`, reset, http2, failed fetch) -> **"Falha de conexão do navegador com o Supabase."**

Cada etapa autenticada já retorna:
- `httpStatus`
- `postgrestCode`
- `failureType`
- `safeMessage`

### 2.2 Detalhe visível por etapa com falha
Arquivo: `src/pages/FazendasPage.jsx`

No botão **"Testar conexão com a nuvem"**, para etapas com erro agora é exibido resumo explícito, por exemplo:
- `REST com sessão: Erro — 403 / RLS`
- `Supabase client: Erro — 42501 / RLS`
- `Supabase client: Erro — 42703 / Coluna ausente`

Para sessão inválida bloqueada:
- `REST com sessão: Bloqueado por sessão inválida`
- `Supabase client: Bloqueado por sessão inválida`

### 2.3 Log seguro por falha autenticada
Arquivo: `src/pages/FazendasPage.jsx`

Adicionado grupo:
- `[HERDON_CLOUD_AUTH_REQUEST_DETAIL]`

Campos emitidos:
- `step`
- `table`
- `endpointPath`
- `httpStatus`
- `postgrestCode`
- `failureType`
- `safeMessage`

Sem exposição de tokens, headers de autorização ou sessão completa.

## 3. Checks SQL Recomendados no Supabase

### 3.1 Verificar se RLS está habilitado
```sql
select schemaname, tablename, rowsecurity
from pg_tables
where schemaname = 'public'
  and tablename in ('fazendas', 'lotes');
```

### 3.2 Inspecionar políticas aplicadas
```sql
select schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
from pg_policies
where schemaname = 'public'
  and tablename in ('fazendas', 'lotes')
order by tablename, policyname;
```

### 3.3 Validar colunas-chave esperadas
```sql
select table_name, column_name, data_type
from information_schema.columns
where table_schema = 'public'
  and table_name in ('fazendas', 'lotes')
  and column_name in ('id', 'owner_user_id', 'cloud_id', 'metadata')
order by table_name, column_name;
```

### 3.4 Política recomendada baseada em owner_user_id/auth.uid()
Exemplo de critério esperado em `USING` e `WITH CHECK`:
```sql
owner_user_id = auth.uid()
```

Se houver mismatch entre `owner_user_id` gravado no registro e `auth.uid()` da sessão ativa, a falha típica será `403/42501`.

## 4. Validação

### Build
- `npm.cmd run build` -> **OK**

### Lint
- `npm.cmd run lint` -> **OK** (sem erros; warnings preexistentes de hooks)

## 5. Impacto
- Sync de Fazendas preservado
- Sync de Lotes preservado
- Fallback local/offline preservado
- Sem exposição de segredos em logs
