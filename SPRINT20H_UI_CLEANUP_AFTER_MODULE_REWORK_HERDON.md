# SPRINT20H_UI_CLEANUP_AFTER_MODULE_REWORK_HERDON

## Arquivos alterados
- src/pages/PesagensPage.jsx
- src/pages/EstoquePage.jsx
- src/pages/SuplementacaoPage.jsx
- src/pages/FuncionariosPage.jsx
- src/pages/AnimaisPage.jsx
- src/styles/app.css

## Problemas corrigidos por tela
- Pesagens:
  - tabs com barra horizontal limpa (desktop e mobile com scroll)
  - textos com acentos corrigidos (Histórico, Evolução, Ações, Observação)
  - KPIs em cards de grid
  - aba Nova pesagem estruturada em card de formulário
- Estoque:
  - texto de vazio corrigido e com espaçamento
  - empty state menor com CTA “Cadastrar item”
  - bloco explicativo reduzido para “Como funciona”
- Nutrição/Suplementação:
  - tabs em linha horizontal
  - empty state de produtos com orientação e CTA contextual
- Funcionários:
  - subtítulo alinhado ao objetivo de clareza
  - empty states por filtro (ativos / inativos-desligados)
- Animais:
  - correção de acentos (Visualização, Identificação, Ações, movimentações, cabeças)
  - botão Novo cadastro com proporção normal
  - tabela não renderiza vazia
  - empty state com CTA “Cadastrar grupo”

## Validação build/lint
- npm run build
- npm run lint

## Pendências conhecidas
- Algumas tabelas ainda são o principal layout no mobile; evolução futura pode migrar parte para cards nativos por linha.

## Riscos
- Ajustes CSS globais podem exigir refinamento fino em breakpoints específicos dependendo da combinação de conteúdo por tenant.
