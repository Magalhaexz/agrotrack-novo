# SPRINT13D_CLOUD_REGISTRATION_AUDIT_HERDON

## Fluxos auditados
1. Fazendas
2. Lotes
3. Animais
4. Estoque / suplementos
5. Planejamento no cadastro de lote (GMD/dieta/consumo/projeções)
6. Financeiro / movimentações
7. Pagamentos Diários
8. Sanitário
9. IATF/Reprodução e lembretes de dashboard

## Resultado por fluxo

### 1) Fazendas
- Usa `createOperationalRecord`, `updateOperationalRecord`, `deleteOperationalRecord`.
- Salva localmente no estado da aplicação.
- Tenta nuvem quando sessão/cloud estão prontas.
- Mantém fallback local com mensagens amigáveis em português.
- **Status:** cloud-ready com fallback seguro.

### 2) Lotes
- Cadastro principal usa `createOperationalRecord('lotes')` e cria animal/custo vinculados com persistência operacional.
- Continua salvando localmente mesmo com falha de nuvem, com feedback ao usuário.
- `saida` permanece `null` no cadastro (não marca saída real indevida).
- **Status:** cloud-ready com fallback seguro.

### 3) Animais
- CRUD usa persistência operacional (`create/update/deleteOperationalRecord`).
- Mantém sincronização local-first e fallback sem simular sucesso indevido.
- **Status:** cloud-ready com fallback seguro.

### 4) Estoque / suplementos
- Movimentações e atualização de estoque usam persistência operacional para estoque/movimentações.
- Fluxo mantém fallback local quando nuvem falha.
- **Status:** cloud-ready com fallback seguro.

### 5) Planejamento no cadastro de lote
- Campos de domínio auditados: GMD esperado, produto/dieta, modo/valor de consumo, data projetada de saída (somente projeção), consumo estimado e custo estimado.
- **Correção aplicada nesta sprint:** metadados de planejamento agora são serializados no `obs` do lote para reuso e auditoria futura sem alterar schema.
- `saida` real continua separada e não é preenchida pela projeção.
- **Status:** compatível com modelo atual (persistência via `lotes.obs` + cálculos de UI/domínio).

### 6) Financeiro / movimentações
- Criação e atualização usam `movimentacoes_financeiras` com persistência operacional.
- Fallback local preservado com mensagens em português.
- **Status:** cloud-ready com fallback seguro.

### 7) Pagamentos Diários
- Persistem em `movimentacoes_financeiras` (modelo compatível escolhido).
- Dashboard lê os pagamentos pelo filtro de categoria/tipo na mesma coleção.
- **Status:** cloud-ready usando estrutura existente.

### 8) Sanitário
- CRUD sanitário usa persistência operacional e lote de mutações para consistência com rotinas automáticas.
- Falha de nuvem não impede persistência local e feedback é amigável.
- **Status:** cloud-ready com fallback seguro.

### 9) IATF/Reprodução + lembretes
- Registro IATF persiste em `sanitario` com `tipo='IATF'` e metadados em `obs`.
- Lembretes no dashboard continuam baseados nesses registros.
- Não há invenção de resultado de diagnóstico gestacional; apenas agendamento de data.
- **Status:** cloud-ready usando padrão compatível de sanitário.

## Fluxos confirmados cloud-ready
- Fazendas
- Lotes
- Animais
- Estoque/suplementos
- Financeiro/movimentações
- Pagamentos Diários (via movimentações_financeiras)
- Sanitário
- IATF/Reprodução (via sanitário)

## Fluxos local-compatíveis apenas (limitações de modelo atual)
- Projeções de lote (saída prevista, consumo estimado, custo estimado) são de domínio/UI e não representam eventos reais de saída.
- Resultado de diagnóstico de gestação não possui entidade dedicada no schema atual.

## Correções realizadas
- Ajuste de auditoria/persistência: serialização explícita dos campos de planejamento do lote em `lotes.obs`, mantendo `saida` real como `null` no cadastro inicial.

## Limitações por schema atual
- Sem entidade dedicada para protocolo reprodutivo separado de sanitário.
- Sem tabela dedicada para resultado clínico de diagnóstico de gestação.
- Projeções de lote permanecem projeções, não eventos de movimentação real.

## Testes
- `rg -n "^(<<<<<<<|=======|>>>>>>>)" -S .` sem conflitos.
- `npm run build` concluído com sucesso.
- `npm run lint` concluído com sucesso (apenas warnings preexistentes).
