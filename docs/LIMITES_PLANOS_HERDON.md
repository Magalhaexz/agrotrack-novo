# Limites por Plano e Bloqueios Amigáveis (Sprint 28)

## Domínio de limites

`src/domain/planos.js`:

- `getLimitesPlano(plano)` — retorna `{ farms, animals, users }` do plano (valores `null` = ilimitado).
- `verificarLimiteUso(plano, usoAtual)` — compara `usoAtual` (`{ farms, animals, users }`) com os limites do plano e retorna, por chave: `{ allowed, limit, current, remaining }`.
- `obterResumoUso(db, assinatura)` — calcula o uso real a partir do banco (`fazendas.length`, soma de `animais.qtd`, usuários ativos) e já aplica `verificarLimiteUso` com o plano da assinatura.

Importante: `verificarLimiteUso`/`verificarAcessoModulo` são checagens de **regra de plano pura** — não consideram status da assinatura (vencida, cancelada, etc.). Esse outro tipo de bloqueio (por status) já existe separadamente em `evaluateLimit()`/`canAccessModule()` em `src/services/subscriptions.js`, usado nas telas de cadastro (Fazendas, Animais, Configurações/Equipe).

## Mensagens amigáveis (Sprint 28)

`getSubscriptionLimitMessage(kind, evaluation)` em `src/services/subscriptions.js` foi reescrita nesta sprint. Antes, toda mensagem de limite dizia "Regularize sua assinatura..." — texto errado para quem só atingiu um limite do plano (não é um problema de pagamento). Agora:

| Situação | Mensagem |
|---|---|
| Limite de fazendas atingido | "Seu plano atual permite 1 fazenda. Para cadastrar mais fazendas, escolha um plano superior." |
| Limite de cabeças atingido | "Seu plano atual atingiu o limite de cabeças ativas. Para continuar cadastrando animais, escolha um plano superior." |
| Limite de usuários atingido | "Seu plano atual permite até 2 usuários. Para convidar mais pessoas, escolha um plano superior." |
| Assinatura bloqueada/cancelada (não é limite de plano) | "Regularize sua assinatura para continuar usando o HERDON." (mensagem antiga, mantida — esse caso é diferente: aqui o problema é a assinatura, não o plano) |
| Módulo não incluído no plano | `getModuleBlockedMessage()`: "Este recurso está disponível em outro plano. Veja Planos e Assinatura para escolher um plano superior." |

Nenhuma mensagem técnica (erro de banco, payload, código HTTP) é mostrada ao usuário em nenhum desses casos — sempre a frase amigável.

## Onde os bloqueios já são aplicados (sem alteração nesta sprint)

| Tela | Limite verificado | Arquivo |
|---|---|---|
| Fazendas | `farms` | `src/pages/FazendasPage.jsx` (`canCreateFarm`) |
| Animais | `animals` | `src/pages/AnimaisPage.jsx` (`canCreateAnimal`) |
| Configurações → Equipe | `users` | `src/pages/ConfiguracoesPage.jsx` (`canInviteUser`) |
| Qualquer navegação de menu | módulo do plano | `src/App.jsx`, função `navigateWithPermission` (`canAccessModule`) |

## Garantias mantidas (Etapa 4 da sprint)

- **Nenhum dado é apagado** ao atingir um limite — os bloqueios impedem apenas a *criação* de um novo registro além do limite, nunca a visualização do que já existe.
- **Contas com `override`/`internal_override`/`is_internal_override`** (uso interno/teste) sempre passam, independente do limite.
- **Plano não reconhecido** (sem assinatura, ou `plan_code` inválido) **não bloqueia** — `verificarAcessoModulo`/`verificarLimiteUso`/`canAccessModule` retornam permissivo por padrão quando não há plano para comparar. Confirmado por teste (`tests/planos.test.js`).

## Pendências futuras

- Avisos preventivos antes de atingir 100% do limite (ex.: "você já usa 9 de 10 fazendas").
- Painel de uso consolidado fora da página de Assinatura (ex.: card no Dashboard).
