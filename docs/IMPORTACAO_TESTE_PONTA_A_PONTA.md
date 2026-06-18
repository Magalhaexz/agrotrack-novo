# Teste E2E — Importação Inicial de Dados e Pesagens

Este documento registra o roteiro de teste ponta a ponta da funcionalidade de importação, com dados fictícios representativos.

**Última execução:** Sprint 20.1 — 2026-06-18  
**Conta de teste:** `qa.sprint28.herdon@example.com` (Proprietário, UUID `59934aca-8a30-490b-900b-9bbbe9a7e506`)  
**Resultado:** ✓ 17/17 registros criados, 0 falhas

---

## Cenário de teste (Sprint 20.1)

| Categoria | Quantidade |
|-----------|-----------|
| Fazendas | 1 |
| Pastos | 2 |
| Lotes | 2 (1 pasto + 1 confinamento) |
| Animais | 4 |
| Pesagens por Lote | 4 |
| Pesagens por Animal | 4 |

---

## Dados fictícios usados no Sprint 20.1

### Aba: Fazendas

| nome | cidade | estado | area_total_ha | observacoes |
|------|--------|--------|---------------|-------------|
| Fazenda Modelo HERDON | Catalão | GO | 950 | Conta de teste Sprint 20.1 |

### Aba: Pastos

| codigo_fazenda | nome | area_ha | observacoes |
|----------------|------|---------|-------------|
| Fazenda Modelo HERDON | Pasto Brejo Grande | 180 | |
| Fazenda Modelo HERDON | Pasto Morro Azul | 220 | |

### Aba: Lotes

| codigo_lote | codigo_fazenda | data_entrada | quantidade_cabecas | peso_inicial_kg | observacoes |
|-------------|----------------|--------------|-------------------|-----------------|-------------|
| HERDON-PASTO-01 | Fazenda Modelo HERDON | 2024-01-15 | 2 | 310 | Sistema pasto – Pasto Brejo Grande |
| HERDON-CONF-02 | Fazenda Modelo HERDON | 2024-02-01 | 2 | 285 | Sistema confinamento |

### Aba: Animais

| brinco | codigo_lote | sexo | peso_inicial_kg | observacoes |
|--------|-------------|------|-----------------|-------------|
| HRD-001 | HERDON-PASTO-01 | macho | 315 | |
| HRD-002 | HERDON-PASTO-01 | macho | 305 | |
| HRD-003 | HERDON-CONF-02 | fêmea | 290 | |
| HRD-004 | HERDON-CONF-02 | fêmea | 280 | |

### Aba: Pesagens_Lotes

| codigo_lote | data_pesagem | peso_medio_kg | quantidade_cabecas | observacoes |
|-------------|--------------|---------------|-------------------|-------------|
| HERDON-PASTO-01 | 2024-03-01 | 345 | 2 | |
| HERDON-PASTO-01 | 2024-04-01 | 378 | 2 | |
| HERDON-PASTO-01 | 2024-05-01 | 412 | 2 | |
| HERDON-CONF-02 | 2024-03-15 | 320 | 2 | |

### Aba: Pesagens_Animais

| brinco | codigo_lote | data_pesagem | peso_kg | observacoes |
|--------|-------------|--------------|---------|-------------|
| HRD-001 | HERDON-PASTO-01 | 2024-03-01 | 348 | |
| HRD-002 | HERDON-PASTO-01 | 2024-03-01 | 342 | |
| HRD-003 | HERDON-CONF-02 | 2024-03-15 | 325 | |
| HRD-004 | HERDON-CONF-02 | 2024-03-15 | 315 | |

---

## Resultado da execução (Sprint 20.1)

### Primeira tentativa — bug identificado e corrigido

A primeira importação criou 15/17 registros. Os 2 pastos falharam silenciosamente.

**Causa raiz (dupla):**
1. `ImportacaoPage.jsx` enviava `fazenda_id: fazendaId` (UUID) mas a coluna correta em `pastagens` é `faz_id` (bigint FK)
2. O campo `metadata` é `NOT NULL jsonb` na tabela `pastagens`, mas o payload não o incluía

**Correção aplicada em `src/pages/ImportacaoPage.jsx` (linhas 282–289):**
```javascript
// Antes (quebrado)
const res = await createOperationalRecord('pastagens', {
  id: gerarNovoId(),
  fazenda_id: fazendaId,   // campo UUID, fazendaId é bigint
  nome: row.nome,
  // sem metadata — coluna NOT NULL
}, session);

// Depois (correto)
const res = await createOperationalRecord('pastagens', {
  faz_id: Number(fazendaId),  // campo bigint FK correto
  nome: row.nome,
  area_ha: parsePositiveNumber(row.area_ha) || null,
  status: 'ativo',
  observacoes: row.observacoes || null,
  metadata: {},               // campo NOT NULL obrigatório
}, session);
```

### Segunda tentativa — 17/17 ✓

Após a correção, reimportação com dados limpos produziu resultado completo:

```
Importação concluída com sucesso
17 registros criados no HERDON

Fazendas:           +1
Pastos:             +2
Lotes:              +2
Animais:            +4
Pesagens por Lote:  +4
Pesagens por Animal: +4
```

---

## Verificação nas telas

