# Teste E2E — Importação Inicial de Dados e Pesagens

Este documento registra o roteiro de teste ponta a ponta da funcionalidade de importação, com dados fictícios representativos.

## Cenário de teste

| Categoria | Quantidade |
|-----------|-----------|
| Fazendas | 1 |
| Pastos | 2 |
| Lotes | 2 |
| Animais | 4 |
| Pesagens por Lote | 3 |
| Pesagens por Animal | 4 |

---

## Dados fictícios

### Aba: Fazendas

| nome | cidade | estado | area_total_ha | observacoes |
|------|--------|--------|---------------|-------------|
| Fazenda Teste E2E | Uberlândia | MG | 800 | Importação de teste |

### Aba: Pastos

| codigo_fazenda | nome | area_ha | observacoes |
|----------------|------|---------|-------------|
| Fazenda Teste E2E | Pasto Norte | 200 | |
| Fazenda Teste E2E | Pasto Sul | 150 | |

### Aba: Lotes

| codigo_lote | codigo_fazenda | data_entrada | quantidade_cabecas | peso_inicial_kg | observacoes |
|-------------|----------------|--------------|-------------------|-----------------|-------------|
| LOTE-E2E-01 | Fazenda Teste E2E | 2024-01-10 | 2 | 300 | |
| LOTE-E2E-02 | Fazenda Teste E2E | 2024-02-01 | 2 | 280 | |

### Aba: Animais

| brinco | codigo_lote | sexo | peso_inicial_kg | observacoes |
|--------|-------------|------|-----------------|-------------|
| E2E-001 | LOTE-E2E-01 | macho | 310 | |
| E2E-002 | LOTE-E2E-01 | macho | 290 | |
| E2E-003 | LOTE-E2E-02 | fêmea | 285 | |
| E2E-004 | LOTE-E2E-02 | fêmea | 275 | |

### Aba: Pesagens_Lotes

| codigo_lote | data_pesagem | peso_medio_kg | quantidade_cabecas | observacoes |
|-------------|--------------|---------------|-------------------|-------------|
| LOTE-E2E-01 | 2024-02-10 | 340 | 2 | |
| LOTE-E2E-01 | 2024-03-10 | 375 | 2 | |
| LOTE-E2E-02 | 2024-03-10 | 315 | 2 | |

### Aba: Pesagens_Animais

| brinco | codigo_lote | data_pesagem | peso_kg | observacoes |
|--------|-------------|--------------|---------|-------------|
| E2E-001 | LOTE-E2E-01 | 2024-02-10 | 345 | |
| E2E-002 | LOTE-E2E-01 | 2024-02-10 | 335 | |
| E2E-003 | LOTE-E2E-02 | 2024-03-10 | 320 | |
| E2E-004 | LOTE-E2E-02 | 2024-03-10 | 310 | |

---

## Roteiro de execução

### Etapa 1 — Primeira importação (deve criar tudo)

1. Acesse **Importação** no menu lateral
2. Baixe o modelo `.xlsx`
3. Preencha as 6 abas com os dados acima
4. Salve e envie o arquivo
5. Verifique a tela de revisão:
   - Aba Fazendas: 0 erros, 1 linha
   - Aba Pastos: 0 erros, 2 linhas
   - Aba Lotes: 0 erros, 2 linhas
   - Aba Animais: 0 erros, 4 linhas
   - Aba Pesagens_Lotes: 0 erros, 3 linhas
   - Aba Pesagens_Animais: 0 erros, 4 linhas
6. Confirme a importação
7. Verifique o resultado:
   - Fazendas criadas: **+1**
   - Pastos criados: **+2**
   - Lotes criados: **+2**
   - Animais criados: **+4**
   - Pesagens por Lote criadas: **+3**
   - Pesagens por Animal criadas: **+4**

**Verificação no banco (Supabase):**
```sql
SELECT nome FROM fazendas WHERE nome = 'Fazenda Teste E2E';
SELECT nome FROM lotes WHERE nome IN ('LOTE-E2E-01', 'LOTE-E2E-02');
SELECT identificacao FROM animais WHERE identificacao LIKE 'E2E-%';
SELECT tipo, data, peso_medio FROM pesagens WHERE origem = 'importacao' ORDER BY tipo, data;
```

Resultados esperados:
- 1 fazenda, 2 lotes, 4 animais
- 7 pesagens com `origem = 'importacao'` (3 tipo='lote', 4 tipo='animal')

---

### Etapa 2 — Segunda importação com o mesmo arquivo (duplicatas devem ser bloqueadas)

1. Envie **o mesmo arquivo** novamente
2. Na tela de revisão, verifique:
   - Aba Pesagens_Lotes: **3 erros** — uma por linha, indicando conflito com data já cadastrada
   - Aba Pesagens_Animais: **4 erros** — uma por linha, indicando conflito com data já cadastrada
