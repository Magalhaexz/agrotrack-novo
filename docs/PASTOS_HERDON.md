# Pastos — Módulo HERDON

## Estrutura de banco

A tabela no Supabase é `public.pastagens` (não `pastos`). A interface usa "Pastos" como linguagem do usuário.

### Colunas principais

| Coluna | Tipo | Notas |
|--------|------|-------|
| `id` | uuid | PK, `gen_random_uuid()` |
| `owner_user_id` | uuid | Vínculo com conta |
| `faz_id` | bigint | Referência à fazenda (mesmo tipo de `lotes.faz_id`) |
| `nome` | text | NOT NULL |
| `status` | text | Default `'ativa'`; UI usa `'ativo'`/`'inativo'` |
| `area_ha` | numeric | Área em hectares |
| `capacidade_suporte_ua_ha` | numeric | UA por hectare |
| `observacoes` | text | Campo de observação |
| `metadata` | jsonb | NOT NULL, default `{}` |

> **Nota**: A coluna `fazenda_id` (uuid) existe no banco mas não é usada pelo frontend — o vínculo de fazenda é feito exclusivamente via `faz_id` (bigint), que é compatível com `lotes.faz_id` e `fazendas.id`.

### RLS (Row Level Security)

8 policies cobrindo SELECT, INSERT, UPDATE e DELETE:
- `pastagens_select_own` / `pastagens_select_same_account`
- `pastagens_insert_own` / `pastagens_insert_same_account`
- `pastagens_update_own` / `pastagens_update_same_account`
- `pastagens_delete_own` / `pastagens_delete_same_account`

Acesso é restrito ao usuário proprietário ou membros da mesma conta via `app_is_same_account()`.

### Permissões frontend

Definidas em `src/auth/perfis.js`:
- `pastagens:ver` — proprietário, gerente, operador, visualizador
- `pastagens:editar` — proprietário, gerente
- `pastagens:excluir` — proprietário, gerente

---

## Fluxo Fazenda → Pasto → Lote

```
Fazendas
  └── Pastos (N pastagens por fazenda, via faz_id)
        └── Lotes (1 pasto atual por lote, via pastagem_id text)
```

1. O usuário cadastra a fazenda
2. O usuário cadastra os pastos vinculados à fazenda em **Operação > Pastos**
3. Ao criar/editar um lote em **sistema = 'pasto'**, o campo "Pasto atual" exibe apenas os pastos da fazenda selecionada
4. Se nenhum pasto estiver cadastrado para a fazenda, o campo exibe mensagem orientativa

### Filtragem de pastos por fazenda (LoteForm)

```js
pastagens.filter((p) => {
  const fazId = p?.fazenda_id ?? p?.faz_id ?? null;
  return !fazId || String(fazId) === String(form.faz_id);
});
```

Ao trocar de fazenda, o pasto selecionado é automaticamente limpo se não pertencer à nova fazenda.

### Obrigatoriedade condicional

| sistema | pastagem_id obrigatório? |
|---------|--------------------------|
| `'pasto'` | Sim (se há pastos cadastrados para a fazenda) |
| `'confinamento'` | Não |
| `'semi-confinamento'` | Não |

---

## Migration aplicada — Sprint 18

**Motivo**: `lotes.pastagem_id` era `bigint`, mas `pastagens.id` é `uuid`. O vínculo nunca funcionou.

```sql
ALTER TABLE public.lotes
ALTER COLUMN pastagem_id TYPE text USING pastagem_id::text;
```

Aplicada em: 2026-06-18. Segura porque:
- `pastagem_id` não tinha FK
- `pastagens` tinha 0 registros
- Nenhum dado depende da coluna

---

## Navegação

Adicionado em Sprint 18:
- Seção: Operação
- ID: `pastagens`
- Label: **Pastos**
- Ícone: `Tractor`
- Posição: entre Fazendas e Lotes e Rebanho

---

## Pendência futura — Histórico de movimentação

Nesta sprint, o sistema registra apenas o **pasto atual** do lote. Não há histórico de movimentação.

### Proposta de tabela futura: `lote_pastagens_historico`

```sql
CREATE TABLE lote_pastagens_historico (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid,
  lote_id       bigint NOT NULL,
  pastagem_id   text NOT NULL,  -- UUID da pastagem
  data_entrada  date NOT NULL,
  data_saida    date,
  motivo        text,
  observacoes   text,
  created_at    timestamptz DEFAULT now()
);
```

**Quando implementar**: quando houver necessidade de rastrear rotação de pastos, descanso de pastagens ou planejamento de rotação. Não faz parte da Sprint 18.
