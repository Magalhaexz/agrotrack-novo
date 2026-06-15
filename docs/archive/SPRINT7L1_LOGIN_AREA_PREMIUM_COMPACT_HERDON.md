# Sprint 7L.1 — Login Area Compact Premium Refactor

## Objetivo
Refinar visualmente a área de login do HERDON para deixá-la mais compacta, premium, equilibrada e segura em desktop e mobile, sem alterar a autenticação.

## Arquivos alterados
- `src/styles/login.css`

## Refinamentos aplicados

### Composição geral
- Layout principal recalibrado para reduzir o peso visual do hero e aproximar melhor o equilíbrio entre branding e formulário.
- Superfície externa com moldura mais contida, brilhos mais discretos e densidade vertical mais eficiente.
- Proteção contra clipping com `min-height: 100dvh` e `overflow-y: auto` na página.

### Hero / área de marca
- Redução de tamanhos do bloco de marca, logo, título e textos auxiliares.
- Menor espaçamento entre blocos do hero para evitar uma composição esticada.
- Cards de benefícios compactados com menos altura mínima, menos padding e tipografia mais enxuta.
- Hero continua premium e legível, mas menos dominante.

### Card de autenticação
- Card de login ficou mais compacto: menor raio, padding reduzido e hierarquia mais firme.
- Título, subtítulo, topline, feedbacks e rodapé foram aproximados para reduzir espaço vazio.
- Inputs e botões ficaram mais contidos, mantendo boa área de toque e legibilidade.
- Blocos de atalhos e mensagens ficaram mais leves e alinhados ao restante da composição.

### Mobile e telas baixas
- Melhor empilhamento em `820px` e `560px`, sem cortar ações importantes.
- Ajustes específicos para alturas menores (`860px` e `720px`) para evitar estouro vertical em notebooks baixos e celulares.
- Inputs e botões permanecem visíveis e usáveis em mobile.
- O layout agora sobe melhor na tela quando a altura disponível é menor.

## Itens preservados
- Login por e-mail e senha preservado.
- Login com Google preservado.
- Acesso para criar conta preservado.
- Acesso para recuperar senha preservado.
- Nenhuma lógica de autenticação foi alterada.
- Nenhum texto funcional voltado ao usuário foi removido.

## Validação

### Build
`npm.cmd run build`

Resultado: sucesso.

### Lint
`npm.cmd run lint`

Resultado: sucesso com `30 warnings` preexistentes de `react-hooks/exhaustive-deps`, sem novos erros.

## Validação manual
Nao executada em navegador nesta sessao. Recomenda-se confirmar:
- formulario totalmente visivel
- botoes de entrar / Google / criar conta / recuperar senha acessiveis
- uso confortavel em mobile
- ausencia de clipping horizontal ou vertical
- nenhuma mudanca em comportamento de autenticacao
