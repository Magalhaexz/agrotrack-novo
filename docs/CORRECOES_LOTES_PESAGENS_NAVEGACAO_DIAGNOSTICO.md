# Diagnóstico — Correções em Lotes, Pesagens, Nutrição e Navegação

Diagnóstico por item antes de alterar (mandado pelo sprint). Marca o que já foi
corrigido nesta rodada, o que precisa de trabalho de UI com verificação em
navegador, e o que precisa de confirmação de regra antes de mexer.

## Achado central (raiz de vários P0)

**Dupla contabilidade `lote.*` vs `animais.*`.** As telas leem indicadores de
duas fontes que divergem:
- `calcLote` (`src/utils/calculations.js`) e `getResumoLote` calculam a partir de
  `animais[].qtd` e `animais[].p_at`.
- `PesagensPage.recalculateLoteFromPesagens` e os fluxos de movimentação
  atualizam `lote.p_at`/`lote.qtd`, **mas não** `animais[].*`.

Resultado: registrar pesagem ou ajustar lotação muda `lote.*`, mas a visão geral
(que usa `calcLote`) continua mostrando o valor antigo de `animais.*`. Isto é a
raiz de **3.3, 3.4 e 1.3**.

## Status por item

| Item | Prioridade | Causa raiz | Status |
|------|-----------|-----------|--------|
| 3.3 Peso atual travado no de entrada | P0 | `calcLote.pesoAtualMedio` lia só `animais.p_at`, que não é atualizado por pesagem | ✅ **corrigido** |
| 3.4 Visão geral divergente (peso) | P0 | idem — telas divergiam do valor pós-pesagem | ✅ **corrigido (peso)** · 🟡 GMD pendente |
| 3.5 Centralizar indicadores do lote | P1 | cálculos independentes | ✅ **peso centralizado em `pesoMedioAtualDoLote`** · 🟡 demais indicadores seguem em `calcLote` (já é a fonte única; falta GMD por pesagem) |
| 3.1 Data padrão na pesagem | P1 | `PesagemForm` iniciava `data: ''` | ✅ **corrigido** (hoje local, editável, sem UTC off-by-one) |
| 3.2 Primeira pesagem = peso de entrada | P0 | criação de lote não semeia pesagem inicial | ⛔ **pendente** (ver risco abaixo) |
| 1.1 Ações inconsistentes entre abas | P0 | ações duplicadas em componentes distintos | 🔎 UI — precisa mapear cada aba/modal |
| 1.2 Padronizar menu do lote | P1 | menu com opções extras | 🔎 UI |
| 1.3 Ajuste de lotação não atualiza cabeças | P0 | dupla contabilidade `lote.qtd`×`animais.qtd` | 🔎 depende de decidir a fonte única (ver risco) |
| 1.4 Trocar lote vinculado a encerrar | P0 | fluxo de troca de pasto misturado com finalização | 🔎 UI/domínio — precisa separar as ações |
| 1.5 Remover "Curral" | P1 | **não é um botão**: é um módulo inteiro (ModoCurralPage, `domain/modoCurral.js`, rota em App.jsx, item de nav, `useRegistroRapido`, testes) | ⚠️ **precisa confirmação** — remover o módulo todo é alto impacto |
| 2.1 Simplificar retirada | P1 | formulário com campos além do necessário | 🔎 UI |
| 2.2 Morte/perda usa formulário correto | P0 | verificar fluxo em `AnimalMovementModal`/`movimentacoes.js` | 🔎 precisa reproduzir |
| 2.3 Finalizar lote com validação própria | P1 | finalização tratada como retirada | 🔎 UI/domínio |
| 5.1/5.2/5.3 Campo sexo (cadastro/edição) | P0/P1 | verificar enum/coluna e binding no `LoteForm` | 🔎 precisa diagnóstico do form + banco |
| 6.1 Preservar última página | P1 | sem persistência de rota | 🔎 navegação — precisa browser |
| 6.2 Botão voltar derruba app | P0 | histórico de rotas/estado | 🔎 navegação — precisa reproduzir em desktop/mobile/PWA |
| 6.3 Preservar estado de navegação | P1 | idem | 🔎 navegação |
| 7.1 Confirmação após cadastro | P1 | falta toast padronizado | 🔎 UI (vários forms) |
| 7.2 Formulário aberto após salvar | P0 | modal não fecha / botão não desabilita | 🔎 UI (vários forms) |
| 7.3 Idempotência / duplo envio | P1 | sem trava de submissão | 🔎 front + avaliar backend |
| 4.1 Duração estimada (Nutrição) | P2 | fórmula não confirmada | ⛔ **não implementar** — o sprint pede confirmar a fórmula antes; sem regra validada, não alterar |

## Corrigido nesta rodada (com teste/validação)

1. **Peso atual médio segue a pesagem de lote válida mais recente** (`calcLote`),
   com fallback para o peso dos animais (entrada). Fonte única para Lotes,
   Detalhes, Dashboard, relatórios, Telegram etc. — resolve 3.3 e o peso de 3.4,
   e centraliza (3.5). Testes em `src/utils/calculations.test.js`.
2. **Data de hoje por padrão na nova pesagem** (`PesagemForm`), local e editável.

## Riscos que exigem decisão antes de implementar

- **1.3 / 3.2 / GMD (dupla contabilidade):** definir a fonte única de verdade
  (`lote.*` agregado × `animais.*`). Migrar leitura/escrita para uma só fonte é
  refac amplo (muitas telas + testes) e precisa de verificação em navegador. Não
  improvisar. Recomendo: (a) fonte = pesagens para peso (já feito), (b) fonte =
  `lote.qtd` para cabeças, atualizando `calcLote` para preferir `lote.qtd` quando
  divergir de `animais`, com migração de dados diagnosticada.
- **1.5 Curral:** confirmar se é para remover o **módulo inteiro** ou só um atalho.
- **4.1 Nutrição:** confirmar a fórmula correta (o próprio sprint marca como
  pendente de regra).

## Próximos passos sugeridos (fases do sprint)
Fase 1 (integridade): decidir fonte única de cabeças → corrigir ajuste de
lotação e morte/perda com testes de saldo/histórico. Fase 2: GMD e primeira
pesagem sobre a base de peso já centralizada. Fase 3: sexo (form + persistência).
Fase 4: navegação (browser). Fase 5: confirmação + anti-duplicidade nos forms.
