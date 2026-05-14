# SPRINT22H1_AUDIT_LOTES_ANIMAIS_DATA_MODEL_HERDON

## 1. Resumo executivo
Este sprint realizou **somente auditoria técnica e documentação** do modelo atual de dados e dependências entre `lotes`, `animais`, `pesagens`, `retiradas`, `sanitario`, `movimentacoes_financeiras`, relatórios e dashboard.

Principais achados:
- O modelo atual trata `animais` em dois modos: **grupo por lote** e **individual**, com `lote_id` como vínculo central.
- Pesagens por animal já suportam criação automática de animais “virtuais” (`Animal #N`) e posterior persistência em `animais` + `pesagens`.
- Retiradas e encerramento de lote dependem fortemente de quantidade/cabeças agregadas por lote e movimentações.
- Cálculos e telas de Resultados/Dashboard/Relatórios assumem a estrutura legada (`animais` vinculados por `lote_id` + alias de quantidade/cabeças).
- `operationalPersistence` é majoritariamente table-agnostic e já possui suporte por tabela via lista operacional.

Sem alterações funcionais, sem alterações de schema, sem migrações.

---

## 2. Modelo atual de Lotes
### Campos e usos observados
- Identidade/vínculos: `id`, `faz_id`, `nome`, `status`.
- Operação: `tipo`, `sistema`, `entrada`, `saida`, `data_encerramento`, `data_venda`, `motivo_encerramento`.
- Quantidade/cabeças (aliases usados em múltiplos pontos):
  - `qtd`, `quantidade`, `quantidade_animais`, `qtd_inicial`, `cabecas`, `total_cabecas`, `heads`, `indicators.totalAnimais`, `resumo.totalAnimais`.
- Peso/GMD:
  - `p_ini`, `p_at`, `peso_atual`, `peso_medio_atual`, `ultima_pesagem`, `gmd_meta`, `peso_alvo`.
- Financeiro:
  - `investimento`, `custo_fixo_mensal`, `preco_arroba`, `rendimento_carcaca`, `outras_desp_pc_mes`.
- Metadados/observações:
  - `obs` (compatibilidade histórica), `metadata` em persistência cloud.

### Status e fazenda
- Status normalizado em telas para `ativo`, `encerrado`, `vendido`.
- Fazenda resolvida via `faz_id -> fazendas[id]`.

---

## 3. Modelo atual de Animais
### Cadastro e natureza do registro
- Cadastro em `AnimaisPage` + `AnimalForm`.
- `tipo_registro` define comportamento:
  - `grupo` (agregado por lote, `qtd > 1`)
  - `individual` (`qtd = 1`, identificação específica).

### Campos principais
- `lote_id`, `tipo_registro`, `identificacao`, `sexo`, `gen`, `qtd`, `p_ini`, `p_at`, `dias`, `consumo`, `status`, `observacao`, `rendimento_carcaca`, `preco_arroba`, `data_referencia`.
- Possível `metadata` com `index`, `local_id`, `generated_from_weighing`.

### Uso de lote_id e risco de duplicação
- `lote_id` é chave de agregação nas páginas de lote/pesagem.
- Risco de duplicação quando geração automática por pesagem cria `Animal #N` em lotes com lacunas de índice.

### Geração automática por pesagem
- Fluxo `animal_batch` cria animais faltantes por índice virtual e grava pesagens individuais associadas.

---

## 4. Como Pesagens dependem de Lotes/Animais
- Dois modos:
  1. Pesagem por lote (`tipo='lote'`)
  2. Pesagem por animal (`tipo='animal'`/`origem='animal'`).
- Chaves usadas: `lote_id` (sempre), `animal_id` (animal individual), metadata auxiliar para fallback de identificação.
- Histórico unificado mostra lote + animal/fallback (`Animal #N`) e variação apenas para pesagem de lote.
- Recalculo de lote após pesagem de lote atualiza `p_at`, `peso_atual`, `peso_medio_atual`, `ultima_pesagem`.

### Riscos em refatoração
- Quebrar resolução de identidade (id/cloud/local_id) no histórico.
- Quebrar batch animal com virtual rows e atualização idempotente por data.

---

## 5. Como Retirada/Encerramento depende de Lotes/Animais
- Retirada reduz cabeças no lote com base em quantidade agregada e registra em `movimentacoes_animais`.
- Encerramento/venda altera status do lote e datas (`data_encerramento`/`data_venda`).
- Venda/saída pode gerar impacto financeiro via `movimentacoes_financeiras` em fluxos de movimentação.
- Dependência majoritária é em **quantidade por lote**; não exige exclusivamente animais individuais.

---

