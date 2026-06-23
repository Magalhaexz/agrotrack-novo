# Backup e Recuperação (Sprint 30)

## O que o Supabase já faz automaticamente

No plano Pro do Supabase (necessário para produção), o próprio provedor faz **backups diários automáticos** do banco Postgres, retidos por um período definido pelo plano. Isso cobre o cenário "o banco corrompeu/perdeu dados" no nível de infraestrutura, sem ação manual — mas **nunca foi testado um restore de fato** neste projeto (ver pendência abaixo).

## Tabelas críticas (prioridade em caso de recuperação parcial)

Se for preciso restaurar/exportar manualmente (não o banco inteiro), por ordem de criticidade:

1. **`profiles`** — sem isso, ninguém consegue logar com o perfil certo.
2. **`customer_subscriptions`** — perda aqui derruba o acesso de todos os clientes pagantes/piloto.
3. **`fazendas`, `lotes`, `animais`, `pesagens`** — dados operacionais centrais; perda é o pior cenário para o cliente.
4. **`movimentacoes_financeiras`, `custos`** — dados financeiros; perda afeta relatórios e decisões do cliente.
5. **`billing_events`, `checkout_sessions`** — histórico de cobrança; importante para suporte/auditoria, menos crítico para o uso diário do app.
6. Demais tabelas operacionais (`pastagens`, `sanitario`, `estoque`, `tarefas`, etc.) — importantes, mas a perda é mais recuperável (cliente pode recadastrar).

## Como exportar dados (export geral, via Supabase)

**Opção 1 — Dashboard do Supabase (mais simples, sem linha de comando):**
1. Acessar o projeto no [supabase.com/dashboard](https://supabase.com/dashboard).
2. Database → Backups → escolher um snapshot → Download (se disponível no plano) ou restaurar diretamente em um novo projeto para inspecionar.

**Opção 2 — `pg_dump` (mais controle, requer acesso à connection string):**
```bash
# Substituir <CONNECTION_STRING> pela string de conexão do projeto (Settings → Database)
pg_dump "<CONNECTION_STRING>" --schema=public --no-owner --no-privileges -f backup_herdon_$(date +%Y%m%d).sql
```
- Nunca rodar isso com a `service_role` key em texto plano em um terminal compartilhado/logado — usar variável de ambiente local, não argumento de linha de comando visível em histórico de shell.
- O dump inclui RLS policies e funções (`app_is_same_account`, etc.) — útil para recriar o ambiente do zero também.

**Opção 3 — Exportar dados de um cliente específico (suporte/atendimento):**
Para exportar só os dados de uma conta (ex.: pedido de portabilidade do cliente, ou investigação de um problema reportado), usar o SQL Editor do Supabase com `service_role` (ou um admin com acesso) filtrando por `owner_user_id`:

```sql
-- Substituir <OWNER_USER_ID> pelo uuid da conta
select * from public.fazendas where owner_user_id = '<OWNER_USER_ID>';
select * from public.lotes where owner_user_id = '<OWNER_USER_ID>';
select * from public.animais where owner_user_id = '<OWNER_USER_ID>';
-- repetir para as demais tabelas relevantes, ou usar \copy no psql para exportar para CSV
```

Cada tabela pode ser exportada para CSV diretamente pela interface do Supabase (Table Editor → ... → Export to CSV), já filtrando pela conta se necessário.

## Como restaurar em emergência

1. **Se for um backup automático do Supabase:** Database → Backups → selecionar o ponto no tempo → "Restore". O Supabase recria um projeto novo a partir do snapshot — **não substitui o projeto atual automaticamente** (varia por plano); é preciso confirmar o fluxo exato na documentação do Supabase no momento da emergência, porque a interface pode mudar.
2. **Se for um dump manual (`pg_dump`):**
   ```bash
   psql "<CONNECTION_STRING_DO_PROJETO_DE_DESTINO>" -f backup_herdon_YYYYMMDD.sql
   ```
   Rodar primeiro em um projeto Supabase **de teste**, nunca direto em produção, para confirmar que o dump restaura sem erro antes de considerar usar em um incidente real.
3. **Depois de qualquer restore:** verificar que RLS continua habilitado em todas as tabelas (`docs/RLS_AUDITORIA_HERDON.md`) — um dump/restore mal feito pode, em teoria, não preservar `force row level security` dependendo das flags usadas.

## Frequência recomendada

- **Automático (Supabase Pro):** diário — já cobre a maior parte do risco, sem ação humana.
- **Manual (export adicional, opcional):** semanal durante o piloto (poucos dados, baixo custo, alta segurança), podendo cair para mensal depois que houver mais clientes e os backups automáticos já estiverem validados.

## Como proteger os backups

- Nunca enviar um dump (`.sql`/`.csv`) por e-mail ou chat sem criptografia — eles contêm dados pessoais e financeiros de clientes reais.
- Se for preciso guardar uma cópia local, usar uma pasta protegida por senha do sistema (BitLocker/FileVault), nunca em uma pasta sincronizada com nuvem pessoal sem senha adicional.
- Apagar dumps locais depois de usados para o que foram gerados (não acumular cópias antigas "por garantia").

## Pendências

- **Testar um restore de ponta a ponta** (Supabase Backups → Restore, em um projeto de teste) — nunca foi feito neste projeto. Recomendado antes de liberar o piloto, para não descobrir um problema de restore só durante um incidente real.
- Automatizar export semanal (script `pg_dump` agendado), se o volume de dados justificar antes de ter clientes pagantes reais — não implementado nesta sprint por ser uma automação nova fora do escopo conservador pedido.
