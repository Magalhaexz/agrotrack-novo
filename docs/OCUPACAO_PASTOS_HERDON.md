# Ocupação de Pastos, UA e Alertas de Lotação (Sprint 25)

## O que existe

Para cada pasto cadastrado, o HERDON agora calcula:

- lotes ativos vinculados e quantidade de lotes;
- cabeças estimadas (soma de `lote.qtd` dos lotes ativos no pasto);
- peso médio e peso total estimados (a partir dos animais ativos desses lotes);
- lotação estimada (UA estimada ÷ capacidade do pasto em UA);
- status: `vazio`, `sem dados suficientes`, `ok`, `atenção` ou `acima da capacidade`.

Implementado em `src/domain/ocupacaoPastos.js`, função principal `calcularOcupacaoPastos(db, { fazendaId })` (e `calcularOcupacaoPasto()` para um único pasto).

## Como a lotação é calculada

A lotação estimada usa a **Unidade Animal já existente no HERDON** (`calcularUaPorLote()`, em `src/domain/unidadeAnimal.js`, fórmula peso vivo ÷ 450 — usada hoje na página de Pastos para o diagnóstico de capacidade da fazenda). Esta sprint reaproveita essa mesma fórmula simples no nível do pasto individual, comparando:

```
UA estimada do pasto (soma da UA dos lotes ativos vinculados)
        ÷
Capacidade do pasto em UA (área_ha × capacidade_suporte_ua_ha)
```

**Por que UA e não só cabeças?** A Sprint 24 já tinha um indício de excesso (`construirResumoPastos().pastosComIndicioDeExcesso`) que comparava **cabeças** (uma unidade) com **capacidade em UA** (outra unidade) — uma comparação que dependia totalmente do peso médio do rebanho coincidir com o "peso padrão" de uma UA (450 kg). A fórmula desta sprint compara UA com UA, dos dois lados, o que é mais correto sem precisar de nenhum cálculo novo: a fórmula UA já existe, é simples (peso ÷ 450, sem ajuste por categoria/idade/estação) e já é usada noutra tela do HERDON.

`pastosComIndicioDeExcesso` foi mantido para não quebrar compatibilidade, mas não é mais o usado nas telas — `status`/`pastosEmAtencao`/`pastosAcimaCapacidade` são as fontes corretas a partir desta sprint.

### Classificação (ordem de prioridade)

1. **Vazio** — pasto sem nenhum lote ativo vinculado, mesmo que área/capacidade estejam preenchidas. Um pasto vazio não precisa de aviso de lotação.
2. **Sem dados suficientes** — tem lote(s) ativo(s), mas falta `area_ha` e/ou `capacidade_suporte_ua_ha` no pasto, então não há como calcular o percentual.
3. **Ok** — lotação estimada até 80% da capacidade.
4. **Atenção** — lotação estimada entre 80% e 100% da capacidade.
5. **Acima da capacidade** — lotação estimada acima de 100%.

> Estimativa operacional baseada na capacidade informada do pasto. Não substitui cálculo técnico de lotação por UA (sem ajuste por categoria animal, fase produtiva, estação do ano, qualidade da forragem etc.).

## Onde aparece no app

| Local | O que mostra |
|---|---|
| `PastagensPage` (Pastos) | Nova coluna "Lotação" na tabela: lotes ativos · cabeças estimadas, badge de status, aviso quando acima da capacidade ou faltando dados |
| Dashboard / "Hoje na Fazenda" | Card "Pastos em uso" mostra os pastos acima da capacidade e em atenção pelo nome; novas prioridades "X pastos estão acima da capacidade" (crítico) e "X pastos precisam de atenção na lotação" (atenção) |
| `buildAlerts()` (Alertas) | 4 tipos novos de alerta `tipo: 'pasto'` (ver abaixo) |
| Relatório de Pastos | Tabela "Ocupação por pasto" com cabeças/peso estimados, percentual de ocupação e status; lista de lotes sem pasto definido |
| Resumo de Pastos por WhatsApp | Inclui contagem de pastos acima da capacidade e em atenção |

## Alertas criados

Em `src/utils/alerts.js`, seção "Alertas de Ocupação de Pastos":

| Situação | `tipo` | `nivel` | Texto |
|---|---|---|---|
| Pasto acima da capacidade | `pasto` | `critical` | "Pasto acima da capacidade" |
| Pasto em atenção (80-100%) | `pasto` | `warning` | "Pasto em atenção na lotação" |
| Pasto com lote mas sem área/capacidade | `pasto` | `info` | "Pasto sem área ou capacidade informada" |
| Lote ativo sem pasto definido | `pasto` | `warning` | "Lote sem pasto definido" |

Pastos vazios (sem lote ativo) não geram alerta — evita ruído sobre pastos que estão simplesmente livres.

## Limitações conhecidas

- Não é um cálculo zootécnico de lotação (sem categoria animal, fase produtiva, estação do ano, qualidade de forragem).
- Depende do produtor preencher `area_ha` e `capacidade_suporte_ua_ha` no pasto — sem isso, o status fica "sem dados suficientes".
- `cabecasEstimadas` usa `lote.qtd` (campo do lote), não a soma dinâmica de `animais.qtd`; `pesoMedioEstimado`/`pesoTotalEstimado` usam `animais.p_at` dos animais ativos vinculados aos lotes do pasto.
- Nenhuma tabela nova foi criada — toda a informação já existe em `pastagens` e `lotes`.

## Pendências futuras

- Cálculo técnico de UA por categoria/peso (ajustado por faixa etária e fase produtiva).
- Suporte por estação do ano.
- Integração com mapa da fazenda.
- Taxa de lotação por período (histórico, não só foto do momento atual).
- Histórico de ocupação por pasto.
- Recomendação automática de rotação de pastos.
