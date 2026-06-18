# Sprint 20 — Resultado

## Funcionalidade entregue

**Importação Inicial de Dados e Pesagens**

Assistente guiado em 4 passos (Modelo → Envio → Revisão → Confirmação) para importar fazendas, pastos, lotes, animais e pesagens históricas a partir de uma planilha Excel real (`.xlsx`).

---

## O que foi construído

### Arquivos novos

| Arquivo | Descrição |
|---------|-----------|
| `src/pages/ImportacaoPage.jsx` | Interface completa do assistente de importação (wizard 4 passos + resultado) |
| `src/utils/importParser.js` | Lógica de domínio: leitura, template e validação da planilha |
| `tests/importParser.test.js` | 75 testes unitários do domínio de importação |
| `docs/IMPORTACAO_DADOS_HERDON.md` | Documentação voltada ao usuário final |
| `docs/IMPORTACAO_TESTE_PONTA_A_PONTA.md` | Roteiro de teste E2E com dados fictícios |

### Arquivos modificados

| Arquivo | O que mudou |
|---------|-------------|
| `src/lucide-react.js` | Adicionados ícones: AlertCircle, Download, FileUp, Upload |
| `src/navigation/navConfig.js` | Item "Importação" na seção Gestão |
| `src/auth/perfis.js` | Rota `importacao: 'dados:importar'` no mapa de permissões |
| `src/App.jsx` | Lazy import de ImportacaoPage |
| `package.json` | Dependência `xlsx` v0.18.5 adicionada |

---

## Decisões técnicas

### XLSX real (não SpreadsheetML)

A versão anterior gerava `.xls` no formato SpreadsheetML XML, que era lido via `DOMParser` (só funciona no browser). Foi substituído pela biblioteca SheetJS `xlsx` v0.18.5, que:

- Gera `.xlsx` real (Open XML / OOXML), compatível com Excel e Google Sheets sem avisos
- Funciona tanto no browser (Vite) quanto em Node.js (testes unitários)
- Lê seriais de data do Excel automaticamente, convertendo para ISO 8601

### Estrutura do banco de pesagens

Pesagens de lote e pesagens de animal usam a **mesma tabela `pesagens`**, diferenciadas pelo campo `tipo` (`'lote'` | `'animal'`). Não foi criada uma segunda tabela. Campo `origem: 'importacao'` rastreia registros vindos desta feature.

### Validação pura (sem I/O)

`validarPlanilha(parsed, db)` é uma função pura que recebe os dados parseados e o estado do banco. Não faz chamadas à rede. Isso permite testá-la completamente em Node.js sem mocks de ambiente.

### Salvamento sequencial

Os registros são inseridos um a um via `createOperationalRecord`, na ordem: Fazendas → Pastos → Lotes → Animais → Pesagens_Lotes → Pesagens_Animais. Não há transação atômica. Em falha parcial, os registros já gravados ficam salvos.

### Segurança

- `SUPABASE_SERVICE_ROLE_KEY` **não usada no frontend**
- Todo acesso ao banco usa o JWT da sessão autenticada + políticas RLS
- Permissão `dados:importar` requerida (apenas Proprietário e Gerente)

---

## Gates (Sprint 20)

| Gate | Resultado |
|------|-----------|
| `npm test` | ✓ 384 testes, 0 falhas |
| `npm run lint` | ✓ Sem erros |
| `npm run build` | ✓ Build completo em ~600ms |

---

## Sprint 20.1 — Validação E2E Real (2026-06-18)

### Bug corrigido

**`src/pages/ImportacaoPage.jsx` — pastagens não eram salvas**

Causa dupla:
1. Payload enviava `fazenda_id` (UUID) mas a coluna FK é `faz_id` (bigint)
2. Campo `metadata` (NOT NULL jsonb) ausente do payload

Correção: `faz_id: Number(fazendaId)` + `metadata: {}` nas linhas 282–289.

### Resultado do teste E2E

Conta: `qa.sprint28.herdon@example.com` — 17/17 registros criados (0 falhas) após a correção.

