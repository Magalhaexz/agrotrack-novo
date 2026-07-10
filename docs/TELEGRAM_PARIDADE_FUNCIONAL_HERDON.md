# Paridade funcional App ↔ Telegram (HERDON)

Mapa do que o app faz versus o que já está disponível pelo Telegram. Serve para
guiar as próximas fases — **não afirma paridade completa**. Estado por commit
atual (interface operacional em construção).

Legenda de status: ✅ disponível · 🟡 parcial · ⛔ ausente · 🔒 bloqueado por regra/segurança.

## Fazendas
| Função | Consulta | Ação | Telegram | Status |
|--------|:--:|:--:|--|--|
| Listar fazendas | ✔ | | `/fazendas` | ✅ |
| Selecionar fazenda | | ✔ | "usar fazenda X" | ✅ |
| Resumo da fazenda | ✔ | | `/resumo` | ✅ |
| Parâmetros/metas | ✔ | ✔ | — | ⛔ (fase posterior) |

## Lotes
| Função | Telegram | Status |
|--------|--|--|
| Listar / detalhar | `/lotes`, `/lote NOME` | ✅ |
| Transferir animais | "transferir N do lote A para B" | ✅ |
| Renomear | "renomear lote A para B" | ✅ |
| Cadastrar lote | — | ⛔ (Fase 3 pendente) |
| Entrada/saída/mortalidade | — | 🟡 (só transferência) |
| Encerrar lote | — | ⛔ |
| Resultado/custos/histórico | parcial via `/lote` e `/resumo` | 🟡 |

## Pesagens
| Função | Telegram | Status |
|--------|--|--|
| Listar / última / GMD | `/pesagens`, `/lote` | ✅ |
| **Registrar pesagem** | "registre pesagem de 425 kg no lote X" | ✅ |
| Editar/cancelar pesagem | — | ⛔ (Fase 4) |

## Sanidade e manejo
| Função | Telegram | Status |
|--------|--|--|
| Consultar (atrasados/próximos) | `/manejos` | ✅ |
| Cadastrar/concluir/reagendar manejo | — | ⛔ (Fase 3/4 pendente) |

## Estoque
| Função | Telegram | Status |
|--------|--|--|
| Listar / item / estoque baixo | `/estoque`, "quanto tenho de X" | ✅ |
| **Registrar entrada** | "adicionar 20 sacos de sal no estoque" | ✅ |
| Saída / ajuste / mínimo | — | ⛔ (Fase 3/4 pendente) |

## Financeiro
| Função | Telegram | Status |
|--------|--|--|
| Resumo / vencidas / a vencer | `/financeiro`, "quanto gastei este mês" | ✅ |
| **Cadastrar despesa** | "gastei 500 reais com sal" | ✅ |
| **Cadastrar receita** | "recebi 15 mil pela venda" | ✅ |
| Marcar paga/recebida, vencimento, cancelar | — | ⛔ (Fase 4) |

## Alertas
| Função | Telegram | Status |
|--------|--|--|
| Listar/consultar | `/alertas` | ✅ |
| Marcar lido/resolver | — | 🔒 (resolver só via ação real: pagar/repor/concluir) |

## Relatórios / Decisão / Pastagens
| Área | Telegram | Status |
|------|--|--|
| Relatórios PDF/Excel | — | ⛔ (Fase 5) |
| Decisão de venda / cenários | — | ⛔ (Fase 5) |
| Pastagens (consulta/registro) | — | ⛔ (fase posterior) |

## Cobertura real (aproximada)

```text
Consultas:  9 de ~12   (75%)  — falta decisão/venda, pastagens, histórico detalhado
Cadastros:  4 de ~8    (50%)  — pesagem, despesa, receita, entrada de estoque
Edições:    1 de ~8    (12%)  — só renomear lote (via ação, sprint anterior)
Ações:      3 de ~10   (30%)  — transferir, renomear, selecionar fazenda
Relatórios: 0 de ~6    (0%)

Paridade operacional total estimada: ~35%
```

Infra transversal já pronta (não conta como função, mas habilita todas):
linguagem natural + extração de entidades, conversa em etapas, permissões por
papel, isolamento por fazenda, operações pendentes + confirmação + auditoria.

## Próximas fases (ordem sugerida — Parte 26)
- **Fase 3 restante:** cadastro de lote; manejo; saída de estoque; movimentação
  de animais (compra/venda/mortalidade).
- **Fase 4:** editar pesagem; reagendar/concluir manejo; marcar conta paga/recebida;
  ajustar estoque/meta.
- **Fase 5:** relatórios PDF/Excel; decisão de venda; resumo semanal.
