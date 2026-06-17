import { gerarNovoId } from '../utils/id.js';
import { registrarAuditoria } from './auditoria.js';
import {
  createOperationalRecord,
  persistCollectionMutation,
} from './operationalPersistence.js';
import {
  ratearIgualitario,
  ratearPorCabecas,
  ratearPorPeso,
} from '../domain/rateio.js';

const CRITERIOS_VALIDOS = ['cabecas', 'peso', 'igualitario'];

function toNum(value) {
  return Number(value || 0);
}

function persistirComAviso(mutations, context = {}) {
  const { persist = true, session = null, onWarning, onError } = context || {};
  if (!persist || !session?.user?.id) return;

  void persistCollectionMutation(mutations)
    .then((result) => {
      if (!result?.persisted && typeof onWarning === 'function') {
        onWarning('Alguns registros precisam de revisão.');
      }
    })
    .catch((error) => {
      if (typeof onError === 'function') {
        onError(error);
        return;
      }
      if (typeof onWarning === 'function') {
        onWarning(error?.message || 'Não foi possível concluir a operação agora.');
      }
    });
}

/**
 * Aplica rateio de custo compartilhado entre lotes e gera movimentações financeiras
 * de despesa para cada lote participante.
 *
 * @param {object} db - Estado local da aplicação
 * @param {object} dados
 * @param {string}   dados.descricao  - Descrição do custo (ex: "Energia elétrica")
 * @param {number}   dados.valor      - Valor total a ratear (≥ 0)
 * @param {string}   dados.data       - Data no formato YYYY-MM-DD
 * @param {string}   [dados.categoria]  - Categoria da movimentação (padrão: 'custo_indireto')
 * @param {'cabecas'|'peso'|'igualitario'} dados.criterio - Critério de rateio
 * @param {number[]} dados.loteIds    - IDs dos lotes participantes
 * @param {object} [userContext={}]   - { id, email } do usuário para auditoria
 * @param {object} [persistContext={}] - { session, persist, onWarning, onError }
 * @returns {{ db: object, rateio: { lote_id: number, lote_nome: string, custoRateado: number }[] }}
 */
export function aplicarRateioCustoCompartilhado(
  db,
  dados,
  userContext = {},
  persistContext = {}
) {
  const {
    descricao: descricaoRaw,
    valor: valorRaw,
    data,
    categoria,
    criterio,
    loteIds,
  } = dados || {};

  const descricao = String(descricaoRaw || '').trim();
  if (!descricao) throw new Error('Descrição é obrigatória.');

  const valor = Number(valorRaw);
  if (!Number.isFinite(valor) || valor < 0) throw new Error('Valor total inválido.');

  if (!String(data || '').trim()) throw new Error('Data é obrigatória.');

  if (!CRITERIOS_VALIDOS.includes(criterio)) {
    throw new Error(`Critério inválido. Valores aceitos: ${CRITERIOS_VALIDOS.join(', ')}.`);
  }

  const ids = Array.isArray(loteIds) ? loteIds : [];
  if (ids.length === 0) throw new Error('Selecione ao menos um lote.');

  const todosLotes = Array.isArray(db?.lotes) ? db.lotes : [];
  const lotesAlvo = todosLotes.filter((l) =>
    ids.some((id) => Number(id) === Number(l.id))
  );
  if (lotesAlvo.length === 0) throw new Error('Nenhum lote válido encontrado.');

  const categoriaFinal = String(categoria || 'custo_indireto').trim();
  const nomeCriterio = { cabecas: 'cabeças', peso: 'peso', igualitario: 'igualitário' }[criterio];
  const descricaoMovimentacao = `Rateio — ${descricao} — critério: ${nomeCriterio}`;

  let parcelas;
  if (criterio === 'cabecas') {
    parcelas = ratearPorCabecas(
      valor,
      lotesAlvo.map((l) => ({ lote_id: l.id, qtdCabecas: toNum(l.qtd) }))
    );
  } else if (criterio === 'peso') {
    parcelas = ratearPorPeso(
      valor,
      lotesAlvo.map((l) => ({ lote_id: l.id, pesoTotal: toNum(l.qtd) * toNum(l.p_at) }))
    );
  } else {
    const igualitario = ratearIgualitario(valor, lotesAlvo.length);
    parcelas = igualitario.map((p) => ({
      lote_id: lotesAlvo[p.lote_idx].id,
      custoRateado: p.custoRateado,
    }));
  }

  const movimentacoesFinanceiras = Array.isArray(db?.movimentacoes_financeiras)
    ? db.movimentacoes_financeiras
    : [];

  const baseId = gerarNovoId(movimentacoesFinanceiras);

  const novasMovimentacoes = parcelas.filter((p) => p.custoRateado > 0).map((p, idx) => ({
    id: baseId + idx,
    tipo: 'despesa',
    categoria: categoriaFinal,
    lote_id: Number(p.lote_id),
    valor: p.custoRateado,
    data,
    data_competencia: data,
    status: 'realizado',
    descricao: descricaoMovimentacao,
    origem_tipo: 'rateio',
    origem_id: null,
  }));

  const dbAtualizado = {
    ...db,
    movimentacoes_financeiras: [...movimentacoesFinanceiras, ...novasMovimentacoes],
  };

  const mutations = novasMovimentacoes.map((mov) =>
    createOperationalRecord(
      'movimentacoes_financeiras',
      { ...mov, id: undefined },
      persistContext.session
    )
  );
  persistirComAviso(mutations, persistContext);

  const rateioResumo = parcelas.map((p) => {
    const lote = lotesAlvo.find((l) => Number(l.id) === Number(p.lote_id));
    return {
      lote_id: Number(p.lote_id),
      lote_nome: lote?.nome || String(p.lote_id),
      custoRateado: p.custoRateado,
    };
  });

  const dbComAuditoria = registrarAuditoria(
    dbAtualizado,
    {
      acao: 'rateio_custo_compartilhado',
      entidade: 'movimentacoes_financeiras',
      entidade_id: baseId,
      descricao: `${descricaoMovimentacao} — R$ ${valor.toFixed(2)} entre ${lotesAlvo.length} lote(s)`,
      ator_id: userContext?.id || null,
      ator_email: userContext?.email || '',
      criticidade: 'media',
    },
    persistContext
  );

  return { db: dbComAuditoria, rateio: rateioResumo };
}
