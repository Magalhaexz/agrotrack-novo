# Teste manual — Guia do Criador dentro do App + Ajuda Contextual (Sprint 26)

## Limitação honesta

Como nas sprints anteriores, não tenho credenciais de uma conta autenticada do HERDON (login via Supabase Auth). Não foi possível abrir o app logado com conta vazia, conta com fazenda e conta com dados completos para clicar pelas telas reais.

O que foi verificado de fato:

1. `npm run dev` sobe normalmente (porta 5173); a tela de login renderiza sem erro no console.
2. `npm test` — 510 testes passam (10 novos desta sprint), incluindo todos os cenários pedidos do checklist: conta vazia, conta com fazenda, conta com fazenda e pastos, conta com lotes (e lote inativo não contar), conta com pesagens, conta com financeiro, próximo passo sugerido, checklist completo, e dados nulos/undefined sem quebrar.
3. `npm run lint` — sem erros.
4. `npm run build` — build de produção concluído com sucesso, incluindo o novo chunk de `GuiaCriadorPage`.
5. Revisão de código confirma a integração: `guiaCriador` registrado em `pageMap` (`App.jsx`), `navSections` (seção Ajuda), `MODULES_BASIC` (`subscriptions.js`); `DashboardPage` lê `construirChecklistPrimeirosPassos(db)` para o card "Primeiros passos"; o botão antigo "Ver guia do criador piloto" foi corrigido para apontar para `guiaCriador` em vez de `suporte`.

## Roteiro para quando houver uma conta de teste

1. **Conta vazia**: criar uma conta nova, sem nenhum cadastro. Confirmar que o Dashboard mostra o banner "Comece cadastrando sua fazenda..." com o botão "Ver guia do criador" levando à página Guia do Criador.
2. Abrir **Guia do Criador** pelo menu (Ajuda → Guia do Criador). Confirmar o checklist com 0 de 7 concluídos, e que cada seção (Fazenda, Pastos, Lotes, Pesagens, Financeiro, Importação, Modo offline, Relatórios) tem texto curto e um botão que leva à tela correta.
3. **Conta com fazenda**: cadastrar uma fazenda. Voltar ao Dashboard e confirmar que o card "Primeiros passos no HERDON" aparece com 1 de 7 concluídos e sugere "cadastre seus pastos" como próximo passo.
4. **Conta com dados completos**: cadastrar pasto, lote, pesagem e um lançamento financeiro. Confirmar que o card "Primeiros passos" desaparece do Dashboard quando os 7 itens estiverem concluídos.
5. Conferir os textos curtos atualizados em: Importação, Pastos, Lotes, Pesagens, Financeiro, Sincronização e Relatórios (hub) — devem bater com os textos definidos na Sprint 26 (ver `docs/GUIA_CRIADOR_APP_HERDON.md`).
6. Conferir os estados vazios atualizados em Fazendas, Pastos, Lotes e Pesagens.
7. Abrir **Suporte** pelo menu (Ajuda → Suporte). Confirmar que o e-mail é um link clicável (`mailto:`) e que a mensagem sugerida de feedback aparece abaixo dele.
8. Testar o card "Precisa de ajuda?" na página Guia do Criador — deve levar para Suporte.
9. Redimensionar para largura mobile e confirmar que o novo item de menu (Ajuda) e os cards novos continuam legíveis.

## Revisão de poluição visual (Etapa 8)

Conferido por leitura de código (sem rodar no navegador): o card "Primeiros passos no HERDON" só renderiza quando o checklist não está completo, e os banners de onboarding existentes (sem fazenda / sem lote) continuam aparecendo só nas condições originais — não há duplicação simultânea de 3 banners ao mesmo tempo, porque o card de checklist é mais discreto (texto + botões) e os banners cobrem casos mais específicos (zero fazenda, zero lote).
