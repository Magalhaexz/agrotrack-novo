# Persistencia operacional do nucleo HERDON

Este sprint tira o nucleo operacional do `initialDb` como fonte principal e passa a usar o Supabase para leitura e escrita das entidades centrais.

## O que passa a ser persistido

- `fazendas`
- `lotes`
- `animais`
- `pesagens`
- `tarefas`
- `rotinas`
- `sanitario`
- `estoque`
- `movimentacoes_animais`
- `movimentacoes_estoque`
- `movimentacoes_financeiras`
- `custos`

## Como aplicar no Supabase

1. Abra o SQL Editor do projeto Supabase.
2. Rode o arquivo [supabase-operational-core.sql](D:/agrotrack-novo/docs/supabase-operational-core.sql).
3. Garanta que o frontend esteja com `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` corretos.
4. Entre no HERDON com um usuario valido.

## Comportamento no app

- o app carrega primeiro as colecoes operacionais do Supabase
- ao editar uma colecao ja coberta neste sprint, o estado local continua atualizando a UI, mas a fonte de verdade passa a ser sincronizada com o backend
- se as tabelas ainda nao existirem ou o acesso estiver indisponivel, o app entra em fallback local temporario para nao quebrar a operacao visual

## O que ainda fica temporario

- `configuracoes`
- `usuarios` locais de compatibilidade
- `funcionarios`
- qualquer modulo ainda nao coberto por tabela propria neste sprint

Esses pontos continuam locais para manter compatibilidade incremental sem quebrar a UX atual. O objetivo deste sprint foi mover o nucleo operacional primeiro.