| Categoria | Criados |
|-----------|---------|
| Fazendas | +1 |
| Pastos | +2 |
| Lotes | +2 |
| Animais | +4 |
| Pesagens por Lote | +4 |
| Pesagens por Animal | +4 |

Todos os dados verificados nas telas: Painel Geral, Fazendas, Pastos, Lotes e Rebanho, Animais, Pesagens, Resultado dos Lotes.

### Bloqueio de duplicatas

Reimportação do mesmo arquivo → 8 erros detectados (4 pesagens de lote + 4 de animal). Botão "Avançar" desabilitado. Nenhum dado gravado.

### Validação de erros

4 erros intencionais introduzidos (fazenda inexistente, peso negativo, brinco duplicado, peso zero) — todos detectados com mensagem de aba/linha/campo/orientação. Nenhum dado gravado.

### Gates (Sprint 20.1)

| Gate | Resultado |
|------|-----------|
| `npm test` | A executar na Etapa 6 |
| `npm run lint` | A executar na Etapa 6 |
| `npm run build` | A executar na Etapa 6 |

---

## UX — Decisões de linguagem

Nenhum jargão técnico aparece na interface. Substituições feitas:

| Técnico | Interface |
|---------|-----------|
| "parser", "schema", "payload" | removidos |
| "RLS", "foreign key", "constraint" | removidos |
| "SpreadsheetML" | removido |
| "ArrayBuffer", "Uint8Array" | removidos |
| Erro genérico "falha ao processar" | mensagem específica por linha, campo e motivo |

---

## Cobertura de testes unitários

| Módulo | Casos cobertos |
|--------|---------------|
| `normalizeText` | espaços, undefined, null, número |
| `parseDate` | DD/MM/YYYY, YYYY-MM-DD, serial Excel, vazio, inválido |
| `parsePositiveNumber` | positivo, vírgula decimal, zero, negativo, texto |
| `gerarTemplateSheets` | 6 abas, nomes corretos, campos obrigatórios |
| `gerarTemplateArrayBuffer` | retorno não vazio |
| `parsePlanilha` | round-trip template, arquivo sem abas HERDON |
| `validarPlanilha / Fazendas` | nome obrigatório, linha válida |
| `validarPlanilha / Pastos` | nome, fazenda obrigatória, fazenda em planilha, fazenda no db, area_ha inválida, area_ha opcional |
| `validarPlanilha / Lotes` | linha válida, código ausente, código duplicado, fazenda não encontrada, data inválida, data DD/MM/AAAA, quantidade decimal, peso zero |
| `validarPlanilha / Animais` | linha válida, brinco ausente, brinco duplicado, lote não encontrado, lote no db, peso opcional, peso negativo |
| `validarPlanilha / Pesagens_Lotes` | linha válida, lote ausente, lote não encontrado, data ausente, data inválida, peso ausente, peso zero, quantidade decimal, quantidade opcional, duplicata no arquivo, conflito com db |
| `validarPlanilha / Pesagens_Animais` | linha válida, brinco ausente, brinco não encontrado, brinco na planilha, brinco no db, data ausente, data inválida, peso ausente, peso negativo, duplicata no arquivo, conflito com db, lote opcional |
| Referencial cruzado | pasto→fazenda na planilha, pesagem_lote→lote na planilha, pesagem_animal→animal no db |
| totalErros / temErros | múltiplas abas, planilha limpa |

**Total: 75 testes, todos passando**

---

## Pendências conhecidas

- **GMD automático pós-importação:** Pesagens importadas alimentam o histórico, mas o cálculo de GMD do lote (`p_at`, `gmd_meta`) não é recalculado automaticamente. Para isso, o usuário pode editar o lote manualmente ou aguardar uma pesagem futura.
- **Limite de tamanho de arquivo:** Não há validação de tamanho máximo no frontend. Importações com muitos milhares de linhas podem ser lentas.
- **Sem exportação de erros:** Não é possível baixar uma planilha com os erros destacados — o usuário precisa corrigir manualmente consultando a lista exibida na tela.
