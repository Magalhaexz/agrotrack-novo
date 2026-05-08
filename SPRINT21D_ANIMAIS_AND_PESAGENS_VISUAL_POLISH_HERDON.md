# SPRINT21D_ANIMAIS_AND_PESAGENS_VISUAL_POLISH_HERDON

## Arquivos alterados
- `src/pages/AnimaisPage.jsx`
- `src/components/AnimalForm.jsx`
- `src/components/PesagemForm.jsx`
- `src/styles/app.css`

## Melhorias em Animais

### Header e ações
- Header da página ajustado com hierarquia mais clara:
  - título: **Animais**
  - subtítulo curto e objetivo
  - botão principal: **Novo cadastro**
- Alinhamento de ações com classes globais (`page-header`, `page-actions`).

### KPIs
- KPIs mantidos com dados existentes e visual padronizado:
  - Total de cabeças
  - Grupos de animais
  - Animais individuais
  - Lotes vinculados
- Cards com altura consistente e melhor leitura em mobile.

### Abas
- Abas ajustadas para padrão global (`tab-bar`) com estado ativo claro:
  - Grupos
  - Individuais
  - Movimentações
- Mobile com rolagem horizontal segura nas abas.

### Tabelas e empty states
- Tabelas de Grupos/Individuais/Movimentações com melhor escaneabilidade.
- Empty states visuais (sem tabela vazia gigante):
  - "Nenhum grupo cadastrado."
  - "Nenhum animal individual cadastrado."
  - "Nenhuma movimentação registrada."

### Modal/Form de animal
- Formulário reorganizado visualmente em seções:
  - Tipo de cadastro
  - Identificação
  - Dados do lote e pesos
  - Dados avançados
- Footer alinhado com botões claros.
- Ajustes de texto com acentos visíveis:
  - Identificação, Movimentações, Cabeças, Observação, etc.

## Melhorias em Pesagens

### Formulário principal (PesagemForm)
- Mantida a lógica existente de pesagem por lote e por animal.
- Reestruturação visual do formulário por seções (`section-card`, `form-section`):
  - Tipo e referência
  - Pesagem individual por lote
  - Medição
  - Indicadores de valor
- Footer padronizado e botões claros no modal.
- Tabela de pesagem por animal mantida com fluxo de `Animal #N`, sem retorno ao select único antigo.

### Textos e consistência
- Normalização de textos e acentuação em labels/erros:
  - Peso médio
  - Observação
  - Rendimento de carcaça
  - Quantidade pesada (cabeças)
  - Mensagens de validação com português correto

## Regras preservadas
- Não houve alteração em:
  - lógica de negócio
  - schema Supabase
  - cálculos
  - sync cloud
  - `operationalPersistence.js`
  - batch de pesagem
  - cálculo de GMD/financeiro
  - integração com Lotes/Rebanho

## Validação
- `npm run lint` ✅
- `npm run build` ✅

## Pendências conhecidas
- Não foi executado teste manual interativo completo dos 15 passos (desktop/mobile) nesta execução local não-visual.
- O arquivo `src/pages/PesagensPage.jsx` permanece funcional com estrutura antiga de layout interno (não houve refatoração completa da página neste sprint para evitar risco em regras de fluxo).

## Riscos
- Como `app.css` concentra muitos estilos históricos, podem existir conflitos visuais pontuais em breakpoints específicos que só aparecem em teste manual de viewport real.
- O polish de Pesagens priorizou o formulário/modal e consistência visual; uma reorganização estrutural mais profunda da tela principal pode ser necessária em sprint futuro se desejar maior simplificação de UX.
