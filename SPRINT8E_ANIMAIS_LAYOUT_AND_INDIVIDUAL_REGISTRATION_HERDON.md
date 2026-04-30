# Sprint 8E — Animais: Layout e cadastro individual

## Arquivos alterados
- `src/pages/AnimaisPage.jsx`
- `src/components/AnimalForm.jsx`
- `src/styles/app.css`

## O que foi implementado
- Reestruturação da página `Animais` com hierarquia mais clara: header superior, área de ação, seletor de modo, área de formulário e área de listagem.
- Inclusão de seletor explícito de modo de cadastro:
  - **Cadastro por grupo/lote** (fluxo existente preservado)
  - **Cadastro individual**
- CTA principal agora respeita o modo selecionado (abre já no modo grupo ou individual).
- Remoção da coluna lateral promocional do “Cadastro rápido” para priorizar usabilidade real e equilíbrio visual da tabela/lista.
- Listagem unificada mantém registros de grupo e individuais sem remover ações existentes.
- Cadastro individual aprimorado para cenário real:
  - Permite criar 1 animal com identificação única.
  - Campo de lote passa a ser **opcional no cadastro individual** e continua obrigatório para grupo/lote.
  - Inclusão de campo **Data de entrada / referência**.
- Preservação da identidade visual dark premium com ajustes de spacing, segment control e responsividade.

## Validação

### Comandos solicitados
- `npm.cmd run build`
- `npm.cmd run lint`

### Validação manual esperada
- Abrir módulo **Animais**.
- Confirmar estabilidade visual desktop e mobile.
- Confirmar seletor de modo com:
  - grupo/lote
  - individual
- Confirmar que fluxo de grupo/lote segue funcionando.
- Confirmar que cadastro de um único animal funciona.
- Confirmar que módulos/tabs/subtabs/navegação foram preservados.

## Confirmações
- **Fluxo por grupo/lote preservado:** Sim.
- **Cadastro individual de animal adicionado como fluxo explícito:** Sim.
