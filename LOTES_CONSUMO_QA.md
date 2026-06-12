# LOTES_CONSUMO_QA

## Scope reviewed
- Cadastro e edição de lotes
- Filtro por fazenda ativa
- Histórico de consumo nutricional
- Alertas de consumo esperado

## Issues found
- A página de lotes não respeitava a fazenda ativa para listagem.
- O formulário de lote ainda permitia fluxo confuso para vínculo de fazenda e dias planejados.
- O histórico de consumo não aparecia na linha do tempo do lote.
- Não havia ação de exclusão direta para registros de consumo no histórico.
- O painel de nutrição não explicava claramente o consumo esperado.

## Fixes applied
- A listagem de lotes agora fica restrita à fazenda ativa.
- Novo lote passa a herdar automaticamente a fazenda ativa.
- Edição de lote preserva o vínculo com a fazenda.
- O formulário de lote ganhou o campo editável de dias estimados e validação inteira.
- O histórico passou a incluir registros de `consumo_suplementacao`.
- Registros de consumo agora podem ser excluídos diretamente no histórico.
- O painel de nutrição mostra o alerta de consumo esperado, acima do esperado e abaixo do esperado.

## Validation status
- `npm.cmd run lint` passou.
- `npm.cmd run build` passou.
- `npm.cmd test -- --runInBand` passou.

## Result
- GO for the lote/cadastro/consumo hotfix.
