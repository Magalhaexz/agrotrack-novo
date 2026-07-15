// Cadastro de um item NOVO de estoque via linguagem natural (Assistente IA).
// Puro, sem I/O. Distinto de REGISTRAR_ENTRADA_ESTOQUE (que só soma
// quantidade a um item já existente) — este cria a linha em `estoque`.
// Duplica os pares produto/nome, unidade/unidade_medida e
// valor_unitario/custo_unitario/preco_unitario de propósito: mesmo padrão de
// `buildOperationalCreatePayload` (src/services/operationalPersistence.js)
// para o app e o bot nunca divergirem em qual coluna cada tela lê.
const erro = (codigo) => ({ ok: false, erro: codigo });

const CATEGORIAS_ESTOQUE_GERAL = [
  'Medicamento', 'Vacina', 'Material', 'Produto veterinário', 'Insumo geral', 'Outro',
];

/**
 * @param {object} db — não usado hoje (sem resolução de nome existente), mantido
 *   por simetria com os demais preparadores e para validações futuras (ex.:
 *   detectar item já cadastrado com o mesmo nome).
 * @param {object} dados — { nome, categoria?, unidade?, quantidade_inicial?, custo_unitario?, quantidade_minima?, fornecedor?, obs? }
 * @param {{ fazendaId?: number|null }} ctx
 */
export function prepararCadastroItemEstoque(db, dados, ctx = {}) {
  const nome = String(dados?.nome || '').trim();
  if (!nome) return erro('NOME_VAZIO');

  const quantidadeInicial = Number(dados?.quantidade_inicial ?? 0);
  if (!(quantidadeInicial >= 0)) return erro('QUANTIDADE_INVALIDA');

  const custoUnitario = Number(dados?.custo_unitario ?? 0);
  if (!(custoUnitario >= 0)) return erro('CUSTO_INVALIDO');

  const categoria = CATEGORIAS_ESTOQUE_GERAL.includes(dados?.categoria) ? dados.categoria : 'Outro';
  const unidade = String(dados?.unidade || 'un').trim() || 'un';
  const quantidadeMinima = Number(dados?.quantidade_minima ?? 0);

  const registro = {
    produto: nome,
    nome,
    categoria,
    unidade,
    unidade_medida: unidade,
    quantidade: quantidadeInicial,
    quantidade_atual: quantidadeInicial,
    quantidade_minima: quantidadeMinima >= 0 ? quantidadeMinima : 0,
    valor_unitario: custoUnitario,
    preco_unitario: custoUnitario,
    custo_unitario: custoUnitario,
    valor_total: quantidadeInicial * custoUnitario,
    fazenda_id: ctx.fazendaId ?? null,
    fornecedor: dados?.fornecedor || '',
    obs: dados?.obs || '',
    observacoes: dados?.obs || '',
  };

  return {
    ok: true,
    resumo: [
      'Confirme o novo item de estoque:',
      '',
      `Produto: ${nome}`,
      `Categoria: ${categoria}`,
      `Quantidade inicial: ${quantidadeInicial} ${unidade}`,
      custoUnitario > 0 ? `Custo unitário: R$ ${custoUnitario.toFixed(2).replace('.', ',')}` : null,
    ].filter(Boolean),
    writes: [{ tabela: 'estoque', tipo: 'insert', registro }],
  };
}
