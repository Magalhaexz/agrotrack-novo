# HERDON — Roadmap dos Próximos Sprints (a partir do Sprint 13)

Sequência recomendada com base na auditoria 360° ([resumo executivo](SPRINT13_AUDITORIA_360_HERDON.md), [backlog completo](HERDON_BACKLOG_MESTRE.md)). Ordem segue o critério pedido: primeiro base/dados, depois UX e fluxos críticos, depois notificações, depois relatórios, depois automações, depois fundações de IA — com uma exceção deliberada: a exportação de relatórios (Sprint 19) foi o gap mais afiado da auditoria (nenhum relatório sai do app hoje), então entra logo após a base de dados estar consolidada, não no fim da fila.

## Sprint 14 — Consolidação do Cálculo Base e das Migrations
**Objetivo:** unificar custo/lucro por arroba numa única função e reconciliar as migrations locais com o schema remoto.
**Por que vem agora:** toda decisão de venda e todo relatório financeiro do produto se apoia nesse número; corrigir depois de construir mais features em cima dele custaria mais caro. Migrations divergentes colocam em risco qualquer ambiente novo (staging, onboarding de outro dev).
**Arquivos prováveis:** `src/domain/calculos.js`, `src/utils/calculations.js`, `src/domain/resumoLote.js`, `src/domain/arroba.js`, `src/domain/decisaoVenda.js`, `supabase/migrations/`.
**Riscos:** mudar a fórmula pode alterar números já exibidos a usuários reais — necessário comparar valores antes/depois lote a lote antes de publicar.
**Critérios de aceite:** BM-01 e BM-06 fechados (ver Backlog Mestre); testes cobrindo consistência entre `custoPorArroba` e `lucroPorArroba`.

## Sprint 15 — Integridade entre Lote, Animais, Estoque e Sanidade
**Objetivo:** Sanidade decrementa Estoque de verdade; previsão de estoque considera consumo; alerta de validade próxima volta a funcionar; criação de lote nunca fica "sem dados" silenciosamente; `calculateGmd30` deduplicado.
**Por que vem agora:** são falhas silenciosas — o produto parece funcionar mas os dados por trás já divergiram da realidade. Quanto mais tempo passa, mais difícil fica reconciliar retroativamente.
**Arquivos prováveis:** `src/components/SanitarioForm.jsx`, `src/pages/SanitarioPage.jsx`, `src/domain/alertasInteligentes.js`, `src/pages/EstoquePage.jsx`, `src/pages/lotesLogic.js`.
**Riscos:** ligar Sanidade→Estoque pode expor que estoques já estão desalinhados há tempo — pode ser necessário um ajuste manual único de saldo antes de ativar a baixa automática.
**Critérios de aceite:** BM-02, BM-03, BM-04, BM-05, BM-22, BM-23 e BM-26 fechados.

## Sprint 16 — Central de Alertas Única
**Objetivo:** migrar o painel de resolver/adiar para o motor de alertas unificado, aposentar `utils/alerts.js` (legado), unificar as janelas de dias (3d/7d) numa configuração só.
**Por que vem agora:** é o maior ponto de confusão estrutural do produto hoje — dois motores de alerta ativos ao mesmo tempo é risco de regressão constante, e é pré-requisito para qualquer automação de tratativa (Sprint 22).
**Arquivos prováveis:** `src/utils/alerts.js`, `src/domain/alertasUnificados.js`, `src/domain/centralAlertas.js`, `src/pages/AlertasPage.jsx`, `src/pages/DashboardPage.jsx`.
**Riscos:** o painel legado do Dashboard está em produção há várias sprints — mudança de motor sem teste de regressão cuidadoso pode quebrar a tela mais usada do app.
**Critérios de aceite:** BM-14 fechado; um único motor de alertas testado; Dashboard e Central de Alertas usam a mesma fonte.

## Sprint 17 — Limpeza de Banco (naming e performance)
**Objetivo:** remover colunas duplicadas (`faz_id`/`fazenda_id` em `pastagens`, `farm_id`/`fazenda_id` em `customer_subscriptions`, as três colunas de peso em `lotes`), consolidar índices duplicados, adicionar índices faltantes em FKs, resolver policies RLS duplicadas.
**Por que vem agora:** quanto menor a base (piloto), mais barato é limpar — esperar até ter mais contas/dados torna qualquer migração de coluna mais arriscada.
**Arquivos prováveis:** `supabase/migrations/*`, módulos de domínio que leem essas colunas.
**Riscos:** migração de coluna exige backfill cuidadoso e checagem de RLS/policies que referenciam nomes antigos.
**Critérios de aceite:** BM-07, BM-08, BM-09, BM-10, BM-11, BM-13 fechados; advisor do Supabase sem os achados de performance hoje conhecidos.

## Sprint 18 — Navegação, Papéis e Débitos de UX
**Objetivo:** decidir e resolver as 7 páginas órfãs (linkar ou remover formalmente), eliminar a duplicação funcionarios/equipeAcessos, esclarecer `usuarios` vs `profiles`, adicionar histórico por lote e estruturar o protocolo IATF na Sanidade.
**Por que vem agora:** dívida de navegação já documentada há dois sprints sem ação; resolver antes de adicionar mais páginas evita que a lista de órfãs cresça.
**Arquivos prováveis:** `src/navigation/navConfig.js`, `src/App.jsx` (pageMap), páginas órfãs, `src/pages/SanitarioPage.jsx`.
**Riscos:** remover uma página que algum usuário acessa por link direto sem aviso — checar uso real antes de excluir, não só decidir por dedução.
**Critérios de aceite:** BM-12, BM-20, BM-21, BM-24, BM-25 fechados; toda página em `pageMap` está visível na sidebar ou formalmente removida com decisão registrada.

