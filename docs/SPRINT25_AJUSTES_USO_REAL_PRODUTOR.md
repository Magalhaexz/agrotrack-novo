# Sprint 25 — Ajustes finais de uso real

## Problemas encontrados

1. **Pesagens**: apesar da Sprint 24 já ter corrigido o botão gigante e o
   formulário fantasma, a aba padrão (`abaAtiva`) continuava sendo "Nova
   pesagem" — como essa aba agora renderiza o formulário real
   automaticamente (fix da Sprint 24), qualquer clique em "Pesagens" no
   menu abria o modal de cadastro na hora, exatamente o "formulário
   pesado direto" relatado neste sprint.
2. **Custos Operacionais**: os cards de KPI já tinham tamanho/altura
   corrigidos (Sprint 22), mas o valor continuava em `"DM Mono", monospace`
   — a fonte técnica/monoespaçada é o que ainda lia como "quebrado".
3. **Ações rápidas**: cobriam só 6 das 10 ações da rotina real (faltava
   pasto, saída de estoque, resultado por lote e Central de Alertas).
4. **Sem previsão de duração de estoque**: nada calculava quantos dias um
   insumo ainda durava a partir do consumo diário esperado.

## Correção — Pesagens

`src/pages/PesagensPage.jsx`: a aba inicial agora é **"Histórico"** por
padrão. Só pula direto para "Nova pesagem" (com o formulário já aberto)
quando o usuário chega pelo atalho explícito "Nova pesagem" das Ações
Rápidas do Dashboard (`navigationIntent.action === 'novo'`) — o mesmo
comportamento de antes, só que agora **não é mais o padrão ao entrar pelo
menu**. Confirmado via `getBoundingClientRect`/snapshot: menu → aba
Histórico, sem modal; atalho → aba Nova pesagem, modal aberto.

## Correção — Custos Operacionais

`src/pages/CustosPage.jsx` ganhou a classe `page--custos`;
`src/styles/app.css` tem uma regra nova, escopada só a essa página,
trocando a fonte do valor de KPI de `"DM Mono", monospace` para
`var(--font-sans)` (Inter, a mesma fonte do resto do app). Não mudou
tamanho nem cor — só a família tipográfica. Escopado à página (não
`.kpi-value` global) para não alterar o visual já validado de Pesagens,
Resultado dos Lotes, Central de Alertas etc., que usam o mesmo componente
de card.

## Correção — Ações Rápidas do Dashboard

`src/pages/DashboardPage.jsx`: grid de ações rápidas passou de 6 para 10
botões, cobrindo a lista pedida:

| Ação | Destino | Já existia? |
|---|---|---|
| Nova pesagem | `pesagens` (action: novo) | Sim |
| Novo lote | `lotes` (action: novo) | Sim |
| Novo pasto | `pastagens` | **Novo** |
| Novo custo | `financeiro` (action: novo) | Sim |
| Novo produto/estoque | `estoque` (action: novo) | Sim |
| Saída de estoque | `estoque` | **Novo** |
| Novo manejo/sanidade | `sanitario` (action: novo) | Sim |
| Nova tarefa | `tarefas` (action: novo) | Sim |
| Resultado por lote | `resultados` | **Novo** |
| Central de Alertas | `alertas` | **Novo** |

