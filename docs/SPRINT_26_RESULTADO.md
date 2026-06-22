# Sprint 26 — Resultado

## Funcionalidade entregue

**Guia do Criador dentro do App + Ajuda Contextual**

Uma página "Guia do Criador" no menu, um checklist de primeiros passos (sem tabela nova), um card discreto no Dashboard, ajuda contextual curta nas telas principais, estados vazios mais orientados e a página de Suporte agora visível no menu, com mensagem de feedback sugerida.

---

## Onde fica o Guia do Criador

Menu lateral → **Ajuda → Guia do Criador** (`pageId: guiaCriador`). Também acessível pelo botão "Ver guia" no card "Primeiros passos no HERDON" do Dashboard e pelo botão "Ver guia do criador" do banner de onboarding (que antes, por engano, levava para Suporte).

## Como funciona o checklist

`src/domain/guiaCriador.js` → `construirChecklistPrimeirosPassos(db)`. 7 itens (fazenda, pastos, lotes, pesagens, financeiro, hoje na fazenda, relatórios), cada um derivado de dados que já existem em `db` — nenhuma tabela nova, nenhum progresso salvo separadamente. Retorna `itens`, `totalConcluido`, `totalItens`, `proximoPasso` e `concluido`. Detalhes completos em [docs/GUIA_CRIADOR_APP_HERDON.md](GUIA_CRIADOR_APP_HERDON.md).

## Telas que receberam ajuda contextual

Importação, Pastos, Lotes (`LotesPageHeader`), Pesagens, Financeiro, Sincronização e o hub de Relatórios — todas com 1 frase curta nova, sem jargão técnico (sem mencionar tabela, payload, RPC, RLS, `localStorage` ou service worker).

## Como o feedback/suporte funciona

Página de Suporte (`/suporte`) agora aparece no menu (Ajuda → Suporte) — antes só era alcançável pelo banner do Dashboard. O e-mail `herdonapp@gmail.com` passou a ser um link `mailto:` clicável, com a mensagem sugerida de feedback ("informe o que você estava tentando fazer...") logo abaixo. Detalhes em [docs/SUPORTE_FEEDBACK_HERDON.md](SUPORTE_FEEDBACK_HERDON.md).

---

## Arquivos novos

| Arquivo | Descrição |
|---|---|
| `src/domain/guiaCriador.js` | `construirChecklistPrimeirosPassos(db)` |
| `src/pages/GuiaCriadorPage.jsx` | Página "Guia do Criador" |
| `tests/guiaCriador.test.js` | 10 testes do checklist |
| `docs/GUIA_CRIADOR_APP_HERDON.md` | Onde fica, como funciona o checklist, telas com ajuda |
| `docs/SUPORTE_FEEDBACK_HERDON.md` | Como o feedback/suporte funciona |
| `docs/GUIA_CRIADOR_TESTE_MANUAL.md` | Roteiro de teste manual (com limitação de autenticação documentada) |
| `docs/SPRINT_26_RESULTADO.md` | Este documento |

## Arquivos modificados

| Arquivo | O que mudou |
|---|---|
| `src/navigation/navConfig.js` | Nova seção "Ajuda" com `guiaCriador` e `suporte` |
| `src/App.jsx` | Lazy import + `pageMap` para `guiaCriador` |
| `src/services/subscriptions.js` | `guiaCriador` e `suporte` adicionados a `MODULES_BASIC` (sem alteração de preço/limite/Asaas) |
| `src/lucide-react.js` | Ícones `Circle`, `HelpCircle`, `LifeBuoy` adicionados ao shim local |
| `src/pages/DashboardPage.jsx` | Card "Primeiros passos no HERDON" (some quando o checklist está completo); botão do banner corrigido para apontar para `guiaCriador` em vez de `suporte` |
| `src/pages/SuportePage.jsx` | E-mail como link `mailto:`; mensagem de feedback sugerida |
| `src/pages/RelatoriosPage.jsx` | Aviso "os relatórios aparecem melhor depois que..." enquanto o checklist não estiver pronto para relatórios |
| `src/pages/ImportacaoPage.jsx`, `PastagensPage.jsx`, `PesagensPage.jsx`, `FinanceiroPage.jsx`, `SincronizacaoPage.jsx`, `src/components/lotes/LotesPageHeader.jsx` | Textos de ajuda curtos atualizados |
| `src/pages/FazendasPage.jsx`, `PastagensPage.jsx`, `LotesPage.jsx`, `PesagensPage.jsx` | Estados vazios com texto orientado |
| `docs/NAVEGACAO_HERDON.md` | Nova seção Ajuda documentada |
| `docs/BETA_PILOTO_READY_HERDON.md` | Addendum Sprint 26 |

## Decisões técnicas

### Checklist sem tabela nova

Cada item do checklist é um booleano derivado de coleções que já existem (`fazendas`, `pastagens`, `lotes`, `pesagens`, `movimentacoes_financeiras`). Isso evita qualquer necessidade de migration e garante que o checklist nunca fica desatualizado — ele é recalculado a cada render a partir dos dados reais, não de uma flag "usuário marcou como feito".

### Card do Dashboard discreto e condicional

O card "Primeiros passos no HERDON" só aparece enquanto `!checklist.concluido`. Para usuários avançados (todos os 7 itens concluídos), o card simplesmente não renderiza — evita poluir o Dashboard de quem já não precisa de orientação inicial.

### `suporte` adicionado ao menu e a `MODULES_BASIC`

A página já existia, mas só era alcançável por um botão dentro de um banner condicional. Adicioná-la ao menu principal facilita o acesso a qualquer momento. Também foi adicionada a `MODULES_BASIC` (assim como `guiaCriador`) para garantir que nenhum plano bloqueie o acesso a ajuda/suporte — não é uma alteração de preço, limite ou regra de cobrança.

## Limitações conhecidas

- Não é um tour interativo — é uma página estática com checklist dinâmico.
- O checklist olha apenas "existe ou não existe o dado", não "o usuário completou o cadastro corretamente".
- Suporte continua sendo só por e-mail (`mailto:`), sem formulário dentro do app.

## Pendências para Sprint 27

- Tour interativo passo a passo.
- Vídeos curtos dentro do app.
- Central de ajuda pesquisável.
- Chat de suporte.
- Notificações educativas.
- Onboarding por perfil de usuário.

## Teste manual

Não foi possível testar com conta autenticada real (sem credenciais de teste disponíveis). Documentado honestamente em `docs/GUIA_CRIADOR_TESTE_MANUAL.md`, com roteiro completo para quando houver acesso.

## Resultado dos gates

| Gate | Resultado |
|---|---|
| `npm test` | 510 testes, 0 falhas (10 novos em `tests/guiaCriador.test.js`) |
| `npm run lint` | 0 erros |
| `npm run build` | Build de produção concluído com sucesso |
