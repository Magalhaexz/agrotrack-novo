# Modo Campo Offline — Módulo HERDON

Sprint 23. Primeira versão do Modo Campo: permite continuar registrando
ações importantes no campo quando a internet estiver ruim. Não é o HERDON
inteiro offline — é um conjunto específico de registros essenciais.
Documento técnico de arquitetura em [OFFLINE_HERDON.md](OFFLINE_HERDON.md).

## O que funciona offline

Quatro tipos de registro, todos acessados pela página **Sincronização**
(menu Gestão):

1. **Pesagem** — lote, data, peso médio, quantidade de cabeças (opcional),
   observações. (Pesagem individual por animal também é aceita pela fila,
   mas ainda não tem um formulário próprio nesta tela — ver pendências.)
2. **Mover lote de pasto** — lote, pasto de destino, data, quantidade de
   cabeças (opcional), motivo, observações. Mostra o pasto atual do lote.
3. **Lançar despesa** — fazenda, data, descrição, valor, categoria (mesma
   lista usada em Movimentações Financeiras), observações.
4. **Registrar ocorrência** — fazenda, lote (opcional), data, tipo (manejo,
   sanidade, mortalidade, observação, outro), descrição, observações.

Funciona com ou sem internet: o registro é sempre salvo neste aparelho
primeiro. Se a internet estiver disponível, a sincronização acontece
sozinha em poucos segundos. Se não estiver, o registro fica visível como
"Aguardando envio" até a conexão voltar.

## Onde aparecem as pendências

- **Indicador no topo do app** (ao lado dos outros ícones do cabeçalho):
  - `Conectado` — tudo certo, nenhuma pendência.
  - `Sem internet. Os registros serão salvos neste aparelho e
    sincronizados quando a conexão voltar.` — quando o navegador detecta
    que está sem internet.
  - `N registros aguardando sincronização` — quando há pendências mesmo
    estando online (raro, mas pode acontecer enquanto a sincronização
    automática ainda não rodou).
  - Clicar no indicador abre a página Sincronização.
- **Página Sincronização**: 3 números (aguardando envio, sincronizados, não
  foi possível enviar) + lista completa de registros deste aparelho, cada
  um com a data, o tipo e o status. Itens com erro mostram a mensagem amigável
  do que houve, com um botão "Tentar novamente" só para aquele item.

## Como sincronizar

- **Automático**: assim que a internet volta, o HERDON tenta sincronizar
  sozinho, em segundo plano.
- **Manual, tudo de uma vez**: botão "Tentar sincronizar agora" no topo da
  página Sincronização.
- **Manual, um item**: botão "Tentar novamente" ao lado de cada registro
  com erro.

## Mensagens que o usuário vê

| Situação | Mensagem |
|---|---|
| Sem internet | Sem internet. Os registros serão salvos neste aparelho e sincronizados quando a conexão voltar. |
| Há pendências | N registros aguardando sincronização |
| Sincronizou com sucesso | Registro sincronizado com sucesso. |
| Não conseguiu sincronizar | Ainda não foi possível enviar este registro. Vamos tentar novamente quando a internet voltar. |
| Lote já mudou de pasto antes de sincronizar | Este lote já foi movido para outro pasto antes da sincronização. Confira o pasto atual e repita a movimentação se necessário. |

Nenhuma tela usa termos como "payload", "fila", "RPC", "localStorage" — só
linguagem do dia a dia do criador.

## O que ainda não funciona offline

- **Pesagem individual por animal** não tem formulário próprio nesta
  primeira versão (a fila já aceita o tipo `pesagem_animal`, só falta a
  tela — ver pendências).
- **Qualquer outra tela do app** (Lotes, Pastos, Financeiro completo,
  Importação, etc.) continua exigindo internet normalmente. O Modo Campo
  não substitui essas telas — é um atalho rápido para não perder o registro
  quando a internet falha bem na hora.
- **Edição ou exclusão** de um registro já enviado não é feita pelo Modo
  Campo — use a tela correspondente normalmente.
- **Fotos/anexos** não são suportados nesta versão.

## Riscos conhecidos

- Se o aparelho ficar muito tempo sem sincronizar e acumular muitos
  registros, a lista de pendências pode ficar longa — não há paginação
  nesta primeira versão.
- Em um caso raro (gravação confirmada no banco, mas o aparelho perde a
  resposta antes de marcar como sincronizado), um retry futuro pode
  duplicar o registro no banco. É improvável e rastreável (todo registro
  enviado pelo Modo Campo carrega uma marca interna de origem), mas não é
  estruturalmente impossível nesta versão — ver detalhes técnicos em
  [OFFLINE_HERDON.md](OFFLINE_HERDON.md).
- "Registrar ocorrência" usa a tabela de manejo sanitário por trás (não
  existe uma tabela dedicada de ocorrências ainda) — funciona, mas o
  encaixe é imperfeito para tipos como "mortalidade".

## Pendências futuras

- Formulário de pesagem individual (por animal) no Modo Campo.
- Tabela dedicada de ocorrências, em vez de reaproveitar `sanitario`.
- Constraint de unicidade no banco para fechar a janela de duplicidade.
- Modo offline do carregamento inicial do app (Service Worker/PWA).
- Anexar fotos a uma ocorrência.
- Paginação/filtro na lista de pendências, se o uso real mostrar
  necessidade.
