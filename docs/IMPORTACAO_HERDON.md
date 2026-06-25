# Importação — HERDON (QA Sprint 35)

Primeira verificação com conta autenticada real, parcial — o ambiente de
preview usado nesta sessão não tem suporte a upload de arquivo binário
(.xlsx), então a etapa de envio do arquivo foi verificada por leitura de
código, não por execução real. Página: `src/pages/ImportacaoPage.jsx`.
Parser/validação: `src/utils/importParser.js`.

## O que foi possível testar

- Abri a página com a conta QA — wizard de 4 passos (Modelo → Envio →
  Revisão → Confirmação) carrega sem erro, sem overflow em 375px.
- Texto de cada passo é claro para o produtor: explica em 4 frases
  simples como baixar o modelo, preencher, enviar e confirmar.
- Lista exatamente o que pode ser importado (fazendas, pastos, lotes,
  animais, pesagens por lote, pesagens por animal) e avisa que as abas
  de pesagem são opcionais.
- Avancei até a tela de upload — confirma aceitar apenas `.xlsx` e avisa
  para usar sempre o modelo oficial.

## O que foi verificado por leitura de código (não executado)

- **Persistência real**: `createOperationalRecord` é chamado para
  `fazendas`, `pastagens`, `lotes`, `animais` e `pesagens` — diferente de
  Suplementação, a Importação **está corretamente conectada ao banco
  real**, não é um mock local.
- **Validação e mensagens de erro**: `src/utils/importParser.js` produz
  mensagens específicas por linha e campo, por exemplo:
  - "O nome da fazenda é obrigatório"
  - `Fazenda "X" não encontrada — verifique se o nome está correto ou se
    está na aba Fazendas`
  - `Código "X" já aparece na linha N — cada lote deve ter um código
    único`
  - `Data inválida: "X". Use o formato AAAA-MM-DD ou DD/MM/AAAA`
  - `Já existe uma pesagem para o lote "X" na data Y neste arquivo (linha
    N)`
- **Duplicidade**: bloqueada de duas formas — (a) dentro do próprio
  arquivo (códigos de lote/brinco repetidos, pesagem duplicada na mesma
  data) são apontados como erro antes de importar; (b) contra o banco —
  "Fazendas, lotes e animais que já existem pelo nome serão pulados
  automaticamente" (mensagem exibida na tela de confirmação).
- **Clareza para o produtor**: mensagens em português simples, sempre
  citando a linha e o campo exatos, com sugestão do que corrigir — sem
  jargão técnico de banco de dados.

## Resultado

**Aparenta estar pronta para uso real**, com base na leitura completa do
código de validação e persistência — mas **não foi exercitada de ponta a
ponta com um arquivo real** nesta sessão. Recomenda-se que o próximo QA
com acesso a upload de arquivo confirme:

1. Baixar o modelo oficial.
2. Preencher com 1 fazenda, 1 pasto, 1 lote, 2 animais, 2 pesagens.
3. Enviar e confirmar que a Revisão mostra os dados certos.
4. Confirmar a importação e checar que os registros aparecem nas telas
   normais (Fazendas, Pastos, Lotes, Animais, Pesagens).
5. Repetir o envio do mesmo arquivo e confirmar que fazendas/lotes/
   animais existentes são pulados (não duplicados).
6. Testar um arquivo com erro propositais (data inválida, lote sem
   fazenda) e confirmar que a mensagem de erro é clara.

## Limitações desta verificação

- Upload de arquivo real não testado (limitação do ambiente, não do
  produto).
- Não verificado se a Importação cria também um grupo em `animais`
  quando o lote tem `quantidade_cabecas` mas a aba "Animais" não foi
  preenchida — mesma lacuna do achado `lotes.qtd` × `animais`
  (Sprint 34/35, ver
  [RESULTADO_LOTE_HERDON.md](RESULTADO_LOTE_HERDON.md)), mas pelo
  caminho de importação. Como a Importação grava `lotes.qtd` por linha
  de planilha, um lote importado sem aba "Animais" preenchida
  provavelmente cai no mesmo "Dados insuficientes" até a Sprint 36
  avaliar se o fallback automático também deve cobrir esse caminho.
