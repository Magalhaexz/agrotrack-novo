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

- ~~**"Todas as fazendas" não exposta na UI.**~~ **RESOLVIDO (Sprint 28).**
  Opção "Todas as fazendas — Visão consolidada" adicionada ao seletor
  (desktop + mobile, só com >1 fazenda); identificação da fazenda de origem
  nas páginas-chave (Lotes, Custos, Financeiro Por Lote, Estoque; Pastagens
  e Resultado já tinham). Ver `docs/SPRINT28_FECHAMENTO_PENDENCIAS_PILOTO.md`.
- ~~**Empty state de Pastos sem CTA inline.**~~ **RESOLVIDO (Sprint 28)** —
  CTA "Cadastrar pasto" adicionado aos dois estados vazios.
- **Página Importação:** o `<h1>` só aparece após o carregamento do bundle
  pesado (453KB). Não é bug (a página tem título), mas o tempo de
  first-paint é perceptível; candidato a code-splitting/lazy melhor.
- **Identificação por linha no consolidado** ainda pendente em Pesagens,
  Sanidade, Nutrição, Tarefas e Central de Alertas (na tela). Renderizam o
  consolidado corretamente, mas sem rótulo de fazenda por registro — são
  telas ancoradas em lote ou sem dado no piloto. No Telegram os alertas já
  vêm identificados.

## Higiene de dados (P2/P3)

- **Lote órfão id 9 "recria" sem `faz_id`.** **Tratado (Sprint 28):** agora
  é detectado (`src/domain/integridadeDados.js`), sinalizado num aviso em
  Configurações e **visível** na visão "Todas as fazendas" (rotulado como
  "Sem fazenda"/"—" em Lotes, Custos e no CSV de Resultado). **Não removido**
  (regra: não apagar dado real sem certeza). Recomendação mantida: confirmar
  com o dono e limpar lote 9 + custo 1, ou reatribuir a uma fazenda.

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
