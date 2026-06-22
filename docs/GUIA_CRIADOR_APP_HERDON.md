# Guia do Criador dentro do App (Sprint 26)

## Onde fica

Menu lateral → seção **Ajuda** → **Guia do Criador** (`pageId: guiaCriador`, componente `src/pages/GuiaCriadorPage.jsx`). Também acessível pelo botão "Ver guia" no card "Primeiros passos no HERDON" do Dashboard.

Esta página é diferente do documento interno `docs/GUIA_CRIADOR_PILOTO_HERDON.md` (que é para você, ao conversar com o criador piloto — fala em SQL, `customer_subscriptions`, UUID). A página dentro do app é para o **usuário final**, em linguagem simples, sem nada técnico.

## O que a página mostra

1. Explicação curta do que é o HERDON.
2. Checklist de primeiros passos (ver abaixo).
3. Uma seção curta por área do sistema: Fazenda, Pastos, Lotes, Pesagens, Financeiro, Importação, Modo offline, Relatórios — cada uma com 1-2 frases e um botão que leva direto à tela.
4. Um card final "Precisa de ajuda?" com o caminho para enviar feedback.

## Como funciona o checklist

`src/domain/guiaCriador.js`, função `construirChecklistPrimeirosPassos(db)`. Não usa nenhuma tabela nova — cada item é derivado de dados que já existem:

| Item | Concluído quando... |
|---|---|
| Cadastre sua fazenda | existe ao menos 1 fazenda |
| Cadastre seus pastos | existe ao menos 1 pasto |
| Cadastre seus lotes | existe ao menos 1 lote com `status: 'ativo'` |
| Registre ou importe suas pesagens | existe ao menos 1 pesagem |
| Lance custos e receitas | existe ao menos 1 movimentação financeira |
| Acompanhe o Hoje na Fazenda | tem fazenda **e** lote ativo |
| Gere relatórios | tem pesagem **e** financeiro |

A função retorna `itens` (com `concluido` por item), `totalConcluido`, `totalItens`, `proximoPasso` (primeiro item não concluído, ou `null` se tudo concluído) e `concluido` (booleano geral). Não há progresso "salvo" em lugar nenhum — o checklist é recalculado a cada render a partir dos dados reais, então nunca fica desatualizado.

## Onde mais o checklist aparece

- **Dashboard**: card "Primeiros passos no HERDON", mostrado só enquanto `!checklist.concluido` (some automaticamente quando todos os itens são concluídos, para não poluir a tela de quem já é usuário avançado). Mostra a contagem (`X de Y concluídos`), o próximo passo em texto simples, e botões: Ver guia, Importar dados, Cadastrar fazenda (só se faltar), Cadastrar lote (só se faltar).
- **Relatórios** (hub): mostra o aviso "Os relatórios aparecem melhor depois que você tiver lotes, pesagens e financeiro registrados." enquanto esse item do checklist não estiver concluído.

## Telas que receberam ajuda contextual (Etapa 5)

Frases curtas (1 linha), sem jargão técnico:

| Tela | Texto |
|---|---|
| Importação | "Use o modelo oficial do HERDON para trazer fazendas, pastos, lotes, animais e pesagens de uma só vez." |
| Pastos | "Cadastre os pastos da fazenda para acompanhar onde cada lote está e receber alertas de lotação." |
| Lotes | "Cada lote representa um grupo de animais acompanhado em conjunto — peso, custo e resultado." |
| Pesagens | "Registre pesagens para acompanhar ganho de peso, desempenho e resultado." |
| Financeiro | "Lance custos e receitas para entender o resultado dos lotes." |
| Sincronização | "Quando estiver sem internet, alguns registros ficam salvos neste aparelho e serão enviados quando a conexão voltar." |
| Relatórios | "Gere resumos para salvar em PDF ou compartilhar pelo WhatsApp." |

Nenhuma dessas frases menciona nomes internos (tabela, payload, RPC, RLS, `localStorage`, service worker) — a explicação técnica completa, se necessária, fica só na documentação de desenvolvimento (`docs/*_HERDON.md`), nunca na interface.

## Limitações conhecidas

- Não é um tour interativo — é uma página estática com checklist dinâmico.
- O checklist não distingue "abandonou no meio" de "nunca começou" — só olha se o dado existe ou não.
- Nenhum progresso fica salvo fora dos dados reais (não há flag "usuário já viu o guia").

## Pendências futuras

- Tour interativo passo a passo (overlay guiando pelo primeiro cadastro).
- Vídeos curtos dentro do app.
- Central de ajuda pesquisável.
- Chat de suporte.
- Notificações educativas (ex.: "você ainda não testou X").
- Onboarding diferente por perfil de usuário (proprietário vs. operador).
