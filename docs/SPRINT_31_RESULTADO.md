# Sprint 31 — Resultado

## Funcionalidade entregue

**Modo Curral / Registro Rápido**

Uma página nova (`modoCurral`) que reúne as 4 ações mais comuns do dia a
dia operacional — pesagem, movimentação de pasto, despesa, ocorrência —
numa única tela mobile-first, com poucos cliques. Toda a lógica de
negócio, validação e persistência (online e offline) já existia desde o
Modo Campo Offline (Sprint 23); esta sprint não duplicou nada disso —
apenas criou um ponto de entrada melhor e extraiu o código compartilhado
para evitar duplicação entre as duas telas que agora usam as mesmas ações.

## 1. Onde fica o Modo Curral

Menu → Operação → **Modo Curral** (primeiro item da seção, ícone
`Warehouse`). `pageId`: `modoCurral`. Página:
[`src/pages/ModoCurralPage.jsx`](../src/pages/ModoCurralPage.jsx).

## 2. Ações rápidas criadas

| Ação | Permissão | Formulário reaproveitado |
|---|---|---|
| Registrar pesagem | `pesagens:editar` | `RegistrarPesagemOfflineModal` (Sprint 23) |
| Mover lote de pasto | `lotes:editar` | `RegistrarMovimentacaoPastoOfflineModal` (Sprint 23) |
| Lançar despesa | `financeiro:editar` | `RegistrarDespesaOfflineModal` (Sprint 23) |
| Registrar ocorrência | `sanitario:editar` | `RegistrarOcorrenciaOfflineModal` (Sprint 23) |
| Ver pendências | — | navega para a página Sincronização |

Sanidade/suplementação não ganharam atalho dedicado nesta sprint —
"Sanidade" já é um dos tipos de ocorrência, e um atalho estruturado exigiria
um formulário novo mapeado para `sanitario`/`suplementacao`, fora do que a
sprint autorizou ("só incluir se não exigir criar módulo grande novo").
Documentado como pendência.

## 3. Como funciona online

`adicionarOperacaoOffline` enfileira o registro localmente (mesmo caminho
de sempre); com internet, a sincronização automática (`useOfflineAutoSync`,
já montada em `App.jsx` desde a Sprint 23) dispara quase imediatamente.
O usuário vê "`<ação> registrada.` Sincronizando agora." e o item
normalmente sai da lista de pendências em poucos segundos.

## 4. Como funciona offline

