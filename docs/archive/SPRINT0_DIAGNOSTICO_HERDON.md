# Sprint 0 — Diagnóstico Técnico Herdon

## Resumo executivo
- **Status geral**: projeto com base funcional, porém com débito técnico alto e sinais claros de merge incompleto (marcadores `<<<<<<<`, `=======`, `>>>>>>>` em múltiplos arquivos).
- **Compila?** Sim, o build de produção (`vite build`) conclui, mas isso mascara arquivos quebrados que hoje não entram no bundle.
- **Riscos principais**:
  - conflitos de merge não resolvidos em componentes e páginas;
  - divergência de regras de cálculo entre `calcLote` e `calcularResultadoLote`;
  - inconsistência de nomenclatura/contratos de dados (`lucroporCabeca` vs `lucroPorCabeca`);
  - persistência primária em estado local sem camada explícita de sincronização operacional (risco de perda de dados em refresh/queda de sessão);
  - cobertura de lint muito comprometida, com erros de parsing e regras críticas de React Hooks.

## 🔴 Crítico — quebra o sistema

1) **Conflitos de merge em produção de código fonte**
- arquivo: `src/components/EntradaEstoqueModal.jsx`, `src/components/SaidaEstoqueModal.jsx`, `src/components/FazendaForm.jsx`, `src/components/LoteForm.jsx`, `src/components/VendaLoteModal.jsx`, `src/components/SuplementacaoForm.jsx`, `src/components/ResultadoLoteCard.jsx`, `src/components/AlertList.jsx`, `src/pages/ComparativoLotesPage.jsx`, entre outros.
- linha aproximada: início dos arquivos e blocos internos com `<<<<<<< HEAD`.
- problema: código inválido (parse error) coexistindo no repositório.
- impacto: qualquer import desses arquivos quebra lint/build da feature; manutenção e merges futuros ficam inseguros.
- sugestão de correção: resolver conflitos por arquivo, validar comportamento final, e bloquear CI para qualquer marcador remanescente.

2) **Contrato de propriedade quebrado no card de resultado de lote**
- arquivo: `src/components/ResultadoLoteCard.jsx`
- linha aproximada: 56 e 92
- problema: uso de `resultado.lucroporCabeca` (camelCase incorreto) enquanto o domínio retorna `lucroPorCabeca`.
- impacto: KPI de lucro/cabeça pode aparecer zerado/indefinido, levando leitura financeira errada.
- sugestão: padronizar para `lucroPorCabeca` e criar teste de contrato entre `domain/calculos` e componentes consumidores.

3) **Build/lint pipeline sem proteção real para código conflitado**
- arquivo: pipeline local (scripts do `package.json`) + arquivos conflitados fora do grafo de import.
- linha aproximada: N/A
- problema: `npm run build` passa mesmo com arquivos inválidos não referenciados; `npm run lint` falha com parsing errors múltiplos.
- impacto: falsa sensação de estabilidade em produção.
- sugestão: adicionar job de varredura de conflitos (`rg` para marcadores) e lint estrito como gate obrigatório.

## 🟠 Alto — cálculo/dado incorreto

1) **Duas fontes de verdade para resultado financeiro de lote**
- arquivo: `src/utils/calculations.js` (`calcLote`) e `src/domain/calculos.js` (`calcularResultadoLote`).
- regra afetada: custo/receita/lucro por lote.
- impacto no produtor: dashboards/páginas podem exibir margens diferentes para o mesmo lote dependendo da tela.
- sugestão: centralizar cálculo em módulo único e tornar os demais adaptadores finos.

2) **Base de dados divergente nos cálculos financeiros**
- arquivo: `calcLote` usa `db.custos` + `lote.investimento`; `calcularResultadoLote` usa `db.movimentacoes_financeiras`.
- regra afetada: custo total, receita total, lucro total.
- impacto no produtor: DRE de lote e cartão de resultado podem divergir sem transparência de fonte.
- sugestão: definir modelo oficial (competência/caixa) e reconciliar fontes em camada de serviço.

