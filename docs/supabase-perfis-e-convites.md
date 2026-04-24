# Perfis automáticos no HERDON

## O que este pacote entrega

- `public.profiles` ligado a `auth.users`
- `public.invites` para pré-definir perfil por e-mail
- trigger em `auth.users` para criar o `profile` automaticamente
- fallback padrão para `visualizador`
- RLS mínima para leitura do próprio profile e gestão de convites por `admin`

## Como aplicar

1. Abra o SQL Editor do Supabase.
2. Rode o arquivo [docs/supabase-perfis-e-convites.sql](D:/agrotrack-novo/docs/supabase-perfis-e-convites.sql).
3. Confirme que as tabelas `public.profiles` e `public.invites` foram criadas.
4. Faça um novo cadastro para validar a criação automática do `profile`.

## Como cadastrar alguém para entrar como gerente automaticamente

Antes do usuário criar a conta, insira um convite com o mesmo e-mail:

```sql
insert into public.invites (email, nome, perfil, status)
values ('gerente@cliente.com', 'Gerente Comercial', 'gerente', 'pendente');
```

Quando esse e-mail se cadastrar no Supabase Auth:

- o trigger vai encontrar o convite
- o `public.profiles.perfil` será salvo como `gerente`
- o convite será marcado como `utilizado`

Se não existir convite prévio, o usuário entra como `visualizador`.

## Como preparar o primeiro admin

Se ainda não existir nenhum `admin`, você pode promover um usuário existente com:

```sql
update public.profiles
set perfil = 'admin'
where email = 'admin@cliente.com';
```

Ou já criar o primeiro acesso por convite:

```sql
insert into public.invites (email, nome, perfil, status)
values ('admin@cliente.com', 'Admin inicial', 'admin', 'pendente');
```

## Perfis suportados

- `admin`
- `gerente`
- `operador`
- `visualizador`

## Observação de rollout

O frontend já tenta ler `profiles` e `invites`. Se a migration ainda não tiver sido aplicada, o app continua funcionando com fallback seguro, mas a automação completa só entra em vigor depois do SQL.
