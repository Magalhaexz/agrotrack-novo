# SPRINT18W1_HARD_FIX_BATCH_WEIGHING_AND_CLOUD_PESAGENS_HERDON

## Objetivo
Hard fix do fluxo de pesagem individual por lote e correção da persistência cloud de `pesagens` para evitar `PATCH ... 400`.

## Correções aplicadas

### 1) Aba real de fluxo
- Arquivo: `src/pages/AcompanhamentoPesoPage.jsx`
- Criada separação explícita por abas:
  - `Pesagem individual por lote`
  - `Histórico de lotes`
- Na aba de pesagem por lote, os campos obrigatórios são exibidos:
  - Fazenda
  - Lote
  - Data da pesagem

### 2) Geração correta de animais por lote
- O total de cabeças do lote agora considera fallback em cadeia:
  - `qtd`, `quantidade`, `quantidade_animais`, `qtd_inicial`, `cabecas`, `total_cabecas`
- Se houver animais faltando:
  - gera somente os índices ausentes (`Animal #N`) até o total do lote
  - não duplica ao clicar novamente
- Cada animal gerado fica vinculado com:
  - `lote_id`
  - `fazenda_id` (quando disponível)
- Persistência cloud-first via `createOperationalRecord('animais', payload, session)`.

### 3) Lançamento de peso individual com progresso parcial
- Para cada animal:
  - campo de peso atual
  - observação opcional
- Regras implementadas:
  - peso numérico quando preenchido
  - peso vazio permitido em progresso
  - `Salvar progresso` persiste somente linhas com peso válido
  - não exige concluir todos os animais

### 4) Hard fix nuvem para pesagens (PATCH 400)
- Arquivo: `src/services/operationalPersistence.js`
- `buildOperationalCreatePayload` ganhou normalização específica para `pesagens`:
  - remove `id` no create
  - força payload compatível
  - inclui `owner_user_id`
  - nunca envia `cloud_id` inválido/null (só inclui se UUID válido)
- `updateOperationalRecord` ganhou suporte a seletores para `pesagens`:
  - `id` (numérico cloud)
  - `cloud_id`
  - `metadata.local_id`
  - `animal_date_tipo` (`animal_id + lote_id + data + tipo`)
  - `lote_date_tipo` (`lote_id + data + tipo`)
- Com isso, o fluxo evita update cego por id local inválido.

### 5) Identidade lógica sem duplicação
- Pesagem individual:
  - chave lógica: `animal_id + lote_id + data + tipo=animal`
- Pesagem de lote (finalização):
  - chave lógica: `lote_id + data + tipo=lote`
- Se existir registro na data:
  - atualiza via seletor seguro
- Se não existir:
  - cria novo registro

### 6) Finalização e resumo
- `Finalizar pesagem do lote`:
  1. salva progresso primeiro
  2. cria/atualiza registro `tipo=lote` com peso médio
  3. atualiza lote:
     - `peso_atual`
     - `peso_medio_atual`
     - `p_at`
     - `ultima_pesagem`
     - `data_ultima_pesagem`
  4. exibe resumo:
     - total de animais
     - animais pesados
     - animais sem pesagem
     - peso médio
     - maior peso
     - menor peso
     - variação
     - data/fazenda/lote
     - ganho/evolução quando houver histórico anterior
     - fallback: `Sem pesagem anterior suficiente para calcular ganho.`

### 7) Logs DEV seguros
- `[HERDON_BATCH_WEIGHING_FLOW]`:
  - `hasSession`, `hasUserId`, `fazendaIdPresent`, `loteIdPresent`, `lotHeadCount`, `existingAnimalCount`, `generatedAnimalCount`, `selectedDate`
- `[HERDON_PESAGEM_CLOUD_SAVE]`:
  - `action`, `tipo`, `syncStatus`, `code`, `safeMessage`, `selectorType`, `payloadKeys`
- Sem exposição de token/JWT/chaves/sessão completa.

## Verificação manual no relatório
1. Lote com 3 cabeças:
- mostrou 3 animais: não validado manualmente neste ciclo
- gerou Animal #1, #2 e #3: não validado manualmente neste ciclo
- duplicou animais ao clicar novamente: não validado manualmente neste ciclo

2. Salvar progresso:
- salvou 2 de 3 pesos: não validado manualmente neste ciclo
- manteve valores após Ctrl + F5: não validado manualmente neste ciclo
- salvou na nuvem: não validado manualmente neste ciclo
- criou pendência: não validado manualmente neste ciclo

3. Finalizar pesagem:
- resumo apareceu: não validado manualmente neste ciclo
- peso médio correto: não validado manualmente neste ciclo
- maior peso correto: não validado manualmente neste ciclo
- menor peso correto: não validado manualmente neste ciclo
- animais sem pesagem correto: não validado manualmente neste ciclo

4. Nuvem:
- PATCH /pesagens ainda retorna 400: não validado manualmente neste ciclo
- code/message se houver erro: não validado manualmente neste ciclo
- pesagens entraram no Supabase: não validado manualmente neste ciclo

5. Estatísticas:
- lote atualizou peso médio: parcialmente validado por código
- gráfico/histórico recebeu registro tipo lote: parcialmente validado por código

## Validação técnica
- `git grep -n -E "^(<<<<<<<|=======|>>>>>>>)" -- .`
  - sem conflitos de merge (sem matches)
- `npm.cmd run build`
  - OK
- `npm.cmd run lint`
  - OK com warnings preexistentes/gerais (0 errors, 34 warnings)