3) **Inconsistência de unidade em GMD**
- arquivo: `src/utils/calculations.js` retorna GMD em kg/dia; `src/domain/indicadores.js` (`calcularGMD`) retorna g/dia.
- regra afetada: comparação de meta e ranking de desempenho.
- impacto no produtor: risco de metas 1000x fora de escala em integrações/reuso incorreto.
- sugestão: padronizar unidade (kg/dia) e explicitar no nome (`calcularGmdKgDia`).

4) **Dias do lote calculados a partir do primeiro registro de animal**
- arquivo: `src/utils/calculations.js` (`dias = animaisDoLote[0]?.dias`).
- regra afetada: custo/cab/dia, projeções, indicadores temporais.
- impacto no produtor: lotes com entradas/movimentações heterogêneas geram tempo distorcido.
- sugestão: calcular dias por data de entrada real do lote (ou weighted average por lote).

## 🟡 Médio — arquitetura/manutenção

1) **Ausência de `useOperationalData` e fluxo espalhado no `App.jsx`**
- duplicação: lógica de dados, filtros por fazenda, confirmações, alertas e permissões concentradas em componente monolítico.
- função espalhada: persistência/atualização de dados em múltiplos handlers ad hoc.
- risco futuro: alta chance de regressão ao evoluir sincronização e cache.

2) **Arquivo paralelo com rota de comparativo duplicada**
- duplicação: `ComparativoPage.jsx` e `ComparativoLotesPage.jsx` (este último conflitado).
- risco futuro: decisões de produto podem cair no arquivo errado e quebrar em deploy futuro quando rota mudar.

3) **Lint com alto volume de erros de React Hooks e unused vars**
- função espalhada: padrão repetido de `setState` em `useEffect` e dependências instáveis.
- risco futuro: render cascata/performance ruim e baixa previsibilidade de estado.

## 🔵 Baixo — UX/polimento

1) **Fluxo criar fazenda/lote sem trilha guiada cross-módulo**
- tela: `Fazendas`, `Lotes`.
- problema: usuário cria entidade, mas próximos passos (animais, pesagem, custos) não são conduzidos em wizard/checklist.
- melhoria recomendada: onboarding por etapas com CTA contextual.

2) **Fluxo de pesagem e custos com feedback heterogêneo**
- tela: `Pesagens`, `Custos`.
- problema: parte usa modal de confirmação customizado, parte usa `window.confirm` fallback; consistência visual baixa.
- melhoria: unificar no `ConfirmModal` com mensagens padrão de risco.

3) **Leitura de lucro/prejuízo por lote sem explicação de origem dos números**
- tela: `Resultados` / `Financeiro` / card de lote.
- problema: não fica claro para o usuário qual fonte alimenta cada KPI (custos vs movimentações).
- melhoria: exibir “fonte de cálculo” e botão “como é calculado”.

## Ordem recomendada de correção
1. Limpar todos os conflitos de merge (`<<<<<<<`, `=======`, `>>>>>>>`) e estabilizar lint parsing.
2. Unificar motor de cálculo de lote (receita/custo/lucro/GMD/custo@) em única camada.
3. Corrigir contratos de dados e nomenclatura (`lucroPorCabeca`, unidades de GMD, IDs/lote_id).
4. Extrair fluxo operacional para hook/serviço (`useOperationalData`) com persistência segura.
5. Endurecer permissões e confirmações em operações destrutivas.
6. Refinar UX crítica dos fluxos de criação e fechamento de lote.

## Plano de Sprint até quinta-feira
- **Dia 1: corrigir build e conflitos**
  - remover marcadores de merge;
  - zerar parsing errors;
  - garantir `npm run lint` ao menos sem erros críticos de sintaxe.
- **Dia 2: centralizar cálculos**
  - consolidar `calcLote` + `domain/calculos`;
  - padronizar unidade de GMD e contrato de saída;
  - criar bateria mínima de testes unitários de cálculo.
- **Dia 3: resumo do lote**
  - reconstruir card/resumo com fonte única de dados;
  - adicionar rastreabilidade de cada KPI (custo, receita, margem, lucro/cab, lucro/@).
- **Dia 4: testes finais e polish**
  - regressão dos fluxos críticos (fazenda/lote/animais/pesagem/custo/venda);
  - revisão de permissões em Configurações, usuários e convites;
  - ajustes de UX e textos de confirmação.
