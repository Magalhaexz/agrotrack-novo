// Suplementação via linguagem natural (bot operacional determinístico).
// Puro, sem I/O. Duas intenções distintas, com fontes reais diferentes:
//
// - Planejamento vive DENTRO da própria linha de `lotes` (`supl_nome`,
//   `consumo_tipo`, `consumo_por_cabeca_dia`, `supl_meta_dias` — ver
//   "Bloco 4" de `LoteForm.jsx`). Não existe tabela de planejamento
//   separada; não inventamos uma aqui. Nunca baixa estoque.
// - Consumo realizado escreve em `consumo_suplementacao`, espelhando
//   `SuplementacaoConsumoModal.jsx::salvar` (payload duplicado
//   quantidade_total/qtd_total/quantidade de propósito, mesmo padrão do
//   app) — e baixa estoque + gera despesa, como o modal real faz.
import { resolverLotePorNome, normalizarChave } from './resolvedores.js';
import { hojeLocalISO } from '../dataCivil.js';

const erro = (codigo, extra = {}) => ({ ok: false, erro: codigo, ...extra });

function resolverItemEstoquePorNome(estoque, nome) {
  const lista = Array.isArray(estoque) ? estoque : [];
  const alvo = normalizarChave(nome);
  if (!alvo) return { status: 'nao_encontrado', candidatos: [] };
  const achados = lista.filter((e) => normalizarChave(e.produto || e.nome).includes(alvo));
  if (achados.length === 0) return { status: 'nao_encontrado', candidatos: [] };
  if (achados.length > 1) return { status: 'ambiguo', candidatos: achados };
  return { status: 'ok', item: achados[0] };
}

/**
 * @param {object} db — já recortado pela fazenda ativa da conexão.
 * @param {object} dados — { lote, produto, quantidade_por_cabeca, periodo_dias? }
 */
export function prepararPlanejamentoSuplementacao(db, dados) {
  const rl = resolverLotePorNome(db?.lotes, dados?.lote, { somenteAtivos: true });
  if (rl.status === 'ambiguo') return erro('LOTE_AMBIGUO', { candidatos: rl.candidatos });
  if (rl.status !== 'ok') return erro('LOTE_NAO_ENCONTRADO');
  const lote = rl.lote;

  const produto = String(dados?.produto || '').trim();
  if (!produto) return erro('PRODUTO_VAZIO');

  const consumoPorCabeca = Number(dados?.quantidade_por_cabeca);
  if (!(consumoPorCabeca > 0)) return erro('QUANTIDADE_INVALIDA');

  const periodoDias = Number(dados?.periodo_dias) || Number(lote.supl_meta_dias) || 30;

  return {
    ok: true,
    resumo: [
      'Confirme o planejamento de suplementação:',
      '',
      `Lote: ${lote.nome}`,
      `Produto: ${produto}`,
      `Consumo: ${consumoPorCabeca} kg/cabeça/dia`,
      `Período: ${periodoDias} dias`,
      '',
      'Este planejamento não baixa estoque — é só uma referência para o consumo real.',
    ],
    writes: [{
      tabela: 'lotes',
      tipo: 'update',
      match: { id: lote.id },
      patch: {
        supl_nome: produto,
        consumo_tipo: 'kg_cab_dia',
        consumo_por_cabeca_dia: consumoPorCabeca,
        supl_meta_dias: periodoDias,
      },
    }],
  };
}

/**
 * @param {object} db — já recortado pela fazenda ativa da conexão.
 * @param {object} dados — { lote, produto, quantidade, data?, obs? }
 * @param {{ fazendaId?: number|null }} ctx
 */
export function prepararConsumoSuplementacao(db, dados, ctx = {}) {
  const rl = resolverLotePorNome(db?.lotes, dados?.lote, { somenteAtivos: true });
  if (rl.status === 'ambiguo') return erro('LOTE_AMBIGUO', { candidatos: rl.candidatos });
  if (rl.status !== 'ok') return erro('LOTE_NAO_ENCONTRADO');
  const lote = rl.lote;

  const ri = resolverItemEstoquePorNome(db?.estoque, dados?.produto);
  if (ri.status === 'ambiguo') return erro('ITEM_AMBIGUO', { candidatos: ri.candidatos.map((e) => ({ nome: e.produto || e.nome })) });
  if (ri.status !== 'ok') return erro('ITEM_NAO_ENCONTRADO');
  const item = ri.item;

  const quantidade = Number(dados?.quantidade);
  if (!(quantidade > 0)) return erro('QUANTIDADE_INVALIDA');

  const saldoAtual = Number(item.quantidade_atual ?? item.quantidade ?? 0);
  if (quantidade > saldoAtual) return erro('SALDO_INSUFICIENTE', { saldoAtual });

  const dataFinal = dados?.data || hojeLocalISO();
  const custoUnit = Number(item.valor_unitario ?? item.custo_unitario ?? 0);
  const custoTotal = quantidade * custoUnit;
  const novoSaldo = saldoAtual - quantidade;
  const produtoNome = item.produto || item.nome;
  const unidade = item.unidade || item.unidade_medida || 'kg';

  return {
    ok: true,
    resumo: [
      'Confirme o consumo de suplementação:',
      '',
      `Lote: ${lote.nome}`,
      `Produto: ${produtoNome}`,
      `Quantidade: ${quantidade} ${unidade}`.trim(),
      `Novo saldo: ${novoSaldo}`,
      `Data: ${dataFinal}`,
    ],
    writes: [
      {
        tabela: 'consumo_suplementacao',
        tipo: 'insert',
        registro: {
          data: dataFinal,
          fazenda_id: ctx.fazendaId ?? null,
          lote_id: lote.id,
          modo: 'manual_total',
          origem_tipo: 'telegram',
          item_estoque_id: item.id,
          produto_nome: produtoNome,
          quantidade_total: quantidade,
          qtd_total: quantidade,
          quantidade,
          consumo_por_cabeca_dia: null,
          percentual_peso_vivo: null,
          unidade,
          custo_total: custoTotal,
          obs: dados?.obs || '',
          cabecas_lote: lote.qtd ?? null,
          peso_medio_usado: lote.p_at ?? null,
        },
      },
      { tabela: 'estoque', tipo: 'update', match: { id: item.id }, patch: { quantidade_atual: novoSaldo, quantidade: novoSaldo } },
      {
        tabela: 'movimentacoes_financeiras',
        tipo: 'insert',
        registro: {
          tipo: 'despesa',
          categoria: 'nutricao',
          subcategoria: 'alimentacao',
          lote_id: lote.id,
          valor: custoTotal,
          data: dataFinal,
          data_competencia: dataFinal,
          status: 'realizado',
          descricao: `Consumo nutricional - ${produtoNome}`,
          origem_tipo: 'consumo_suplementacao',
          origem: 'telegram',
        },
      },
    ],
  };
}