"Novo pasto" e "Saída de estoque" navegam para a página (Pastagens/Estoque)
sem abrir formulário automaticamente — nenhuma das duas páginas tinha
suporte a abrir um formulário específico via atalho, e criar esse suporte
seria feature nova fora do escopo ("não criar feature nova só por causa
de atalho"). O destino é real e funcional: a página já tem o botão de
cadastro/saída visível.

## Decisão técnica — previsão de duração do estoque

**Não foi necessária migration.** A tabela `consumo_suplementacao` já
tinha exatamente os campos precisos: `item_estoque_id`, `lote_id`,
`consumo_por_cabeca_dia`, `modo`. `estoque` já tinha `quantidade_atual`.

Também já existia um cálculo de "dias restantes" (`alertasInteligentes.js`,
`detectarEstoqueBaixo`), mas baseado na **média histórica de saídas**
registradas — um sinal diferente e complementar. **Não foi tocado**, para
não duplicar/quebrar o motor de alertas. O novo domínio olha o **consumo
planejado** (cadastro de nutrição por lote), não o histórico.

### Fórmula

```
diasRestantes = quantidadeAtual / consumoDiario
consumoDiario (por produto) = soma, para cada lote com dieta 'por_cabeca'
  vinculada a esse produto, de (consumo_por_cabeca_dia × cabeças do lote)
```

Status: `crítico` (≤ 3 dias), `atenção` (≤ 7 dias), `ok` (> 7 dias),
`sem_estoque` (quantidade ≤ 0), `sem_consumo_configurado` (sem dado
suficiente para calcular — nunca inventa um número).

**Limitação documentada**: só o modo `'por_cabeca'` de
`consumo_suplementacao` é somado. O modo por percentual do peso vivo
depende do peso atual do lote (cálculo já existente em
`lotesLogic.js`/`calcHelpers.js`, usado no alerta de consumo por lote) e
não foi replicado aqui para não arriscar produzir um número calculado
diferente do que já é mostrado em outro lugar do app — produtos nesse
modo aparecem como "Sem consumo configurado" em vez de um valor
possivelmente incorreto.

### Onde aparece

- **Estoque** (`EstoquePage.jsx`): nova linha "Duração estimada (consumo
  planejado)" no card de cada item, com badge colorido por status —
  ao lado da linha "Dias restantes" já existente (baseada em histórico),
  sem substituí-la.
- **Nutrição/Suplementação** (`SuplementacaoPage.jsx`): nova coluna
  "Duração estimada" na tabela de Produtos nutricionais.

Ambos respeitam a fazenda ativa (herdam o `db` já recortado por fazenda,
Sprint 21) e não recalculam saldo de estoque — só leem
`quantidade_atual`.

## Alertas (Etapa 7)

Não foi criado alerta novo nem alterado o motor unificado. A informação
de dias restantes por consumo planejado é só visual (badge), não gera
notificação — documentado aqui como possível Sprint futura, conforme
pedido ("alerta por cobertura em dias pode ser Sprint futuro").

## Domínio e testes

`src/domain/previsaoConsumoEstoque.js` (puro) +
`src/domain/previsaoConsumoEstoque.test.js` (16 testes): 1000kg/50kg-dia
= 20 dias, estoque zero, consumo zero/ausente/null, nunca NaN/Infinity,
status crítico/atenção/ok, múltiplos lotes somando o mesmo produto, modo
incompatível ignorado, produto sem consumo configurado.

## Validação visual

Mobile (375px): Dashboard, Pesagens, Custos, Estoque, Nutrição — sem
overflow, sem NaN/undefined/Infinity, sem erro de console. Tablet
(768px) e desktop (1280px): Dashboard, Pesagens, Custos, Estoque — sem
overflow.

**Limitação**: a conta de teste usada não tem itens de estoque
cadastrados, então o badge "Duração estimada" não pôde ser visto
renderizado com dado real nesta sessão — validado por 16 testes
unitários do domínio + compilação limpa (lint/build) + ausência de erros
de console nas páginas que o usam.

## Validações executadas

- `npm run lint` — sem erros.
- `npm test -- --run` — 972 testes, 0 falhas (956 anteriores + 16 novos).
- `npm run build` — build ok.
- Nenhuma migration criada, nenhum `.env`/token exposto, nenhum
  print/log/arquivo Obsidian commitado, nenhum cálculo de arroba,
  Sanidade↔Estoque, Alertas, Telegram ou Relatórios alterado.

## Próximos passos

- Somar também o modo `'percentual_peso_vivo'` em
  `calcularConsumoDiarioTotalPorProduto`, reaproveitando
  `calculateDailyConsumptionKg` de `calcHelpers.js`.
- Avaliar se vale a pena unificar o "Dias restantes" (histórico) e a
  "Duração estimada" (planejado) em uma única exibição, com o produtor
  escolhendo qual prefere ver primeiro.
- Badge de cobertura em dias no motor de alertas unificado, com teste
  próprio (fora do escopo desta sprint).
