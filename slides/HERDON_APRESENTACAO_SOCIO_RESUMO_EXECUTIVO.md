# HERDON — Resumo Executivo

## O que é

HERDON é um app SaaS de gestão e decisão para pecuária de corte. Centraliza
fazendas, lotes, animais, pesagens, custos, financeiro, estoque, sanidade,
alertas, relatórios e um assistente via Telegram — com o objetivo de levar
o produtor do controle da operação até a decisão que dá lucro.

**Nome:** HERD (rebanho) + ON (ligado/ativo) — "rebanho conectado à
decisão."

## O problema que resolve

Pecuária de corte é uma operação biológica, financeira e logística ao
mesmo tempo, e a maioria dos produtores ainda gerencia isso com planilhas
soltas, papel e intuição: custo por lote pouco claro, estoque controlado
"de cabeça", sanidade sem integração com o resto da operação, e nenhum
alerta de risco antes do problema acontecer.

## O que já existe hoje (comprovado em código, não em intenção)

- **Operação:** fazendas independentes (multi-fazenda), lotes, animais,
  pesagens com GMD, pastagens (ocupação/capacidade), rotinas e tarefas,
  modo curral para uso em campo.
- **Financeiro:** custo/@ e lucro/@ de carcaça com cálculo consolidado e
  único (Sprint 14), Financeiro, DRE, Fluxo de Caixa, Comparativo de
  Lotes, Simulador de Cenários.
- **Estoque e sanidade:** baixa automática de estoque por aplicação
  sanitária e por suplementação (validado ponta a ponta, inclusive
  sobrevivência a reload), controle de carência, previsão de dias
  restantes de estoque por produto.
- **Decisão:** Central de Alertas com tratativa real (em análise /
  resolvido / adiado / ignorado), motor único de alertas compartilhado
  entre Dashboard, Central e Telegram, Assistente HERDON com perguntas de
  decisão pré-definidas sobre dado real (sem IA generativa).
- **Conectividade:** Telegram bidirecional (comandos reais, não só
  notificação), modo offline com fila de sincronização, relatórios
  exportáveis em CSV/PDF na maioria dos módulos, importação de planilhas
  Excel (.xlsx) testada de ponta a ponta.
- **Negócio:** SaaS por assinatura com 5 planos (Essencial a Enterprise),
  trial de 14 dias, paywall que bloqueia só a escrita (visualização
  liberada mesmo sem plano), integração de cobrança (Asaas) implementada
  tecnicamente, equipe com 4 papéis de permissão.

## Maturidade técnica

Mais de 37 sprints de desenvolvimento documentados, 972 testes automatizados
passando, QA visual auditado (responsivo mobile/tablet/desktop), QA
funcional "botão por botão" nos módulos de maior risco (cadastro, pesagem,
financeiro, estoque, importação) e auditoria de segurança sem vulnerabilidade
ativa conhecida (pendências remanescentes classificadas como hardening).

## Estado comercial

Cobrança via Asaas tecnicamente pronta, hoje em ambiente de testes
(sandbox) — ativação em produção é decisão de negócio, não bloqueio
técnico. Produto em fase final de preparação para piloto com produtor real
em campo.

## O que falta antes de escalar (honesto, sem maquiagem)

- Ciclo completo de feedback com produtor real em uso contínuo.
- Ajustes de UX a partir desse uso real.
- Ativação comercial em produção (sair do sandbox).
- WhatsApp como canal ativo (hoje só Telegram é bidirecional).
- Onboarding estruturado, marketing, suporte ao cliente e métricas de uso
  em escala.

## Roadmap (não implementado — visão de futuro)

WhatsApp ativo, camada de IA sobre o Assistente HERDON já existente, app
mobile nativo, integrações fiscais/financeiras, benchmarking entre lotes e
fazendas, previsão de venda e de compra de insumos, painel do consultor,
marketplace, parcerias com veterinários e nutricionistas.

## Modelo de negócio

SaaS por assinatura recorrente, planos por tamanho de operação
(fazendas/cabeças/usuários), público-alvo: pecuarista de corte
(recria/engorda/confinamento), consultor agro e operações multi-fazenda.
Expansão de receita por três eixos: mais fazendas, mais usuários, mais
módulos por conta.

## Por que agora é o momento de entrar como sócio

O produto já superou a parte mais arriscada — construir algo que funciona
de verdade, com integração real entre módulos (não só telas bonitas). O
que resta é crescimento: mercado, comercial, capital e rede — exatamente
onde um sócio certo faz a diferença. A proposta não é só investimento, é
parceria estratégica compartilhando decisão sobre onde o HERDON vai.

---

*Este resumo acompanha os documentos completos:
`HERDON_APRESENTACAO_SOCIO.md` (slides) e
`HERDON_APRESENTACAO_SOCIO_ROTEIRO.md` (roteiro de fala).*
