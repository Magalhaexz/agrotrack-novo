# Importação Inicial de Dados e Pesagens

Esta funcionalidade permite cadastrar fazendas, pastos, lotes, animais e pesagens históricas de uma só vez, a partir de uma planilha Excel.

## Quando usar

Use a importação quando você está começando a usar o HERDON e quer trazer dados que já existem em planilhas ou outros sistemas. Para lançamentos do dia a dia, use os formulários normais.

## Quem pode importar

Proprietários e Gerentes têm acesso à importação. Operadores e Visualizadores não.

---

## Passo a passo

### 1. Baixar o modelo

Acesse **Importação** no menu lateral e clique em **Baixar modelo .xlsx**.

O modelo tem 6 abas:

| Aba | O que vai aqui |
|-----|----------------|
| Fazendas | Nome, cidade, estado e área de cada fazenda |
| Pastos | Nome e área de cada pasto, vinculado a uma fazenda |
| Lotes | Código, fazenda, data de entrada, quantidade e peso inicial |
| Animais | Brinco (identificação), lote, sexo e peso inicial |
| Pesagens_Lotes | Pesagens históricas por lote (peso médio, data) |
| Pesagens_Animais | Pesagens históricas por animal individual (brinco, data, peso) |

### 2. Preencher o modelo

Abra o arquivo no Excel ou Google Sheets e substitua os dados de exemplo pelos seus dados reais. Regras importantes:

- **Não mude os nomes das colunas** — eles são usados para identificar os campos
- **Não mude os nomes das abas** — eles são usados para identificar cada tipo de dado
- As abas de pesagens são **opcionais** — deixe-as em branco se não tiver histórico
- Salve sempre como **.xlsx** (Excel moderno)

### 3. Enviar o arquivo

De volta no HERDON, clique em "Já tenho o arquivo preenchido" (ou avance após baixar o modelo) e arraste o arquivo ou clique para selecioná-lo.

### 4. Revisar os dados

O HERDON verifica tudo antes de salvar. Se houver algum problema, ele mostra exatamente em qual linha e campo está o erro e o que você precisa corrigir.

Se não houver erros, o botão "Avançar" fica habilitado.

### 5. Confirmar a importação

Você vê um resumo do que será criado. Confirme para iniciar o processo.

Os dados são salvos nesta ordem: Fazendas → Pastos → Lotes → Animais → Pesagens por Lote → Pesagens por Animal. Isso garante que cada registro possa referenciar os anteriores corretamente.

---

## Campos por aba

### Fazendas

| Campo | Obrigatório | Formato |
|-------|-------------|---------|
| nome | Sim | Texto |
| cidade | Não | Texto |
| estado | Não | Texto (ex: MG, GO, MT) |
| area_total_ha | Não | Número maior que zero |
| observacoes | Não | Texto livre |

### Pastos

| Campo | Obrigatório | Formato |
|-------|-------------|---------|
| codigo_fazenda | Sim | Nome exato da fazenda (aba Fazendas ou já cadastrada) |
| nome | Sim | Texto |
| area_ha | Não | Número maior que zero |
| observacoes | Não | Texto livre |

### Lotes

| Campo | Obrigatório | Formato |
|-------|-------------|---------|
| codigo_lote | Sim | Texto único (não repita na mesma planilha) |
| codigo_fazenda | Sim | Nome exato da fazenda |
| data_entrada | Sim | AAAA-MM-DD ou DD/MM/AAAA |
| quantidade_cabecas | Sim | Número inteiro maior que zero |
| peso_inicial_kg | Sim | Número maior que zero |
| observacoes | Não | Texto livre |

### Animais

| Campo | Obrigatório | Formato |
|-------|-------------|---------|
| brinco | Sim | Identificação única do animal |
| codigo_lote | Sim | Código do lote (aba Lotes ou já cadastrado) |
| sexo | Não | macho / fêmea |
| peso_inicial_kg | Não | Número maior que zero |
| observacoes | Não | Texto livre |

### Pesagens_Lotes

| Campo | Obrigatório | Formato |
|-------|-------------|---------|
| codigo_lote | Sim | Código do lote |
| data_pesagem | Sim | AAAA-MM-DD ou DD/MM/AAAA |
| peso_medio_kg | Sim | Número maior que zero |
| quantidade_cabecas | Não | Número inteiro maior que zero |
| observacoes | Não | Texto livre |

Restrição: não pode haver duas pesagens do mesmo lote na mesma data (nem na planilha, nem conflitando com o que já está no HERDON).

### Pesagens_Animais

| Campo | Obrigatório | Formato |
|-------|-------------|---------|
| brinco | Sim | Brinco do animal (aba Animais ou já cadastrado) |
| codigo_lote | Não | Código do lote (para referência) |
| data_pesagem | Sim | AAAA-MM-DD ou DD/MM/AAAA |
| peso_kg | Sim | Número maior que zero |
| observacoes | Não | Texto livre |

Restrição: não pode haver duas pesagens do mesmo animal na mesma data.

---

## Comportamento em casos especiais

**Registro já existe:** Fazendas, lotes e animais que já existem no HERDON pelo mesmo nome/código são pulados — não são duplicados nem atualizados.

**Pesagem já existe:** Se já existe uma pesagem para o mesmo lote/animal na mesma data, o HERDON bloqueia a linha na etapa de revisão. Você deve remover a linha ou corrigir a data antes de confirmar.

**Falha parcial:** Se algum registro não puder ser salvo (ex: instabilidade de conexão), os demais continuam normalmente. O resultado final mostra o que foi importado e o que não pôde ser salvo.

**Dados de datas do Excel:** O modelo aceita tanto datas digitadas (AAAA-MM-DD ou DD/MM/AAAA) quanto datas que o Excel armazena internamente como número serial — ambos são convertidos automaticamente.

---

## Limitações

- O arquivo deve ser o modelo oficial do HERDON (`.xlsx`)
- Planilhas de outros sistemas precisam ter os dados copiados para o modelo
- Não há limite de linhas por aba, mas importações muito grandes podem levar alguns minutos
- A importação não substitui registros existentes — apenas cria novos

---

## Estratégia de salvamento

O salvamento é sequencial e não atômico: cada registro é gravado individualmente. Se a conexão cair no meio do processo, os registros já gravados ficam salvos. Você pode reimportar o que ficou pendente — registros duplicados são automaticamente ignorados.

Não há rollback automático. Se precisar desfazer uma importação, os registros devem ser excluídos manualmente pelas telas de gerenciamento.

A chave de serviço do banco de dados nunca é exposta ao navegador — toda gravação passa pela camada de segurança normal do HERDON, com isolamento por conta de usuário.
