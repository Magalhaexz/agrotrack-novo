# SPRINT20J_HOTFIX_PESAGENS_CRASH_AND_INVITES_REMOVE_HERDON

## Arquivos alterados
- `src/pages/PesagensPage.jsx`
- `src/services/userAccess.js`
- `src/pages/ConfiguracoesPage.jsx`

## Bug 1 - Pesagens derrubando o app

### Causa do crash
A página `PesagensPage` renderizava componentes `<Card>` e `<Button>` sem import no arquivo, causando erro de runtime:
`ReferenceError: Card is not defined`.

### Correção aplicada
- Adicionados imports explícitos em `src/pages/PesagensPage.jsx`:
  - `import Card from '../components/ui/Card';`
  - `import Button from '../components/ui/Button';`

### Resultado
- A aba Pesagens deixa de derrubar a aplicação ao abrir.
- Estrutura das abas permanece ativa (Nova pesagem, Histórico, Evolução, Alertas).
- Fluxos de pesagem por lote/animal e batch não tiveram lógica de negócio alterada.

## Bug 2 - Convites não cancelam/removem corretamente (406)

### Causa provável confirmada
No serviço de acessos, `updateInvite` usava `.single()` após `update`, o que pode gerar 406 quando o backend não consegue coercionar resultado para objeto único.

### Correções aplicadas
1. `src/services/userAccess.js`
- `updateInvite` alterado de `.single()` para `.maybeSingle()`.
- Isso elimina dependência rígida de retorno obrigatório com exatamente uma linha.

2. `src/pages/ConfiguracoesPage.jsx`
- Tratamento seguro para erro 406 na função `mensagemErroSegura`:
  - Mensagem exibida: **"Não foi possível atualizar o convite. Atualize a lista e tente novamente."**
- Em `cancelarConvite`:
  - Mantido update de estado local imediato.
  - Mantido refresh determinístico com `carregarDadosDeAcesso()` após sucesso.
  - Adicionado fallback de aviso caso o refresh falhe.
- Em `removerConvitePendente`:
  - Mantida proteção para convite aceito (`status === aceito` ou `used_at`) com mensagem segura.
  - Mantida remoção local imediata e refresh determinístico após sucesso.
  - Adicionado fallback de aviso caso o refresh falhe.

### Regras de segurança preservadas
- Não há hard delete de profile ativo.
- Não houve alteração de schema Supabase.
- Não houve alteração nas regras de último admin/proprietário.
- Não houve exposição de token/session/api key em logs novos.

## Validação executada

### Lint
- Comando: `npm run lint`
- Resultado: **OK**

### Build
- Comando: `npm run build`
- Resultado: **OK**

## Pendências conhecidas
- A validação manual de fluxo real de convites no ambiente conectado (criar/cancelar/remover convite pendente e convite aceito) ainda depende do teste funcional com sessão autenticada e dados reais de `invites`.
- O arquivo `ConfiguracoesPage.jsx` ainda possui textos antigos com encoding inconsistente em outras áreas fora do escopo deste hotfix (não impacta o bug crítico tratado aqui, mas recomenda-se normalização UTF-8 completa em sprint dedicado).

## Resumo final
- Crash crítico de Pesagens resolvido.
- Fluxo de cancelamento/remoção de convites tornado robusto contra erro 406.
- Build e lint limpos.
