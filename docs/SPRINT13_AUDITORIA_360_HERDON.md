# Sprint 13 — Auditoria 360° do HERDON

Sprint de auditoria e diagnóstico, sem novas funcionalidades. Objetivo: mapear com profundidade tudo que falta, está incompleto ou precisa melhorar para o HERDON se tornar uma plataforma premium de decisão e monitoramento pecuário.

Documentos completos desta auditoria:
- [HERDON_AUDITORIA_TECNICA.md](HERDON_AUDITORIA_TECNICA.md) — estrutura, banco de dados, duplicações, testes, performance, segurança.
- [HERDON_BACKLOG_MESTRE.md](HERDON_BACKLOG_MESTRE.md) — 34 itens priorizados (P0-P3) com impacto, esforço e sprint sugerido.
- [HERDON_ROADMAP_PROXIMOS_SPRINTS.md](HERDON_ROADMAP_PROXIMOS_SPRINTS.md) — 11 sprints recomendados (14 a 24).
- [HERDON_MATRIZ_MATURIDADE_DECISAO.md](HERDON_MATRIZ_MATURIDADE_DECISAO.md) — nível de maturidade (Registro → Automação) de cada módulo.

## Etapa 0 — Pré-checks

- `npm run lint`: **limpo**, sem avisos.
- `npm test -- --run`: **862/862 testes passando**, 19 suítes.
- `npm run build`: **sucesso**, ~2s.
- `git status --short`: árvore limpa em relação ao código do app. Únicos arquivos não versionados são o vault Obsidian pré-existente (`.obsidian/`, `00-Home.md`, `00-Inbox/`, etc.) e dois PDFs/docs de outra frente de trabalho — nada dentro de escopo desta auditoria ficou fora do controle de versão.
- Nenhuma correção foi necessária (lint/testes/build já estavam verdes antes de começar).

## Visão geral do produto

O HERDON tem hoje **48 páginas**, **37 módulos de domínio** (25 com teste automatizado) e **33 tabelas** no Supabase, todas com RLS habilitado. O produto já passou do estágio de "app de controle": Dashboard, Central de Alertas e Telegram têm elementos reais de diagnóstico e recomendação (ver [matriz de maturidade](HERDON_MATRIZ_MATURIDADE_DECISAO.md)). As integrações entre módulos são majoritariamente reais — `lote_id` de fato conecta pesagens, financeiro e sanidade entre si — mas há pontos de integração que parecem existir na UI e não existem no código (o mais grave: Sanidade não decrementa Estoque, apesar do formulário sugerir que sim).

## Principais achados

1. **Custo por arroba/lucro por arroba não têm uma fonte única de verdade** — pelo menos 3 definições de "arroba" (ganho, peso vivo, carcaça) calculadas em 8 arquivos diferentes, misturadas no mesmo relatório. É o achado técnico mais crítico da auditoria porque é o número mais citado nas decisões de venda.
2. **Nenhum relatório do HERDON pode ser exportado** — sem PDF, sem CSV, sem impressão, em nenhuma das páginas de relatório. Um documento antigo sugere que isso foi planejado, mas não existe implementação. É o gap de produto mais afiado encontrado.
3. **Sanidade não decrementa Estoque**, apesar do formulário de sanidade oferecer um seletor de produto vindo do estoque — a UI implica um vínculo que não existe.
4. **Central de Alertas: o painel de resolver/adiar nunca foi migrado** para o motor de alertas unificado — ainda existem 3 sistemas de alerta coexistindo (achado já conhecido de sprints anteriores, confirmado ainda presente).
5. **Migrations locais divergem do schema remoto** (2 migrations só no remoto, 1 só local) — risco de reprodutibilidade de ambiente.
6. **7 páginas órfãs** e a duplicação funcionarios×equipeAcessos seguem sem resolução, mesmas encontradas em auditoria de navegação anterior.
7. **Dependência silenciosa**: criar um lote depende de um auto-patch que gera um registro sintético em "animais" — se não disparar, financeiro/saúde/decisão de venda mostram "dados insuficientes" sem qualquer aviso.

