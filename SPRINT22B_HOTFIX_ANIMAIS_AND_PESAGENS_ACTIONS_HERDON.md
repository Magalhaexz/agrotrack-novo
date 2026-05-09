# SPRINT22B_HOTFIX_ANIMAIS_AND_PESAGENS_ACTIONS_HERDON

## Goal
Corrigir ações quebradas e estados visuais críticos de CTA em Animais e Pesagens após os reworks visuais.

## Root cause
Parte dos CTAs estava renderizada com `<button className="primary-btn">` sem estilo primário robusto compartilhado, resultando em aparência mascarada/baixo contraste e percepção de desabilitado. Além disso, ações principais não estavam explicitamente marcadas com variante primária em pontos críticos.

## Files changed
- `src/pages/AnimaisPage.jsx`
- `src/pages/PesagensPage.jsx`
- `SPRINT22B_HOTFIX_ANIMAIS_AND_PESAGENS_ACTIONS_HERDON.md`

## Fixes applied
1. **Animais**
   - `Novo cadastro` definido como botão primário visível.
   - `Cadastrar grupo` (empty state) definido como botão primário, sem aspecto de desabilitado.
   - Seleção de modo (`Grupo de animais` / `Animal individual`) com CTA primário para reforçar clickability.

2. **Pesagens**
   - CTA do header migrada para componente `Button` com variante primária: `Nova pesagem`.
   - CTA da aba “Nova pesagem” ajustada para texto claro: `Registrar pesagem` e variante primária.
   - CTA da aba “Alertas” migrada para `Button` primário, mantendo a mesma ação de abrir fluxo.

3. **Escopo preservado**
   - Sem alteração de lógica de negócio em pesagens por lote/animal/batch.
   - Sem alteração de schema Supabase.
   - Sem alteração de `operationalPersistence.js`.
   - Sem retorno do antigo seletor único de animal.

## Validation results
- `npm run build` ✅
- `npm run lint` ✅

## Pending issues
- Recomendada validação manual final dos fluxos em ambiente navegável para confirmar percepção visual em todos os temas/dispositivos.
