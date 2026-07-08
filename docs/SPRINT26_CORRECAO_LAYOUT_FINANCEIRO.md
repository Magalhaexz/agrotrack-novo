# Sprint 26 — Adendo: Correção do botão Cancelar da Pesagem

Este documento registra apenas o adendo P0 tratado nesta sessão (o botão
"Cancelar" do formulário de Pesagem). Nenhuma instrução sobre "layouts
financeiros" foi recebida nesta conversa antes deste adendo — se essa
parte do Sprint 26 for necessária, precisa ser passada separadamente.

## Bug P0 encontrado

No formulário de Pesagem (`PesagemForm`, aberto a partir da aba "Nova
pesagem" de `PesagensPage.jsx`), clicar em "Cancelar" não fechava o
modal — o usuário ficava preso na tela de cadastro.

### Causa raiz

A Sprint 25 mudou a aba padrão de Pesagens para "Histórico" e passou a
renderizar o `PesagemForm` automaticamente sempre que a aba "Nova
pesagem" estivesse ativa:

```jsx
{(abrirForm || (abaAtiva === 'nova' && (lotes || []).length > 0)) && (
  <PesagemForm ... onCancel={() => { setAbrirForm(false); setPesagemEditando(null); }} />
)}
```

O `onCancel` só resetava `abrirForm`/`pesagemEditando`, nunca `abaAtiva`.
Como a condição de exibição do modal tem duas cláusulas ligadas por `||`,
zerar `abrirForm` não bastava: se o usuário tivesse chegado pela aba
"Nova pesagem" (clique direto ou atalho do Dashboard), a segunda
cláusula (`abaAtiva === 'nova' && lotes.length > 0`) continuava
verdadeira e o modal reaparecia imediatamente — na prática, o clique em
Cancelar não tinha efeito visível nenhum.

## Correção aplicada

`src/pages/PesagensPage.jsx` — o `onCancel` passado ao `PesagemForm`
agora também troca a aba ativa para `'historico'`:

```jsx
onCancel={() => {
  setAbrirForm(false);
  setPesagemEditando(null);
  setAbaAtiva('historico');
}}
```

Isso cobre os dois casos:
- **Nova pesagem** (via menu → aba, ou via atalho do Dashboard): Cancelar
  fecha o modal e leva para o Histórico, sem salvar nada.
- **Editar pesagem existente** (via Histórico → "Editar", que usa
  `abrirForm=true` sem depender da aba): Cancelar fecha o modal sem
  alterar o registro; o usuário já estava/volta para o Histórico.

Nenhum cálculo de pesagem, GMD, histórico ou regra de negócio foi
alterado — só o comportamento de fechamento do modal. O botão "Salvar
pesagem" (desabilitado até preencher campos obrigatórios, Sprint 23) não
foi tocado.

## Validação

Testado logado, nos dois fluxos de entrada (menu → aba "Nova pesagem";
atalho "Nova pesagem" do Dashboard), em três larguras:

| Largura | Menu → Nova pesagem → Cancelar | Atalho Dashboard → Cancelar |
|---|---|---|
| 375px (mobile) | OK — volta para Histórico, sem overflow | OK — volta para Histórico, sem overflow |
| 768px (tablet) | OK | — (mesmo componente, mesmo comportamento) |
| 1280px (desktop) | — | OK — volta para Histórico, sem overflow |

Confirmado via `getBoundingClientRect`/estado do DOM: modal presente
antes do clique, ausente depois, aba ativa = "Histórico" depois, sem
erro de console em nenhum dos casos.

## Validações executadas

- `npm run lint` — sem erros.
- `npm test -- --run` — 972 testes, 0 falhas (nenhum teste novo — mudança
  é de fiação de estado em um único componente, coberta pela validação
  manual acima; não há teste automatizado de UI para `PesagensPage` no
  projeto).
- `npm run build` — build ok.
- Nenhuma migration, nenhum `.env`/token, nenhum print/log/arquivo
  Obsidian.
