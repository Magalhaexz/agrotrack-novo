# HERDON — Ponte Figma → Claude Code Desktop

Status: **Aprovado para implementação**
Data da consolidação: **23/07/2026**

## Fonte visual oficial

- Arquivo: [HERDON — Assistência Operacional](https://www.figma.com/design/vrkLCKBDraMupa8inB9L08)
- File key: `vrkLCKBDraMupa8inB9L08`
- Handoff principal: [Handoff / Official](https://www.figma.com/design/vrkLCKBDraMupa8inB9L08?node-id=135-20)
- Direção oficial: **Conceito A / Light**
- Material arquivado: **Conceito B / Dark**, preservado em `09 — Arquivo`

O Figma é a fonte visual oficial. Esta pasta contém somente documentação, IDs de nodes e imagens exportadas para permitir que o Claude Code Desktop, que não possui MCP do Figma, implemente o redesign com fidelidade.

## Como usar

O Claude Code Desktop deve ler toda a pasta `docs/figma/` antes de alterar qualquer tela. A ordem de execução está em [IMPLEMENTATION_ORDER.md](./IMPLEMENTATION_ORDER.md). Os contratos de motion estão em [MOTION.md](./MOTION.md) e os componentes em [COMPONENTS.md](./COMPONENTS.md).

Não inventar funcionalidades, rotas, permissões, cálculos, estados ou dados. Quando o Figma não especificar um comportamento, preservar o comportamento existente no código e registrar a dúvida antes de alterar a arquitetura.

## Limites

- O arquivo Figma não está armazenado no Git.
- O Git contém esta documentação, node IDs e imagens de referência.
- Não alterar `src/**`, `public/**`, `package.json`, migrations, Supabase, RPCs, testes ou configurações como parte do handoff.
- Toda implementação deve preservar regras de negócio, permissões, RLS, serviços e contratos existentes.

## Índice

- [HANDOFF.md](./HANDOFF.md) — auditoria, regras preservadas, mapa e pendências.
- [TOKENS.md](./TOKENS.md) — cores, tipografia, espaçamento, estrutura e fonte atual.
- [COMPONENTS.md](./COMPONENTS.md) — componentes, estados, acessibilidade e responsividade.
- [MOTION.md](./MOTION.md) — contrato de movimento e microinterações.
- [ROUTES_MAP.md](./ROUTES_MAP.md) — rotas e arquivos React reais.
- [NODES_MAP.md](./NODES_MAP.md) — frames e estados oficiais do Figma.
- [IMPLEMENTATION_ORDER.md](./IMPLEMENTATION_ORDER.md) — ordem aprovada de implementação.
- [VALIDATION_CHECKLIST.md](./VALIDATION_CHECKLIST.md) — validação por sprint.
