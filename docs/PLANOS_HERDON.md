# Planos HERDON (Sprint 28)

## Estado real encontrado (antes desta sprint)

O catálogo de planos **já existia** e é mais maduro do que o esperado no diagnóstico inicial — não foi criado do zero nesta sprint. Está em `src/services/subscriptions.js`, constante `PLAN_CATALOG`:

| `planCode` | Nome exibido | Preço/mês | Fazendas | Cabeças | Usuários | Módulos |
|---|---|---|---|---|---|---|
| `fundador` | FUNDADOR | R$ 297,00 | 50 | 10.000 | 50 | Todos (`*`) — oferta de lançamento, legado |
| `essencial` | ESSENCIAL | R$ 197,00 | 1 | 300 | 2 | Básicos |
| `pro` | PRO | R$ 397,00 | 3 | 1.000 | 5 | Básicos + Financeiro, Estoque, Sanidade, Painel Gerencial |
| `premium` | PREMIUM | R$ 697,00 | 10 | 3.000 | 10 | Tudo do PRO + Pastos, Indicadores, Simulador, Dashboard Premium, Evolução do Rebanho |
| `enterprise` | ENTERPRISE | Sob consulta | Sem limite fixo | Sem limite fixo | Sem limite fixo | Todos (`*`) |

Esses preços **já estavam no código antes desta sprint** — não foram criados nem alterados agora. Continuam sendo valores internos, sem cobrança real ativa em produção (ver `docs/ASAAS_HERDON.md`).

## Sugestão de nomes mais amigáveis (Sprint 28 — não implementada)

A sprint propôs nomes de marketing mais descritivos (Essencial / Campo Plus / Gestão Pro / Enterprise). Optei por **não renomear os planos existentes no código** nesta sprint, porque:

1. Os limites sugeridos no brief da sprint (ex.: Essencial = 200 cabeças, Campo Plus = 2 fazendas/800 cabeças) **diferem** dos limites já em produção (Essencial = 300 cabeças, PRO = 3 fazendas/1.000 cabeças) — mudar agora seria uma alteração de regra comercial real sem confirmação humana explícita, o que a sprint pede para evitar.
2. O `planCode` (`essencial`/`pro`/`premium`/`enterprise`) já está referenciado em `customer_subscriptions` reais (ou potencialmente reais, já que o Asaas já está integrado) — renomear o `planName` é seguro, mas mudar limites/preço não.

**Mapeamento sugerido (documentação apenas, não aplicado no código):**

| Nome interno atual | Nome de marketing sugerido pela Sprint 28 |
|---|---|
| Essencial | Essencial (igual) |
| PRO | Campo Plus |
| PREMIUM | Gestão Pro |
| ENTERPRISE | Enterprise (igual) |
| FUNDADOR | Fundador (mantido como plano legado/especial) |

Se a equipe confirmar humanamente que os novos limites sugeridos pela sprint devem substituir os atuais, a alteração é simples: editar `PLAN_CATALOG` em `src/services/subscriptions.js` (campo `limits` e `planName` de cada plano) — nenhuma migração de banco é necessária, pois `customer_subscriptions.plan_code` continua sendo só uma string livre comparada ao catálogo em runtime.

## Plano FUNDADOR — tratamento

Mantido sem alteração, exatamente como pedido ("não remover sem análise"). Já está marcado no próprio catálogo como `launchOffer: true, easyToDisable: true` — ou seja, o código já previa que esse plano precisaria ser desativado/ajustado no futuro sem dificuldade. Continua liberando todos os módulos (`modules: ['*']`).

## Onde isso é usado

- `src/domain/planos.js` (novo nesta sprint) — wrapper de domínio com nomes em português: `getPlanoConfig`, `getLimitesPlano`, `getModulosPlano`, `verificarLimiteUso`, `verificarAcessoModulo`, `obterResumoUso`. Não duplica o catálogo, apenas expõe funções mais claras sobre o já existente em `subscriptions.js`.
- `src/pages/MinhaAssinaturaPage.jsx` — página "Planos e Assinatura", já existente e madura (ver `docs/ASSINATURAS_HERDON.md`).

## Pendências futuras

- Confirmar humanamente se os limites sugeridos pela Sprint 28 devem substituir os atuais.
- Avaliar renomear `planName` de PRO/PREMIUM para "Campo Plus"/"Gestão Pro" na interface (mudança de baixo risco, só texto).
- Cupom, teste grátis automático, cobrança anual — ver pendências completas em `docs/SPRINT_28_RESULTADO.md`.
