# Importação — Pronto para Beta (Herdon)

**Data:** 2026-06-18  
**Sprint:** 20.1 — Validação E2E  
**Avaliador:** Claude Code (Sprint 20.1)

---

## Checklist de prontidão

| Item | Status | Observação |
|------|--------|------------|
| Wizard completo (4 passos) | ✓ | Modelo → Envio → Revisão → Confirmação → Resultado |
| Download do modelo .xlsx | ✓ | 6 abas, dados de exemplo, campos obrigatórios marcados |
| Upload e leitura do arquivo | ✓ | SheetJS, `.xlsx` real, seriais de data convertidos |
| Validação antes de salvar | ✓ | Função pura, erros por aba/linha/campo/orientação |
| Bloqueio de duplicatas (lotes/animais) | ✓ | Por nome/código exato |
| Bloqueio de duplicatas (pesagens) | ✓ | Por lote+data e animal+data |
| Salvamento em ordem correta | ✓ | Fazendas → Pastos → Lotes → Animais → Pesagens |
| Bug pastagens corrigido | ✓ | `faz_id` (bigint) + `metadata: {}` — testado e confirmado |
| Resultado detalhado pós-importação | ✓ | Contagem por categoria + atalhos para as telas |
| Dados aparecem em todas as telas | ✓ | Painel, Fazendas, Pastos, Lotes, Animais, Pesagens, Resultado |
| Permissão correta (Proprietário/Gerente) | ✓ | Operadores e Visualizadores bloqueados |
| Isolamento por usuário (RLS) | ✓ | Todos os registros têm `owner_user_id` da sessão |
| Nenhum segredo exposto no frontend | ✓ | Usa anon_key + JWT, sem service_role_key |
| Testes unitários do parser | ✓ | 75 testes, todos passando |

---

## Limitações conhecidas (não bloqueantes para beta)

| Limitação | Impacto | Quando resolver |
|-----------|---------|-----------------|
| Salvamento sequencial (não atômico) | Falha parcial deixa dados incompletos | Pós-beta, via RPC com transação |
| GMD não recalculado pós-importação | Lote exibe 0 GMD até nova pesagem ou edição manual | Pós-beta, via trigger ou RPC |
| Sem validação de tamanho máximo | Planilhas muito grandes podem ser lentas | Pós-beta, quando volumes subirem |
| Sem exportação dos erros | Usuário precisa corrigir consultando a lista na tela | Pós-beta, se demanda surgir |

---

## Instrução para Herdon

1. Acesse **Importação** no menu lateral (seção Gestão)
2. Clique em **Baixar modelo .xlsx** e preencha com seus dados reais
3. Volte à tela, clique em **Já tenho o arquivo preenchido** e envie o arquivo
4. Revise — qualquer erro aparece com a linha e o campo exato a corrigir
5. Confirme a importação quando estiver tudo sem erros
6. Seus dados aparecem imediatamente em todas as telas

Se precisar desfazer, exclua os registros pelas telas normais (Fazendas, Lotes, Animais, Pesagens).

---

## Decisão

**Pronto para beta com Herdon.**

Todos os caminhos felizes e caminhos de erro testados com dados reais em conta separada de QA. O bug de pastagens foi corrigido e validado com reimportação completa. As limitações conhecidas não bloqueiam o caso de uso real do piloto.

Próxima ação: entregar `docs/IMPORTACAO_DADOS_HERDON.md` ao Herdon como guia de uso.
