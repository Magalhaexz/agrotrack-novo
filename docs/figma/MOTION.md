# HERDON — Motion e microinterações

Contrato transcrito do Figma oficial. Motion deve reforçar hierarquia e feedback, nunca criar funcionalidade nova.

## Tokens

| Token | Duração |
|---|---:|
| `Motion/Fast` | 120 ms |
| `Motion/Standard` | 180 ms |
| `Motion/Slow` | 240 ms |
| `Motion/Drawer` | 280 ms |

## Easing

- Entrada: `ease-out`.
- Saída: `ease-in`.
- Mudança entre estados: `ease-in-out`.

## Contratos por componente

| Componente | Gatilho | Entrada | Saída | Duração | Easing | Movimento reduzido |
|---|---|---|---|---:|---|---|
| Tabs | Clique na aba | Indicador e conteúdo | Nova aba ativa | 180 ms | ease-in-out | Fade 120 ms; posição preservada |
| Sidebar | Recolher/abrir | Ícones e rótulos | Shell compacto/aberto | 280 ms | ease-in-out | Fade dos textos; ícones ficam |
| Dropdown | Clique/foco | Menu curto | Opções visíveis | 180 ms | ease-out | Fade 120 ms |
| Modal | Ação sensível | Overlay + modal | Confirmação | 180 ms | ease-out | Fade; sem escala |
| Drawer | Abrir menu | Painel lateral | Menu secundário | 280 ms | ease-out | Fade curto |
| Bottom sheet | Filtros/ações | Overlay + painel | Sheet aberto | 280 ms | ease-out | Fade; arrastar não obrigatório |
| Toast | Sucesso/erro | Entrada no canto | Feedback + ação | 180 ms | ease-out | Fade; não bloqueia |
| Botão loading | Confirmar | Texto → indicador | Largura preservada | 120 ms | ease-in-out | Troca imediata; impedir duplo clique |
| Skeleton | Carregamento | Placeholder | Conteúdo carregado | 240 ms | ease-in-out | Skeleton estático |
| Atualização de lista | Registro concluído | Badge/linha | Lista atualizada | 180 ms | ease-in-out | Fade curto; sem números animados |

## Fluxos prototipados

Em `07 — Flows` foram conectados estados individuais de nível superior para:

1. abas do Financeiro;
2. sidebar aberta/recolhida;
3. filtro mobile;
4. ações rápidas;
5. registro de pesagem;
6. venda;
7. sincronização;
8. importação;
9. alteração de perfil;
10. confirmação destrutiva;
11. menu do usuário;
12. menu Mais;
13. seletor de fazenda;
14. dropdown;
15. menu secundário de card;
16. ações de lote;
17. detalhe de funcionário;
18. seleção de fazenda.

Os estados foram mantidos como frames irmãos de nível superior porque o Figma exige esse formato para ações `NAVIGATE`. Isso não substitui ou altera os frames oficiais das telas.

## Regras obrigatórias

- Sem parallax.
- Sem loops ou animações contínuas.
- Sem animações comemorativas em ações sensíveis.
- Não animar números financeiros de forma decorativa.
- Nenhuma informação pode depender apenas da animação.
- Respeitar `prefers-reduced-motion`.
- Gestos são referência visual, não requisito funcional.
- Erros importantes mantêm `Tentar novamente` ou `Ver detalhe`.