## 6. Como Sanitário depende de Lotes/Animais
- Predominância de manejo por lote (`lote_id`) com registros em `sanitario`.
- Há reaproveitamento de registros IATF e agenda reprodutiva baseada em lote.
- Dependência por animal individual é limitada no fluxo principal atual.

---

## 7. Como Financeiro/Relatórios/Dashboard dependem de Lotes/Animais
- Financeiro usa `movimentacoes_financeiras` e cruza por lote/categoria.
- Relatórios esperam estrutura legada com lotes/animais/pesagens agregadas por `lote_id`.
- Dashboard calcula indicadores de rebanho e produtividade a partir de lotes + animais + pesagens + financeiro.
- `getResumoLote` e cálculos de lote usam aliases de quantidade/cabeças e peso médio.

---

## 8. Persistência atual
### operationalPersistence
- Padrão table-agnostic para create/update/delete com lista de tabelas operacionais suportadas.
- Tabelas operacionais incluem: `lotes`, `animais`, `pesagens`, `sanitario`, `movimentacoes_animais`, `movimentacoes_financeiras`, etc.
- Caminho futuro seguro para `animals` e `animal_lote_allocations`:
  1. adicionar novas tabelas na lista operacional,
  2. manter compatibilidade via view/adapter,
  3. migrar telas gradualmente.

---

## 9. Supabase/migrations encontrados
- **Não existe** pasta `supabase/migrations` no repositório atual.
- SQL/documentação encontrados em `docs/` e markdowns de contrato/schema:
  - `SUPABASE_SCHEMA_CONTRACT_HERDON.md`
  - `SUPABASE_LOTES_FUNCIONARIOS_SCHEMA_FIX_HERDON.md`
  - `docs/supabase-perfis-e-convites.sql`
  - `docs/supabase-perfis-e-convites.md`
- Evidências de tabelas atuais: `animais`, `lotes`, `pesagens`, `movimentacoes_financeiras`, `sanitario`, `profiles`, `invites`.

---

## 10. Riscos da refatoração futura
1. Quebrar pesagem por animal (batch/virtual rows).
2. Perder histórico temporal de lote ao migrar vínculo.
3. Duplicar animais ao coexistir `animais` (legado) e `animals` (novo).
4. Quebrar relatórios e dashboard que dependem de alias legados de quantidade/cabeças.
5. Quebrar retirada/encerramento por mudança prematura do contrato `lote_id`.
6. Conflito de sync cloud entre estrutura antiga e nova.
7. Necessidade alta de `view` de compatibilidade durante transição.

---

## 11. Plano recomendado em sprints pequenos
- **22H2**: criar schema Supabase `animals` + `animal_lote_allocations` + RLS + view compatível.
- **22H3**: desacoplar campos de animal do `LoteForm` (sem alterar cálculo).
- **22H4**: cadastro independente de animais (UI e persistência).
- **22H5**: fluxo de alocação animal ↔ lote com histórico.
- **22H6**: adaptação de pesagens/retiradas/relatórios/dashboard para novo modelo com fallback legado.

---

## 12. Arquivos auditados
- `src/pages/LotesPage.jsx`
- `src/components/lotes/*`
- `src/pages/AnimaisPage.jsx`
- `src/components/AnimalForm.jsx`
- `src/pages/PesagensPage.jsx`
- `src/components/PesagemForm.jsx`
- `src/pages/SanitarioPage.jsx`
- `src/pages/FinanceiroPage.jsx`
- `src/pages/ResultadosPage.jsx`
- `src/pages/DashboardPage.jsx`
- `src/services/operationalPersistence.js`
- `src/services/movimentacoes.js`
- `src/domain/resumoLote.js`
- Busca ampla em `src/**` para termos: `animais|animal|lote_id|animal_id|pesagem|pesagens|cabecas|cabeças|quantidade|retirada|encerrar`.

---

## 13. Validação build/lint
Comandos executados:
- `npm run build` ✅
- `npm run lint` ⚠️ (1 warning existente em `PesagemForm.jsx` sobre dependência de hook)
- `rg -n "animais|animal|lote_id|animal_id|pesagem|pesagens|cabecas|cabeças|quantidade|retirada|encerrar" src --glob '*.{js,jsx,ts,tsx}'` ✅
- `rg -n "^(<<<<<<<|=======|>>>>>>>)" src --glob '*.{js,jsx,ts,tsx,css}' || true` ✅ (sem conflitos)

---

## 14. Próximo sprint recomendado
Prosseguir com **SPRINT22H2** para introduzir schema novo (`animals`, `animal_lote_allocations`) em paralelo ao legado, com estratégia expand-and-contract e view de compatibilidade antes de qualquer remoção de campos antigos.
