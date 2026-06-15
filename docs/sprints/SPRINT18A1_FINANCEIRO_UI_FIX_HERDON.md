# SPRINT18A1_FINANCEIRO_UI_FIX_HERDON

## Bug de renderização bruta corrigido
- Corrigido o problema em que a expressão condicional de tabs aparecia como texto bruto em tela.
- A renderização foi normalizada com mapeamento explícito de labels por tab:
  - DRE
  - Por Lote
  - Lançamentos
  - Pagamentos Diários

## Melhorias visuais no Financeiro
- Ajuste de hierarquia visual no topo da página:
  - título com subtítulo contextual
  - melhor separação entre header e navegação de abas
- Abas com leitura mais limpa e consistente:
  - espaçamento aprimorado
  - largura mínima para evitar quebra visual
  - estado ativo com destaque premium
- Layout responsivo com wrap de abas para evitar overflow em telas menores.

## O que NÃO foi alterado intencionalmente
- Controles de nuvem (não movidos neste sprint)
- FazendasPage
- AppHeader
- Sync core behavior
- Supabase schema / RLS / auth
- Cálculos financeiros
- Persistência de Pagamentos Diários
- Contratos de relatórios

## Testes
- `git grep -n -E "^(<<<<<<<|=======|>>>>>>>)" -- .` sem conflitos.
- `npm run build` concluído com sucesso.
- `npm run lint` concluído com sucesso (apenas warnings preexistentes).
