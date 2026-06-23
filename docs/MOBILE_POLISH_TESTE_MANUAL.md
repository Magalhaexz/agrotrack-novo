# Teste manual — Polimento Mobile Estrutural (Sprint 29)

## Limitação honesta

Sem credenciais de conta autenticada, não foi possível abrir o Dashboard, Financeiro, Pastos, Lotes, Pesagens, Relatórios, Sincronização ou Guia do Criador logado, em nenhuma largura. Diferente das sprints anteriores, porém, esta sprint conseguiu **medir** (não só ler código) o comportamento real do CSS em 390px e 1280px, reconstruindo a árvore DOM real do header/modal na tela de Login (acessível sem login) e usando `getComputedStyle`/`getBoundingClientRect`. Isso deu confiança concreta na correção do bug principal, mesmo sem visual autenticado.

## O que foi testado e confirmado (com medição, não só leitura)

| Item | 390px (antes) | 390px (depois) | 1280px (depois) | Status |
|---|---|---|---|---|
| `.app-shell .ui-modal-overlay` padding-left | ~292px | 8px | ~300px | **Corrigido** |
| `.app-shell .ui-modal` max-width | ~78px | 374px | ~952px | **Corrigido** |
| `.connection-indicator` no header mobile | pílula até 160px com texto completo | círculo 32×32px, só o ponto | — (regra é só mobile) | **Corrigido** |
| `.mobile-header-panel` (painel "⋯") | `position: fixed` não portalizado | portalizado em `document.body` | — | **Corrigido (estrutural)** |

## O que foi auditado mas não testável sem login

| Tela | Status |
|---|---|
| Login | **OK** — testado em 390px, sem problemas |
| Dashboard / Hoje na Fazenda | Não testável sem login — beneficia indiretamente da correção de modal (card "Primeiros passos" não usa modal, mas qualquer modal de cadastro aberto a partir dali sim) |
| Guia do Criador | Não testável sem login — página simples, sem modal |
| Financeiro | Não testável sem login — modais de receita/despesa usam `Modal.jsx`, beneficiados pela correção |
| Pastos | Não testável sem login — modal de cadastro de pasto beneficiado |
| Lotes / Detalhe do Lote / aba Pasto | Não testável sem login — `MoverPastoModal` usa `Modal.jsx`, beneficiado |
| Pesagens | Não testável sem login — `PesagemForm` usa `.modal-footer.action-row`, já corrigido na Sprint 27 e beneficiado pela correção de largura desta sprint |
| Sincronização | Não testável sem login |
| Relatórios | Não testável sem login — ações de PDF/WhatsApp não usam modal, sem impacto direto desta sprint |

## Gates automatizados

1. `npm run dev` sobe normalmente; console sem erros na tela de Login.
2. `npm test` — 534 testes, 0 falhas (nenhum teste novo: mudanças são CSS + portal, sem lógica de domínio nova).
3. `npm run lint` — 0 erros.
4. `npm run build` — build de produção concluído com sucesso.

## Roteiro para quando houver conta de teste

1. Abrir qualquer formulário de cadastro (Fazenda, Pasto, Lote, Pesagem) em 390px e confirmar que o modal ocupa quase a largura toda da tela, não fica espremido na borda direita.
2. Tocar no botão "Mais" do menu inferior (bottom nav) em 390px e confirmar que o modal "Mais opções" abre por completo, com todos os grupos de módulos legíveis e roláveis.
3. Tocar no botão "⋯" do canto do header (painel de fazenda/aba/conta) e confirmar que abre corretamente, sem corte lateral.
4. Conferir o indicador de conexão no header — deve aparecer como um ponto colorido discreto, sem texto, no mobile.
5. Repetir os passos 1-4 em 375px, 430px e 768px.
6. Abrir o mesmo fluxo em desktop (1280px+) e confirmar que nada regrediu — modais devem continuar respeitando a largura da sidebar.
7. Testar em Safari iOS real, se possível — é o navegador mais sensível ao comportamento de `backdrop-filter`/`position: fixed` que motivou a portalização do painel "⋯".

## Resultado

Bug estrutural real do "Menu Mais opções cortado" identificado e corrigido com medição concreta (não suposição). Verificação visual completa com conta autenticada continua pendente — mesma limitação de todas as sprints desde a 22.
