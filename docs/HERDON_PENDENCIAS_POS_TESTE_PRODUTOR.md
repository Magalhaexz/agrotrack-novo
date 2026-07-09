# HERDON — Pendências pós-teste de produtor

Consolidado de pendências conhecidas ao liberar o app para o teste de
produtor de 1 mês (Sprint 27, 2026-07-09). Bloqueadores primeiro; nada
aqui impede o teste começar.

## Bloqueadores (P0)

_Nenhum._ A auditoria total da Sprint 27 (navegação real, logado, 3
viewports) não encontrou P0. Independência entre fazendas, formulários,
exportações e fluxos essenciais validados.

## Ajustes importantes (P1)

_Nenhum em aberto._ O único P1 da Sprint 27 (botão de ação do cabeçalho
virando bloco de ~180px no mobile) foi corrigido e validado — ver
`docs/SPRINT27_AUDITORIA_TOTAL_APP.md`.

Itens que dependem de **feedback do produtor real** (só surgem com uso
contínuo, não são bugs conhecidos):
- Ajustes finos de UX a partir do uso em campo.
- Cobrança em produção: Asaas está integrado mas em `sandbox`; ativar
  produção é decisão comercial + configuração de ambiente (fora do
  código).

## Polimentos (P2)

- **"Todas as fazendas" não exposta na UI.** A função de domínio
  `filtrarDbPorFazenda(db, null)` (`src/domain/escopoFazenda.js`) já
  devolve o consolidado de todas as fazendas, mas o seletor de fazenda do
  header (`src/components/AppHeader.jsx`) só lista fazendas específicas —
  não há opção "Todas". Expor isso exigiria: (a) item no seletor, (b)
  decidir como cada tela identifica a fazenda de origem de cada item no
  modo consolidado, (c) revisar agregações (DRE, KPIs) para somar entre
  fazendas. É **feature nova**, não bug — fora do escopo de uma sprint de
  correção. Priorizar conforme demanda real de quem tem >1 fazenda.
- **Empty state de Pastos sem CTA inline.** A tela tem "+ Novo pasto" no
  header, mas o bloco de estado vazio não repete o CTA (outros estados
  vazios — Estoque, Sanidade, Animais, Comparativo — têm botão inline).
  Consistência; baixo impacto.
- **Página Importação:** o `<h1>` só aparece após o carregamento do bundle
  pesado (453KB). Não é bug (a página tem título), mas o tempo de
  first-paint é perceptível; candidato a code-splitting/lazy melhor.

## Higiene de dados (P2/P3)

- **Lote órfão id 9 "recria" sem `faz_id`.** Dado legado (provável lixo de
  sessão de teste anterior) que não pertence a nenhuma fazenda. O filtro
  estrito de lotes (`Number(lote.faz_id) === farmId`) o esconde de **todas**
  as fazendas — ou seja, é invisível na UI, mas continua na base com um
  custo (id 1, R$ 3.000) apontando para ele. **Não removido** nesta sprint
  (regra: não apagar dado real sem certeza de que é lixo). Recomendação:
  confirmar com o dono da conta e, se for lixo, limpar lote 9 + custo 1;
  ou reatribuir a uma fazenda.

## Futuro (P3 — não é escopo de correção)

- WhatsApp como canal ativo de envio (hoje só link/texto compartilhável;
  Telegram é o único bidirecional).
- Camada de IA/recomendação sobre o Assistente HERDON (hoje determinístico
  por regras).
- App mobile nativo (hoje web responsivo).
- Integrações fiscais/financeiras, benchmarking entre fazendas, painel do
  consultor, previsão de venda/compra — ver backlog mestre.

## Fora deste ambiente

- **Telegram ao vivo:** não testável localmente (precisa do cliente
  Telegram + token do bot em produção). Coberto por testes unitários
  (`telegramComandos.test.js`) e validação de produção em sprints
  anteriores.