Nenhum achado de segurança novo — os itens SEC-001 a SEC-005 de uma auditoria anterior seguem corrigidos e nada regrediu. As pendências de segurança remanescentes são hardening de baixo risco (funções com search_path mutável, proteção de senha vazada desligada).

## Etapa 2 — O HERDON responde bem às perguntas do produtor?

| # | Pergunta | Classificação | Nota |
|---|---|---|---|
| 1 | Meu rebanho está evoluindo bem? | Responde parcialmente | Dados existem (peso médio, evolução por lote), mas a visão consolidada de rebanho (`EvolucaoRebanhoPage`) é uma página órfã, fora da navegação. |
| 2 | Qual lote está dando lucro? | Responde, mas com risco | `lucroPorArroba` existe, mas usa base de cálculo diferente de `custoPorArroba` (achado #1) — o ranking pode estar certo, mas o número absoluto não é confiável. |
| 3 | Qual lote está dando prejuízo? | Responde, mas com risco | Mesma ressalva do item 2. |
4 | Qual lote merece atenção hoje? | Já responde bem | Painel "Prioridades de hoje" do Dashboard, alimentado pelo motor único de alertas. |
| 5 | O que vence esta semana? | Responde, mas com UX inconsistente | Financeiro usa janela de 7 dias, carência sanitária usa 3 dias — "esta semana" não tem definição única entre módulos. |
| 6 | O que preciso comprar? | Responde parcialmente | Alerta de estoque baixo existe, mas a previsão de dias restantes ignora consumo do tipo "consumo" (o mais comum) e o alerta de validade próxima está efetivamente desligado. |
| 7 | O que preciso pagar? | Já responde bem | Contas a pagar bucketadas (vencidas/vencendo hoje/próximos 7 dias/previstas) reaproveitando uma única fonte. |
| 8 | Posso vender este lote agora? | Responde, mas com risco | `decisaoVenda.js` existe e funciona, mas herda a inconsistência de base de arroba do achado #1. |
| 9 | Qual é meu custo por arroba? | Responde, mas não é confiável | O achado central da auditoria — números diferentes dependendo de qual tela/função gerou o valor. |
| 10 | Qual cenário é mais rentável? | Responde, mas sem recomendação explícita | ROI/break-even calculados corretamente; falta uma frase de recomendação e histórico de cenários salvos. |
| 11 | Quais animais/lotes estão travando resultado? | Responde parcialmente | `ResultadosPage` monta ranking, mas com lógica pesada inline em vez de domínio reutilizável — funciona, mas é frágil de manter. |
| 12 | O que o app recomenda fazer agora? | Responde parcialmente bem | Alertas já vêm qualificados com ação recomendada (Sprint 12), mas não há acompanhamento se a ação foi tomada — recomendação existe, cobrança de tratativa não. |

## Etapa 5 — Fluxos completos (resumo)

Auditoria de código para os 17 fluxos pedidos — leitura completa caso a caso não cabe neste resumo, pontos relevantes:

- **Onboarding → cadastro de fazenda/lote → pesagem/custo/receita:** funcionam de ponta a ponta; cadastro de lote tem o risco silencioso do achado #7 acima.
- **Consultar resultado do lote:** funciona, mas os números de custo/lucro por arroba mostrados podem não bater entre telas (achado #1) — é o fluxo mais confuso encontrado.
- **Lançar sanidade:** funciona para o registro em si, mas o vínculo com estoque não se completa (achado #3) — o produtor não recebe nenhum aviso de que precisa dar baixa manual.
- **Ver alertas / usar `/alertas` no Telegram:** ambos funcionam para consulta; tratar um alerta (resolver/adiar) só funciona no painel legado do Dashboard, não na Central nova (achado #4).
- **Consultar DRE:** funciona, mas só de forma consolidada — sem filtro por fazenda.
- **Simular cenário:** funciona de ponta a ponta, sem persistência de histórico.
- **Cancelar/mudar assinatura:** infraestrutura de plano/assinatura existe e está madura (trial, tolerância de atraso, bloqueio); a profundidade exata do fluxo de upgrade/downgrade self-service não foi verificada nesta auditoria por limite de tempo — recomenda-se checagem manual dedicada.
- **Usar no celular:** login confirmado responsivo (mobile e desktop, com CSS dedicado por breakpoint). As demais telas autenticadas **não puderam ser verificadas visualmente nesta sessão** por falta de credencial de teste — ver limitação abaixo.

## Etapa 9 — Auditoria visual (honesta sobre limitações)

O dev server foi executado localmente e a tela de login foi inspecionada em mobile e desktop: visual polido, responsivo, sem erros de console, sem requisições de rede falhas. Um screenshot inicial em resolução desktop pareceu mostrar o conteúdo desalinhado (comprimido no canto superior esquerdo), mas a inspeção direta do DOM (`getBoundingClientRect`) mostrou o layout corretamente centralizado — concluído como artefato da ferramenta de preview, não bug real do produto.

**Sem acesso autenticado nesta sessão**, não foi possível abrir Dashboard, Central de Alertas, Lotes, Financeiro, Sanitário, Estoque ou Simulador no navegador — a avaliação desses módulos neste conjunto de documentos é baseada inteiramente em leitura de código. Recomenda-se repetir a auditoria visual (Etapa 9) num próximo sprint com uma conta de teste disponível.

## Top 10 prioridades (ver backlog completo para os 34 itens)

1. Relatórios sem exportação PDF/CSV (P0) — BM-31
2. Sanidade não decrementa Estoque (P0) — BM-02
3. Migrations locais divergem do remoto (P0) — BM-06
4. Custo/lucro por arroba inconsistente (P1) — BM-01
5. Central de Alertas: resolver/adiar não migrado, 3 motores coexistindo (P1) — BM-14
6. Previsão de estoque cega para consumo do tipo "consumo" (P1) — BM-03
7. Alerta de validade próxima nunca dispara (P1) — BM-04
8. Criação de lote depende de auto-patch silencioso (P1) — BM-05
9. RLS com policies duplicadas / `auth.uid()` não cacheado (P1) — BM-10
10. Telegram sem rate limit/observabilidade/painel admin (P1) — BM-17

## Próximos 5 sprints recomendados

1. **Sprint 14** — Consolidação do cálculo base de arroba + reconciliação de migrations.
2. **Sprint 15** — Integridade entre Lote, Animais, Estoque e Sanidade (fecha os 3 gaps de estoque + a dependência silenciosa de lote).
3. **Sprint 16** — Central de Alertas única (aposenta o motor legado, unifica janelas de dias).
4. **Sprint 17** — Limpeza de banco (naming duplicado, índices, RLS).
5. **Sprint 18** — Navegação e débitos de UX (páginas órfãs, duplicação de equipe).

Sequência completa (até o Sprint 24, incluindo exportação de relatórios, DRE por fazenda, Telegram produção-ready, automação de tratativa, fundação WhatsApp e fundações de recomendação/IA) em [HERDON_ROADMAP_PROXIMOS_SPRINTS.md](HERDON_ROADMAP_PROXIMOS_SPRINTS.md).

## Riscos críticos

- **Confiança no dado mais citado do produto (custo/arroba) está comprometida** — qualquer decisão de venda tomada com base nesse número hoje pode estar usando uma base de cálculo inconsistente com o que é mostrado em outra tela.
- **Estoque diverge silenciosamente da realidade** a cada aplicação sanitária — quanto mais tempo sem correção, mais caro fica reconciliar o saldo retroativamente.
- **Dois motores de alerta em produção ao mesmo tempo** é uma fonte constante de risco de regressão — qualquer mudança em um pode não se refletir no outro.
- **Nenhum relatório sai do app** — trava adoção comercial mais séria (contador, banco, comprador) tanto quanto qualquer bug técnico.

## Alteração de código nesta sprint

**Nenhuma.** Esta foi uma sprint de auditoria e documentação, conforme escopo definido. Nenhuma regra de negócio, migration, ou arquivo de ambiente foi tocado; nenhum token ou dado real foi exposto nos documentos gerados.

## Validação final (Etapa 11)

- `npm run lint`: limpo.
- `npm test -- --run`: 862/862 passando.
- `npm run build`: sucesso.
- Dashboard, Central de Alertas, Telegram, financeiro e sanidade seguem compilando sem alteração — nenhum código de produto foi modificado.
