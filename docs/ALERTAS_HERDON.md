# Alertas — Sistema Unificado HERDON

**Data:** 2026-06-17
**Arquivo principal:** `src/utils/alerts.js` → `buildAlerts(db)`

---

## Arquitetura

O sistema de alertas é centralizado em uma única função pura:

```js
import { buildAlerts } from './utils/alerts';
const alerts = buildAlerts(db); // retorna array ordenado
```

`buildAlerts(db)` recebe o objeto `db` (dados operacionais completos) e retorna um array de objetos de alerta ordenados por **nível** (critical antes de warning) e depois por **data** (mais urgente primeiro).

### Schema de alerta

```js
{
  id:        string,      // identificador único do alerta
  ackKey:    string,      // chave para marcar como resolvido
  tipo:      string,      // 'estoque' | 'sanitario' | 'rotina' | 'pesagem' | 'lote' | 'financeiro'
  tipoLabel: string,      // label legível para o usuário: 'Estoque', 'Sanitário', etc.
  nivel:     string,      // 'critical' | 'warning' | 'info'
  titulo:    string,      // título curto do alerta
  mensagem:  string,      // descrição detalhada
  pagina:    string,      // rota de navegação para a página relacionada
}
```

---

## Tipos de alertas implementados

### Estoque (`tipo: 'estoque'`)

| Trigger | Nível | Exemplo de título |
|---------|-------|-------------------|
| `quantidade_atual <= quantidade_minima` | critical | Estoque crítico |
| `quantidade_atual <= quantidade_minima × 1.5` | warning | Estoque baixo |
| `data_validade < hoje` | critical | Produto vencido no estoque |
| `data_validade dentro de alerta_dias_antes` | warning | Validade próxima no estoque |

### Sanitário (`tipo: 'sanitario'`)

| Trigger | Nível | Título |
|---------|-------|--------|
| `proxima < hoje` | critical | Manejo sanitário vencido |
| `proxima dentro de alerta_dias_antes dias` | warning | Manejo sanitário próximo |

### Rotinas / Tarefas (`tipo: 'rotina'`)

| Trigger | Nível | Título |
|---------|-------|--------|
| Tarefa não concluída com `data < hoje` | critical | Tarefa atrasada |
| Tarefa com `data == hoje` | warning | Tarefa pendente hoje |
| Rotina recorrente válida hoje e não concluída | warning | Rotina recorrente pendente hoje |

### Pesagem (`tipo: 'pesagem'`)

| Trigger | Nível | Título |
|---------|-------|--------|
| Lote ativo sem nenhuma pesagem | critical | Lote sem pesagem |
| Última pesagem há > 45 dias | critical | Pesagem muito atrasada |
| Última pesagem há > 30 dias | warning | Pesagem pendente |

### Saída de Lote (`tipo: 'lote'`)

| Trigger | Nível | Título |
|---------|-------|--------|
| Lote ativo com `saida < hoje` | critical | Saída de lote vencida |
| Lote ativo com `saida` em até 7 dias | warning | Saída de lote próxima |

### Financeiro (`tipo: 'financeiro'`)

| Trigger | Nível | Título |
|---------|-------|--------|
| Despesa `previsto`/`realizado` com `data_vencimento < hoje` | critical | Pagamento vencido |
| Despesa com vencimento em até 3 dias | warning | Pagamento próximo do vencimento |

> **Nota:** Apenas despesas geram alertas. Receitas e movimentações pagas/canceladas são ignoradas.

---

## Integração com App.jsx

```js
// App.jsx — rawAlerts
const rawAlerts = useMemo(() => {
  return buildAlerts(db).map((alert) => ({
    ...alert,
    route: alert?.pagina || null,
    ackKey: getAlertAckKey(alert),
  }));
}, [db]);
```

Alertas resolvidos e adiados são filtrados por `resolvedAlertKeys` e `snoozedAlerts` antes de chegar às telas.

---

## Testes

`src/utils/alerts.test.js` — 20 testes cobrindo:
- Estoque crítico, baixo, vencido
- Pesagem ausente, atrasada (>45 dias), pendente (>30 dias)
- Lote saída vencida, próxima, sem alerta quando longe
- Financeiro vencido, próximo, ignorado quando pago/cancelado/receita
- Ordenação (critical antes de warning)
- Estrutura mínima de todos os campos

---

## Constantes configuráveis

```js
const PESAGEM_WARN_DIAS = 30;        // alerta warning de pesagem
const PESAGEM_CRITICAL_DIAS = 45;    // alerta critical de pesagem
const LOTE_SAIDA_ALERT_DIAS = 7;     // janela de alerta de saída
const FINANCEIRO_VENCIMENTO_WARN_DIAS = 3; // janela de alerta de vencimento
```

---

## Histórico

- Sprint 14 (2026-06-17): Consolidação de `domain/alertas.js` + novos alertas de pesagem, saída e financeiro
- Sprint anterior: `buildAlerts` (utils) + `gerarAlertasXxx` (domain) em paralelo — schemas incompatíveis