## Sprint 19 — Exportação de Relatórios (PDF/CSV)
**Objetivo:** implementar exportação real para Financeiro/DRE, Relatório de Lote e Relatório Sanitário — a lacuna mais afiada de toda a auditoria (BM-31, P0).
**Por que vem agora:** é o que mais trava o produto virar "plataforma premium de decisão" — um relatório que não sai da tela não serve para o produtor levar ao contador, ao banco ou a um comprador. Vem antes de qualquer nova automação porque não faz sentido automatizar o envio de algo que ainda não pode ser exportado.
**Arquivos prováveis:** `src/utils/exportadores.js` (expandir — já existe para Estoque), páginas de relatório (`RelatorioLotePage`, `RelatorioFinanceiroPage`, `RelatorioSanitario`).
**Riscos:** escolha de biblioteca de PDF tem custo de bundle — carregar sob demanda (lazy), não no chunk principal.
**Critérios de aceite:** BM-31 fechado; export testado manualmente nos três relatórios principais.

## Sprint 20 — DRE por Fazenda e Centro de Custo
**Objetivo:** permitir filtrar o DRE por fazenda; introduzir um conceito leve de centro de custo além da categoria plana atual.
**Por que vem agora:** contas com múltiplas fazendas não conseguem hoje comparar performance financeira entre unidades — lacuna conhecida desde uma auditoria anterior, ainda aberta.
**Arquivos prováveis:** `src/pages/FinanceiroPage.jsx` (`computeDRE`).
**Riscos:** comparar fazendas pode expor rateios de custo compartilhado ainda não totalmente resolvidos.
**Critérios de aceite:** BM-15, BM-16 fechados; seletor de fazenda no DRE com teste de regressão do DRE consolidado.

## Sprint 21 — Telegram Pronto para Produção
**Objetivo:** logging estruturado, rate limiting por chat_id, painel/seção admin mínima para ver conexões ativas.
**Por que vem agora:** prepara o canal de notificação mais barato do produto para escalar com segurança antes de somar um segundo canal (WhatsApp).
**Arquivos prováveis:** `api/telegram-webhook.js`, `api/_telegram.js`, nova seção em Configurações ou página admin.
**Riscos:** rate limit mal calibrado pode bloquear uso legítimo — testar com margem generosa antes de apertar.
**Critérios de aceite:** BM-17 fechado; log estruturado consultável; rate limit testável; conexões ativas visíveis para suporte.

## Sprint 22 — Automação de Tratativa de Alertas
**Objetivo:** alertas resolvidos/adiados passam a ter histórico consultável (quem, quando); o app passa a "cobrar" tratativa (reaparecer se não resolvido em X dias).
**Por que vem agora:** só faz sentido depois da Central de Alertas ser única (Sprint 16) — é o salto de Nível 4 (Recomendação) para Nível 5 (Automação) na [matriz de maturidade](HERDON_MATRIZ_MATURIDADE_DECISAO.md).
**Arquivos prováveis:** `alertas_resolvidos`, `alertas_adiados` (tabelas já existentes — confirmar uso real), `src/domain/centralAlertas.js`.
**Riscos:** calibrar mal pode gerar fadiga de notificação (excesso de cobrança).
**Critérios de aceite:** BM-18 fechado; alerta resolvido não reaparece; alerta adiado reaparece na data certa; histórico consultável.

## Sprint 23 — WhatsApp (Fundação)
**Objetivo:** reaproveitar a arquitetura do Telegram (tabela de conexões, motor de intenção por regras, geradores de resposta) para um canal WhatsApp via provedor oficial.
**Por que vem agora:** só compensa depois que Telegram está robusto (Sprint 21) e a Central de Alertas é única (Sprint 16) — replicar a mesma dívida em dois canais seria pior do que esperar.
**Arquivos prováveis:** novo `api/whatsapp-webhook.js`, nova tabela de conexões (ou generalização de `telegram_connections` para ser multi-canal).
**Riscos:** exige consentimento explícito (LGPD), custo por mensagem do provedor, e escolha cuidadosa entre Cloud API oficial da Meta e um BSP — não usar bibliotecas não-oficiais que violam os termos de uso do WhatsApp.
**Critérios de aceite:** BM-32 endereçado; MVP de pareamento + `/status` funcionando em canal de teste.

## Sprint 24 — Fundações para Recomendação/IA
**Objetivo:** dar a alertas e simulador uma camada de recomendação textual determinística (regras, sem IA generativa ainda) como ponte para uma futura IA.
**Por que vem agora:** só faz sentido investir em IA generativa depois que os dados e regras de negócio (custo/arroba, alertas) estão consistentes — uma IA em cima de dado errado amplifica o erro em vez de corrigi-lo.
**Arquivos prováveis:** `src/domain/centralAlertas.js`, `src/domain/simuladorCenarios.js`, novo `src/domain/recomendacoes.js`.
**Riscos:** uma recomendação errada é pior do que nenhuma recomendação — regra conservadora, sempre citando a lógica usada (auditável).
**Critérios de aceite:** BM-33, BM-34 endereçados; cada alerta crítico e cada simulação de cenário tem uma frase de recomendação com a regra citada.

---

**Fora da sequência técnica:** BM-29 (Asaas em sandbox) é bloqueio comercial, não técnico — depende de decisão/execução de negócio e pode correr em paralelo a qualquer sprint acima.