| Tela | O que verificar | Resultado |
|------|-----------------|-----------|
| Painel Geral | 4 cabeças ativas, 2 lotes ativos | ✓ |
| Fazendas | "Fazenda Modelo HERDON" visível (Catalão/GO, 950ha, 2 lotes) | ✓ |
| Pastos | "Pasto Brejo Grande" e "Pasto Morro Azul" listados | ✓ |
| Lotes e Rebanho | HERDON-PASTO-01 e HERDON-CONF-02 vinculados à fazenda correta | ✓ |
| Animais (aba Individuais) | HRD-001/002 em HERDON-PASTO-01; HRD-003/004 em HERDON-CONF-02 | ✓ |
| Pesagens (aba Histórico) | 8 pesagens históricas (4 lote + 4 animal) com datas e pesos corretos | ✓ |
| Resultado dos Lotes | Ambos os lotes aparecem na tabela, status Ativo | ✓ |

---

## Teste de duplicatas (Etapa 3)

Reimportando o mesmo arquivo com dados já existentes:

| Resultado esperado | Resultado obtido |
|-------------------|-----------------|
| 8 erros detectados (4 lotes + 4 animais) | ✓ 8 erros |
| Botão "Avançar" desabilitado | ✓ desabilitado |
| Mensagem com aba, linha e campo | ✓ |

**Exemplos de mensagens exibidas:**
- `Linha 2(data_pesagem) — Já existe uma pesagem do lote "HERDON-PASTO-01" em 2024-03-01 cadastrada no HERDON. Remova esta linha ou ajuste a data.`
- `Linha 2(data_pesagem) — Já existe uma pesagem do animal "HRD-001" em 2024-03-01 cadastrada no HERDON. Remova esta linha ou ajuste a data.`

---

## Teste de erros intencionais (Etapa 3)

Arquivo com 4 tipos de erro (um por aba):

| Aba | Linha | Campo | Erro introduzido | Mensagem exibida |
|-----|-------|-------|-----------------|-----------------|
| Pastos | 3 | codigo_fazenda | Fazenda inexistente | Fazenda "Fazenda Inexistente" não encontrada — verifique se o nome está correto ou se está na aba Fazendas |
| Lotes | 2 | peso_inicial_kg | Peso negativo (-50) | "-50" não é um peso válido. Use um número maior que zero |
| Animais | 3 | brinco | Brinco duplicado | Brinco "ERR-DUP" já aparece na linha 2 — cada animal deve ter um brinco único |
| Pesagens_Lotes | 2 | peso_medio_kg | Peso zero | "0" não é um peso válido. Use um número maior que zero |

Todos os 4 erros bloquearam o avanço corretamente, sem salvar nenhum dado.

---

## Análise de falha parcial (Etapa 4)

### Comportamento observado no código

O salvamento é sequencial (Fazendas → Pastos → Lotes → Animais → Pesagens_Lotes → Pesagens_Animais). Cada `createOperationalRecord` roda em try/catch independente:

```javascript
try {
  const res = await createOperationalRecord('pastagens', { ... }, session);
  if (res.data?.id) { /* mapeia ID para uso posterior */ }
  else { falhas.push('Pasto "..."'); }
} catch { falhas.push('Pasto "..."'); }
```

**Consequências de falha parcial:**
- Registros já gravados antes da falha ficam no banco (sem rollback)
- Registros que dependem do registro que falhou também falham (ex: animais de um lote que não foi criado)
- O resultado final mostra contagem de criados e falhas por categoria
- Na reimportação: registros já existentes são bloqueados pelo validador como duplicata; os que falharam são tentados novamente

**Cenário de maior risco:** Fazenda criada, mas os pastos falham. Os lotes são criados vinculados à fazenda (sem pastos). Fica consistente, mas incompleto.

### Avaliação para o beta

- Para volumes pequenos (o caso do Herdon no beta), o risco de falha parcial é baixo
- O usuário tem visibilidade do que foi criado e o que falhou na tela de resultado
- Reimportação do que falhou é segura — o validador detecta duplicatas
- Risco residual: dados parciais que precisam de limpeza manual

### Recomendação futura: RPC atômico

Quando o volume crescer, a solução ideal é um `supabase.rpc('importar_dados', { payload })` que executa tudo dentro de uma transação PostgreSQL:

```sql
BEGIN;
  INSERT INTO fazendas ...;
  INSERT INTO pastagens ...;
  INSERT INTO lotes ...;
  INSERT INTO animais ...;
  INSERT INTO pesagens ...;
COMMIT;
-- ou ROLLBACK em caso de qualquer falha
```

**Vantagens:** tudo-ou-nada, sem registros órfãos, 1 round-trip de rede  
**Trade-off:** requer migration, lógica de validação duplicada no SQL, dificulta retorno de erros por linha/campo

Não implementar agora — o benefício não compensa o custo para o volume do beta.

---

## Limpeza após os testes

Para remover os dados de teste da conta QA (executar em ordem):

```sql
-- Execute no Supabase SQL Editor, na ordem correta (respeita foreign keys)
DELETE FROM pesagens
  WHERE origem = 'importacao'
    AND owner_user_id = '59934aca-8a30-490b-900b-9bbbe9a7e506';

DELETE FROM animais
  WHERE identificacao LIKE 'HRD-%'
    AND owner_user_id = '59934aca-8a30-490b-900b-9bbbe9a7e506';

DELETE FROM lotes
  WHERE nome IN ('HERDON-PASTO-01', 'HERDON-CONF-02')
    AND owner_user_id = '59934aca-8a30-490b-900b-9bbbe9a7e506';

DELETE FROM pastagens
  WHERE faz_id IN (
    SELECT id FROM fazendas
    WHERE nome = 'Fazenda Modelo HERDON'
      AND owner_user_id = '59934aca-8a30-490b-900b-9bbbe9a7e506'
  );

DELETE FROM fazendas
  WHERE nome = 'Fazenda Modelo HERDON'
    AND owner_user_id = '59934aca-8a30-490b-900b-9bbbe9a7e506';
```