3. O botão "Avançar" deve estar **desabilitado**
4. Não é possível confirmar a importação enquanto houver erros

**Mensagem esperada (exemplo para Pesagens_Lotes, linha 2):**
> Já existe uma pesagem do lote "LOTE-E2E-01" em 2024-02-10 cadastrada no HERDON. Remova esta linha ou ajuste a data.

---

### Etapa 3 — Importação parcial (só cadastro, sem pesagens)

1. Use o mesmo arquivo mas **apague todas as linhas** das abas Pesagens_Lotes e Pesagens_Animais (mantendo apenas os cabeçalhos)
2. Envie o arquivo
3. Na revisão: 0 erros em todas as abas
4. Confirme a importação
5. Resultado esperado:
   - Fazendas: **+0** (já existe)
   - Pastos: **+0** (já existem)
   - Lotes: **+0** (já existem)
   - Animais: **+0** (já existem)
   - Pesagens: **+0** (abas vazias)

---

### Etapa 4 — Navegação pós-importação

Após uma importação bem-sucedida, verifique que os atalhos do resultado funcionam:
- Clique em **Fazendas** → deve abrir a lista de fazendas com "Fazenda Teste E2E" visível
- Clique em **Lotes** → deve mostrar "LOTE-E2E-01" e "LOTE-E2E-02"
- Clique em **Animais** → deve listar E2E-001 a E2E-004
- Clique em **Pesagens** → deve mostrar as pesagens com origem 'importacao'

---

### Etapa 5 — Validações de erro (testes de rejeição)

Teste individualmente cada cenário de erro para garantir que o sistema bloqueia:

| Cenário | Aba | Campo | Mensagem esperada |
|---------|-----|-------|-------------------|
| Nome da fazenda em branco | Fazendas | nome | "O nome da fazenda é obrigatório" |
| Fazenda não cadastrada no pasto | Pastos | codigo_fazenda | "Fazenda '...' não encontrada" |
| Código de lote duplicado | Lotes | codigo_lote | "Código '...' já aparece na linha..." |
| Data inválida no lote | Lotes | data_entrada | "Data inválida. Use o formato AAAA-MM-DD..." |
| Quantidade de cabeças com decimal | Lotes | quantidade_cabecas | "não é uma quantidade válida. Use um número inteiro..." |
| Brinco duplicado | Animais | brinco | "Brinco '...' já aparece na linha..." |
| Lote não encontrado no animal | Animais | codigo_lote | "Lote '...' não encontrado" |
| Peso zero na pesagem | Pesagens_Lotes | peso_medio_kg | "não é um peso válido. Use um número maior que zero" |
| Pesagem duplicada no arquivo | Pesagens_Lotes | codigo_lote | "Já existe uma pesagem para o lote '...' na data..." |

---

## Limpeza após os testes

Para remover os dados de teste do ambiente:

```sql
-- Execute na ordem correta (respeitar foreign keys)
DELETE FROM pesagens WHERE origem = 'importacao' AND lote_id IN (
  SELECT id FROM lotes WHERE nome IN ('LOTE-E2E-01', 'LOTE-E2E-02')
);
DELETE FROM animais WHERE identificacao LIKE 'E2E-%';
DELETE FROM lotes WHERE nome IN ('LOTE-E2E-01', 'LOTE-E2E-02');
DELETE FROM pastagens WHERE fazenda_id = (
  SELECT id FROM fazendas WHERE nome = 'Fazenda Teste E2E'
);
DELETE FROM fazendas WHERE nome = 'Fazenda Teste E2E';
```

---

## Estratégia de salvamento — perguntas técnicas

**Atômico ou sequencial?**
Sequencial. Cada registro é inserido individualmente via `createOperationalRecord`. Não há transação de banco envolvendo todos os registros de uma importação.

**O que acontece em falha parcial?**
Os registros já gravados ficam. Os que falharam são listados na tela de resultado. Nenhum rollback é feito. O usuário pode reimportar — registros já existentes são ignorados automaticamente.

**Rollback manual:**
Execute as queries de limpeza acima no painel Supabase (Table Editor ou SQL Editor).

**Isolamento por usuário:**
Toda gravação passa pelo `createOperationalRecord`, que injeta o `owner_user_id` da sessão autenticada. As políticas RLS do Supabase garantem que cada usuário acessa apenas seus próprios dados.

**Segurança no frontend:**
A chave de serviço do Supabase (`service_role_key`) **nunca** é usada no frontend. Todo acesso ao banco usa a `anon_key` com as políticas RLS ativas. O `createOperationalRecord` usa a sessão JWT do usuário autenticado.

**Erros exibidos ao usuário:**
Por linha e campo, em linguagem simples, com instrução de como corrigir. Nenhum jargão técnico ("RLS", "constraint", "foreign key") aparece na interface.
