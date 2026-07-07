# HERDON — Matriz de Maturidade de Decisão (Sprint 13)

Classifica cada módulo em 5 níveis, do mais básico ao mais avançado:

- **Nível 1 — Registro:** o usuário só lança dados.
- **Nível 2 — Controle:** o app mostra o que aconteceu.
- **Nível 3 — Diagnóstico:** o app mostra o que está errado.
- **Nível 4 — Recomendação:** o app sugere o que fazer.
- **Nível 5 — Automação:** o app notifica, agenda, acompanha e cobra tratativa.

Um módulo pode estar "entre" dois níveis quando parte da experiência já chegou lá e parte não — isso é registrado explicitamente em vez de arredondar para cima.

| Módulo | Nível atual | Por quê |
|---|---|---|
| **Dashboard** | 3 → 4 (parcial) | "Prioridades de hoje" já é diagnóstico consolidado (o que está crítico agora) com atalhos de ação nos cards (início de recomendação), mas não há acompanhamento de tratativa nem cobrança se o alerta continuar aberto — fica preso antes do Nível 5. |
| **Lotes** | 3 | Ciclo de vida, histórico de pasto e vínculo real com financeiro/sanidade/pesagens (via `lote_id`) dão diagnóstico forte. `decisaoVenda.js` já aponta "custo alto"/"pronto para venda" pontualmente, mas é um sinal isolado, não uma recomendação central do módulo. |
| **Pesagens** | 3 | GMD abaixo da meta e lote sem pesagem recente já geram alerta (diagnóstico). Não há recomendação (ex.: "ajustar dieta") nem comparação entre lotes para embasar decisão. |
| **Financeiro** | 2 → 3 (parcial) | DRE e contas vencidas são controle sólido; "vencido"/"custo alto por arroba" já é diagnóstico. Mas o número de custo/arroba é inconsistente entre telas (ver Auditoria Técnica), o que compromete a confiança no diagnóstico. Nenhuma recomendação de corte de custo ou de centro de custo. |
| **Sanidade** | 3 | Agenda com vencidos/hoje/7d/30d/carência é diagnóstico real. Não recomenda (ex. "trocar princípio ativo") nem audita coerência de datas de carência. |
| **Estoque** | 3 | Alerta de estoque baixo com previsão de dias restantes é diagnóstico com um traço de previsão. Mas a previsão ignora consumo do tipo "consumo" (o mais comum) e o alerta de validade próxima está efetivamente desligado (campo ausente no formulário) — na prática funciona pior do que o nível sugere. |
| **Alertas (Central)** | 4 (parcial) | Cada alerta unificado já vem qualificado com data/lote/ação recomendada (Sprint 12) — isso é Nível 4 de verdade. O que falta para Nível 5: a tela nova (`AlertasPage`) não tem resolver/adiar, então o app não "cobra" tratativa nem sabe o que já foi tratado — essa cobrança só existe no painel legado do Dashboard, com um motor de alerta diferente. |
| **Telegram** | 4 → 5 (parcial) | Relatório diário automático (push, sem o usuário pedir) e resposta a `/alertas` sob demanda já são automação de notificação. Falta a metade "cobra tratativa": não há confirmação de leitura, não há re-notificação se o alerta não for resolvido, e não há proteção contra abuso (rate limit) nem observabilidade — a automação existe mas é frágil. |
| **Simulador** | 2 → 3 (parcial) | ROI, break-even e lucro por arroba do cenário simulado são diagnóstico numérico sólido. Não há uma frase de recomendação (“não compensa confinar neste cenário”) nem histórico de cenários salvos para comparar decisões ao longo do tempo — fica no controle/diagnóstico, sem cruzar para recomendação explícita. |
| **Relatórios** | 1 → 2 | As páginas calculam e mostram dados (controle), mas não existe exportação real (PDF/CSV/impressão) em nenhuma delas — um relatório que não sai da tela é, na prática, quase um registro: o usuário vê, mas não consegue levar a informação para fora do app (contador, banco, comprador). É o módulo com o nível mais baixo entre os dez. |

## Leitura geral

O HERDON já passou do estágio de "app de controle" — Dashboard, Alertas e Telegram têm elementos reais de diagnóstico e recomendação, o que é bom sinal para um produto de decisão. Os dois bloqueios estruturais para subir de nível de forma consistente:

1. **Números que não batem entre si** (custo/arroba, DRE consolidado vs. por fazenda) minam a confiança em qualquer diagnóstico construído em cima deles — resolver isso é pré-requisito para qualquer recomendação mais ousada (Sprint 14, ver [Roadmap](HERDON_ROADMAP_PROXIMOS_SPRINTS.md)).
2. **A "cobrança de tratativa" (Nível 5) não existe em lugar nenhum ainda** — nem Alertas, nem Telegram fecham o loop de "foi resolvido? foi ignorado? por quanto tempo?". Isso é o que separa o HERDON de hoje de uma plataforma de automação real, e é onde IA/recomendação futura teria mais alavancagem (não em gerar mais alertas, e sim em garantir que os que já existem sejam tratados).
