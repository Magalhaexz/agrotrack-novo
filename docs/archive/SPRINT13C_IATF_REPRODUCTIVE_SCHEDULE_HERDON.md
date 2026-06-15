# SPRINT13C_IATF_REPRODUCTIVE_SCHEDULE_HERDON

## Campos de IATF implementados
A seção **Planejamento IATF / Reprodução** no módulo Sanitário permite registrar:
- nome do protocolo
- fazenda
- lote/grupo (quando disponível)
- data inicial do protocolo
- observação (opcional)
- status: Planejado, Em andamento, Concluído, Cancelado

## Protocolo padrão e offsets de datas
Foi aplicado um protocolo inicial seguro, com offsets ajustáveis na camada frontend:
- Dia 0: início do protocolo
- Dia 8: retirada do dispositivo
- Dia 9: aplicação hormonal
- Dia 10: inseminação
- Dia 40: diagnóstico de gestação
- Dia 55: repasse/revisão

Os valores são editáveis no formulário para não fixar apenas um protocolo como verdade única.

## Como as datas automáticas são calculadas
A partir da data inicial (`data_inicial`), a aplicação gera uma agenda (`iatfAgenda`) somando os offsets em dias para cada evento do protocolo.
A prévia mostra as datas em português e exibe:
- Dia X + evento
- Próxima ação
- Data prevista

No salvamento, o sistema seleciona a primeira data futura/atual como referência de próxima ação (`proxima`) e registra o item no fluxo sanitário operacional já existente.
Também grava metadados no campo `obs` (status, fazenda, offsets e agenda serializada), permitindo reconstruir o cronograma de forma compatível com o modelo atual, sem nova tabela.

## Como funcionam os lembretes reprodutivos no dashboard
Foi adicionado um card **Lembretes reprodutivos** no dashboard, com leitura dos registros IATF já persistidos em `sanitario`:
- IATF hoje
- Próximas ações reprodutivas (janela de até 14 dias)
- Protocolos em andamento
- Mensagem de estado vazio: "Nenhuma ação reprodutiva pendente"

Também são exibidos até dois próximos protocolos com nome, lote e data prevista.

## Fluxo de cadastro IATF concluído
- formulário na seção de Reprodução com nome, fazenda, lote/grupo, data inicial, status e observação
- offsets editáveis no mesmo fluxo para retirada, aplicação hormonal, inseminação, diagnóstico e repasse/revisão
- prévia visual da agenda com \"Próxima ação\" e \"Data prevista\" em português
- salvamento pelo mesmo pipeline de manejo sanitário, evitando mudanças de infraestrutura

## Estratégia de persistência utilizada
A persistência reutiliza o padrão operacional existente, sem criação de nova estrutura de banco:
- gravação no conjunto já utilizado por manejo sanitário (`sanitario`)
- uso das funções já existentes de persistência operacional/local-cloud
- tag semântica de IATF em `tipo` e metadados ricos no `obs` para leitura posterior no dashboard e reprocessamento de agenda
- sem criação de tabelas novas e sem mudança de schema Supabase

## O que intencionalmente não foi alterado
- schema Supabase
- políticas RLS
- regras de autenticação
- núcleo de sync cloud/manual diagnostic
- cálculos financeiros
- cálculos de GMD/consumo de lotes
- lógica de pagamentos diários
- registro de resultado de diagnóstico de gestação (ficou apenas o agendamento da data)

## Resultados dos testes
- `rg -n "^(<<<<<<<|=======|>>>>>>>)" -S .` sem conflitos
- `npm run build` concluído com sucesso
- `npm run lint` concluído com sucesso (apenas warnings preexistentes)
