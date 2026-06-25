# Simulador de Decisão — HERDON (QA Sprint 35)

Primeira verificação com conta autenticada real. Página:
`src/pages/CenariosPage.jsx`.

## O que existe

Duas ferramentas na mesma página, com propósitos diferentes:

1. **Cenários salvos** — simulação de compra/venda/mortalidade/
   natalidade no nível da fazenda inteira, ao longo de um período, com
   persistência real (tabela `cenarios`).
2. **Decisão: vale a pena comprar este lote?** — calculadora rápida,
   sem persistência, para responder "comprar um lote nessas condições
   compensa?" sem alterar nenhum dado operacional.

## Teste realizado

1. Abri o Simulador com a conta QA — carregou sem erro, sem overflow em
   375px.
2. Criei um cenário ("Cenário QA Sprint 35", período 01/07–31/12/2026,
   5 compras simuladas, 2 vendas simuladas) e cliquei "Salvar cenário".
3. Confirmado por consulta direta ao Supabase: o cenário foi
   **persistido corretamente** na tabela `cenarios`
   (`createOperationalRecord('cenarios', ...)`, chamado de
   `src/pages/CenariosPage.jsx`).
4. A calculadora "Decisão: vale a pena comprar este lote?" já vinha
   pré-preenchida com valores de exemplo e mostrou uma projeção completa
   e coerente sem nenhuma ação adicional: peso final esperado, arrobas
   de compra/venda, custo total, receita projetada, margem bruta,
   lucro/@ e lucro/cabeça, ROI, break-even de venda e um veredito
   ("Viável: SIM"/"NÃO").

## Resultado

**Funciona.** Diferente de Suplementação, o Simulador chama
corretamente a camada de persistência (`createOperationalRecord`/
`updateOperationalRecord`) para os cenários salvos. A calculadora rápida
de "vale a pena comprar" é deliberadamente sem persistência (calculadora,
não cadastro) — consistente com o subtítulo da página ("sem alterar
dados operacionais").

## Termos e clareza

Os rótulos usam termos técnicos do setor (UA, arroba carcaça, break-even,
ROI) sem explicação inline — aceitável para o público-alvo (produtor já
familiarizado com esses termos), mas vale observar como ponto de atenção
para uma eventual revisão de copy/glossário em sprint futura, não como
bug.

## Limitações desta verificação

- Não foram testados cenários com valores extremos/inválidos (ex.: datas
  invertidas, percentuais negativos) — só o caminho feliz.
- Não testado em 768px/desktop (só 375px, sem overflow).
- Não testada a edição/exclusão de um cenário salvo, só a criação.