Mesmo caminho de enfileiramento; sem internet, a sincronização automática
não dispara. O usuário vê a mensagem de pendência ("Ainda não foi possível
enviar este registro. Vamos tentar novamente quando a internet voltar.") e
o registro fica visível em "Ver pendências" até sincronizar.

## 5. Como aparece a sincronização

Bloco no topo da página: indicador de conexão (`ConnectionIndicator`,
reaproveitado sem alteração), contagem de pendentes, botão "Ver
pendências" (navega para a página Sincronização) e "Tentar sincronizar
agora" (mesma função usada lá). Se há erro, aparece o aviso "Alguns
registros ainda não foram enviados. Toque em 'Ver pendências' para
revisar."

## 6. Resultado do teste manual

**Parcial, documentado honestamente.** Sem credenciais de uma conta
autenticada disponíveis nesta sessão, não foi possível abrir o Modo Curral
de fato e percorrer o fluxo completo (mesma limitação de todas as sprints
desde a 22). O que foi verificado: o app builda e roda sem erros, a tela de
login carrega corretamente em viewport mobile (375px) sem erros de console
ou de servidor. Roteiro completo de 11 itens pendentes de execução por
alguém com acesso autenticado — ver
[MODO_CURRAL_TESTE_MANUAL.md](MODO_CURRAL_TESTE_MANUAL.md).

## 7. Quantidade de testes criados

**8 testes novos**, em `src/domain/modoCurral.test.js`, cobrindo:
contagem de fazendas/lotes ativos/pastagens; `db` nulo ou vazio; lote sem
campo `status` (tratado como ativo); e as 5 combinações de mensagem de
estado vazio (sem fazenda online, sem fazenda offline, sem lote, tudo ok,
resumo nulo). Os payloads/validações das 4 ações em si (pesagem,
movimentação, despesa, ocorrência) já tinham testes desde a Sprint 23
(`offlineCaptureLogic.test.js`, `movimentacaoPastoLogic.test.js`,
`offlineQueue.test.js`) — não duplicados, porque a lógica não mudou.

## 8. Resultado de `npm test`, `lint` e `build`

| Gate | Resultado |
|---|---|
| `npm test` | 546 testes, 0 falhas (538 antes + 8 novos) |
| `npm run lint` | 0 erros |
| `npm run build` | Build de produção concluído com sucesso |

## Arquivos novos

| Arquivo | Descrição |
|---|---|
| `src/pages/ModoCurralPage.jsx` | Página do Modo Curral |
| `src/hooks/useRegistroRapido.js` | Hook compartilhado (permissão + fila + toast) |
| `src/components/curral/RegistroRapidoModais.jsx` | Agrupa os 4 modais existentes |
| `src/domain/modoCurral.js` | Lógica pura de estado vazio |
| `src/domain/modoCurral.test.js` | 8 testes da lógica acima |
| `docs/MODO_CURRAL_HERDON.md` | Documentação de produto/arquitetura do Modo Curral |
| `docs/REGISTRO_RAPIDO_HERDON.md` | Documentação do mecanismo compartilhado |
| `docs/MODO_CURRAL_TESTE_MANUAL.md` | Registro honesto do que foi e não foi testado |
| `docs/SPRINT_31_RESULTADO.md` | Este documento |

## Arquivos modificados

| Arquivo | O que mudou |
|---|---|
| `src/pages/SincronizacaoPage.jsx` | Refatorada para usar `useRegistroRapido`/`RegistroRapidoModais` — comportamento idêntico, sem duplicação |
| `src/navigation/navConfig.js` | Item `modoCurral` adicionado à seção Operação |
| `src/App.jsx` | Lazy import + `pageMap` para `ModoCurralPage` |
| `src/auth/perfis.js` | Permissão `modoCurral: 'dashboard:ver'` (mesmo padrão de `sincronizacao`) |
| `src/lucide-react.js` | 4 ícones novos: `Warehouse`, `ClipboardPlus`, `ListChecks`, `MapPinned` |
| `src/styles/dashboard.css` | CSS mobile-first `.modo-curral-grid`/`.modo-curral-card` |
| `docs/OFFLINE_HERDON.md` | Nota sobre a extração do hook compartilhado |
| `docs/NAVEGACAO_HERDON.md` | Novo item de menu + ícones documentados |
| `docs/BETA_PILOTO_READY_HERDON.md` | Atualização de sprint |

## Decisões técnicas

### Por que não criar formulários novos

O diagnóstico (Etapa 1) encontrou que as 4 ações pedidas já existiam,
completas e testadas, dentro do Modo Campo Offline (Sprint 23) — só não
tinham uma porta de entrada própria, prática para o campo. Duplicar esses
formulários só para a nova página violaria a instrução explícita da sprint
("reaproveitar os serviços e fluxos já existentes, não duplicar regra de
negócio").

### Por que extrair `useRegistroRapido`/`RegistroRapidoModais`

Sem extrair, a única forma de ter os 4 modais e o fluxo de
permissão/fila/toast em duas telas seria copiar ~80 linhas de
`SincronizacaoPage.jsx`. A extração elimina a duplicação e garante que as
duas telas nunca divirjam em comportamento (mesma mensagem, mesma
permissão, mesma fila) por construção, não por disciplina manual.

### Por que não adicionar permissão/módulo de plano restritivo

`sincronizacao` já não está em nenhuma lista de módulos por plano
(`src/services/subscriptions.js`) — ou seja, hoje ela é tratada como
recurso disponível independente de plano. Para manter consistência e não
tomar uma decisão de regra comercial sem autorização (proibido nesta
sprint), `modoCurral` recebeu o mesmo tratamento: permissão de perfil
`dashboard:ver`, sem entrada em listas de módulo por plano.

## Limitações conhecidas

- Não há atalho dedicado para sanidade/suplementação.
- Nenhuma verificação visual/funcional com conta autenticada foi possível.
- A pendência de migrations da Sprint 30.1
  (`supabase migration repair --status applied 20260618000000`) continua
  aberta — fora do escopo desta sprint.

## Pendências para Sprint 32

- Rodar o roteiro completo de teste manual (ver
  `docs/MODO_CURRAL_TESTE_MANUAL.md`) com conta autenticada real.
- Avaliar atalho dedicado para manejo sanitário/suplementação no Modo
  Curral, se a demanda do piloto justificar.
- `supabase migration repair --status applied 20260618000000` (Sprint
  30.1, ainda pendente).
- Avaliar os avisos do `get_advisors` do Supabase (Sprint 30.1, ainda
  pendente).
- Considerar leitura por brinco/RFID, fotos/evidências, modo PWA real e
  integração com balança — todas fora de escopo desta sprint, levantadas
  como ideias futuras pelo próprio pedido da sprint.
