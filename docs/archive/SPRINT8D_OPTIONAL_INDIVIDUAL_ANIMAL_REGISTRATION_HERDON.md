# Sprint 8D — Optional Individual Animal Registration

## 1. Files changed
- `src/components/AnimalForm.jsx`
- `src/pages/AnimaisPage.jsx`
- `src/styles/app.css`

## 2. Fields/UI added
- New mode selector in animal form:
  - `Grupo por lote`
  - `Cadastro individual opcional`
- Added/used fields for optional individual registration:
  - `Lote vinculado`
  - `Identificacao / brinco / codigo`
  - `Sexo`
  - `Genetica / raca`
  - `Peso inicial`
  - `Peso atual`
  - `Status`
  - `Observacoes`
- Added helper copy in UI:
  - `Cadastro individual opcional para acompanhar animais específicos dentro de um lote.`
- List/table polish in Animais:
  - new `Registro` label (`Grupo` / `Individual`)
  - `Identificacao` column
  - `Status` column
  - numeric columns aligned by class for stable rendering

## 3. How optional behavior was preserved
- Default flow remains group-based (`tipo_registro = grupo`).
- Existing group/lote management remains unchanged and fully usable.
- Individual registration is additive and optional only.
- No requirement was introduced to force `animalId` or individual records for lote-level operations.
- Legacy records without `tipo_registro`, `identificacao` or `status` still render safely with fallbacks.
- Data shape remains compatible with existing dashboard/lotes/pesagens behavior.

## 4. Build/lint results
- `npm.cmd run build`: **OK**
- `npm.cmd run lint`: **OK (0 errors, warnings only preexisting in project)**

## 5. Confirmation
- No functionality was removed.
- No module/tab/subtab was removed.
- No unrelated business logic was changed.
