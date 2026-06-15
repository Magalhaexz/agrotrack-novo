# SPRINT22A_HOTFIX_GLOBAL_MODAL_AND_FORM_LAYOUTS_HERDON

## Root cause
Os sprints recentes acumularam múltiplos blocos CSS para modal/form em camadas diferentes (`ui.css` e `app.css`), com regras parcialmente conflitantes para `max-height`, `padding`, `overflow`, `sticky footer` e largura em breakpoints menores. Isso gerou regressões: cortes laterais, campos escondidos, footer sobrepondo formulário e variação de comportamento por fluxo.

## Files changed
- `src/styles/ui.css`
- `SPRINT22A_HOTFIX_GLOBAL_MODAL_AND_FORM_LAYOUTS_HERDON.md`

## Modals fixed (hotfix global)
Aplicado hotfix global nos componentes base de modal/form, impactando os fluxos:
- Cadastrar fazenda
- Criar lote
- Novo funcionário
- Produto nutricional
- Cadastro de item de estoque
- Financeiro (movimentação)
- Nova pesagem
- Sanitário/Manejo
- Nova tarefa
- Evento de calendário

### Correções aplicadas
1. Modal shell centralizado e totalmente visível (`overlay` fixo + `z-index` alto + `inset:0`).
2. Modal com `max-width: calc(100vw - 24px)` e `max-height: calc(100dvh - 24px)`.
3. Scroll vertical interno seguro no body (`overflow-y:auto`, `min-height:0`).
4. Footer sticky com `safe-area` para manter ações visíveis.
5. Grids/forms internos com `min-width:0` e `width:100%`.
6. Inputs/selects/textarea forçados a respeitar largura do modal.
7. Colunas de formulários colapsam para 1 coluna no tablet/mobile.

## Validation results
- `npm run build` ✅
- `npm run lint` ✅

## Pending issues
- Recomendada validação manual final em dispositivos reais para confirmar todos os fluxos listados no checklist.
- Persistem ocorrências legadas de mojibake em arquivos fora do escopo deste hotfix (não alterados para evitar risco funcional).
