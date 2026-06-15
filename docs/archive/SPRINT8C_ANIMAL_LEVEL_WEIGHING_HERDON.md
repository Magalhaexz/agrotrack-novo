# Sprint 8C — Add Animal-Level Weighing While Preserving Lot Weighing

## 1) Arquivos alterados
- `src/components/PesagemForm.jsx`
- `src/pages/PesagensPage.jsx`
- `src/styles/app.css`

## 2) Data shape adicionado/atualizado
- Novo campo de tipo de pesagem no payload:
  - `tipo: 'lote' | 'animal'`
  - `origem: 'lote' | 'animal'`
- Para pesagem por animal:
  - `animal_id` (quando selecionado)
  - `lote_id`
  - `data`
  - `peso_medio`
  - `observacao`
- Compatibilidade retroativa:
  - registros antigos sem `tipo/origem` continuam válidos e são tratados como `lote`.

## 3) Como a pesagem por lote foi preservada
- Fluxo de cadastro/edição/exclusão por lote permanece ativo.
- Registros antigos continuam aparecendo no histórico.
- Recalculo de peso do lote (`p_at`, `peso_atual`, `peso_medio_atual`, `ultima_pesagem`) continua ocorrendo para pesagens de lote.
- O recálculo foi protegido para ignorar pesagens de `tipo='animal'`, evitando impactar a lógica já existente do lote.

## 4) Como a pesagem por animal foi adicionada
- Formulário de pesagem agora possui seleção:
  - `Por lote`
  - `Por animal`
- Em `Por animal`:
  - exibe seletor de animal existente;
  - mantém vínculo com lote;
  - ao selecionar animal, o lote é preenchido automaticamente quando disponível.
- Histórico de pesagens agora mistura os dois tipos e identifica claramente:
  - coluna `Origem` com `Lote` ou `Animal`;
  - coluna `Referência` mostrando lote (modo lote) ou identificação do animal (modo animal).
- Variação permanece calculada para pesagens por lote; em pesagens por animal mostra `Não se aplica`.
- Estado vazio contextual:
  - quando não há animais, mostra:
  - `Você pode registrar uma pesagem por lote ou cadastrar um animal para acompanhar individualmente.`

## 5) Build/lint
- `npm.cmd run build`: **OK**
- `npm.cmd run lint`: **OK** (sem erros; warnings preexistentes de `react-hooks/exhaustive-deps` em outras páginas)

## 6) Confirmação de escopo
- Nenhuma funcionalidade foi removida.
- Pesagem por lote foi mantida.
- Não houve remoção de módulos, tabs ou subtabs.
- Não houve mudança de navegação.
- Alteração focada no escopo de pesagens (UI + persistência de tipo/animal no mesmo fluxo existente).
