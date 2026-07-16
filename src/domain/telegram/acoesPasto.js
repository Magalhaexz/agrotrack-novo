// Troca de lote de pasto via linguagem natural (bot operacional determinístico). Puro, sem I/O.
//
// Sprint Paridade 1, bloco 4: a RPC `mover_lote_para_pasto` (supabase/
// migrations/20260619113446_lote_pastagens_historico.sql) é SECURITY INVOKER
// e depende da RLS do chamador — o webhook usa o client de service-role (RLS
// ignorada), então nunca pôde chamá-la direto (upgrade já cogitado no
// ponytail anterior deste arquivo). Agora existe uma gêmea SECURITY DEFINER,
// `mover_lote_para_pasto_bot` (migration 20260716120000), que aceita
// `p_owner_user_id` explícito e unifica troca+retirada (destino opcional) —
// esta função ainda resolve nome→registro e valida amigavelmente (mesmas
// mensagens de erro com candidatos), mas devolve `rpc:{...}` em vez de
// `writes:[...]`: a aplicação passa a ser atômica.
import { normalizarChave } from './resolvedores.js';
import { loteEstaBloqueado } from '../../pages/lotesLogic.js';
import { isMesmoPastoAtual } from '../../components/lotes/movimentacaoPastoLogic.js';
import { hojeLocalISO } from '../dataCivil.js';

const erro = (codigo, extra = {}) => ({ ok: false, erro: codigo, ...extra });

// Não filtra bloqueados aqui — resolve contra todos os lotes para poder
// devolver LOTE_BLOQUEADO (mensagem específica) em vez de LOTE_NAO_ENCONTRADO
// quando o usuário nomeia um lote encerrado/vendido de propósito.
function resolverLotePorNomeQualquerStatus(lotes, nome) {
  const lista = Array.isArray(lotes) ? lotes : [];
  const alvo = normalizarChave(nome);
  if (!alvo) return { status: 'nao_encontrado', candidatos: [] };
  const casa = (l) => {
    const chave = normalizarChave(l?.nome);
    return chave === alvo || chave === `lote ${alvo}`;
  };
  const exatos = lista.filter(casa);
  if (exatos.length === 1) return { status: 'ok', lote: exatos[0] };
  if (exatos.length > 1) return { status: 'ambiguo', candidatos: exatos };
  const parciais = lista.filter((l) => normalizarChave(l?.nome).includes(alvo));
  if (parciais.length === 1) return { status: 'ok', lote: parciais[0] };
  if (parciais.length > 1) return { status: 'ambiguo', candidatos: parciais };
  return { status: 'nao_encontrado', candidatos: [] };
}

function resolverPastagemPorNome(pastagens, nome) {
  const lista = Array.isArray(pastagens) ? pastagens : [];
  const alvo = normalizarChave(nome);
  if (!alvo) return { status: 'nao_encontrado', candidatos: [] };
  const exatas = lista.filter((p) => normalizarChave(p?.nome) === alvo);
  if (exatas.length === 1) return { status: 'ok', pastagem: exatas[0] };
  if (exatas.length > 1) return { status: 'ambiguo', candidatos: exatas };
  const parciais = lista.filter((p) => normalizarChave(p?.nome).includes(alvo));
  if (parciais.length === 1) return { status: 'ok', pastagem: parciais[0] };
  if (parciais.length > 1) return { status: 'ambiguo', candidatos: parciais };
  return { status: 'nao_encontrado', candidatos: [] };
}

/**
 * @param {object} db — já recortado pela fazenda ativa da conexão.
 * @param {object} dados — { lote, pasto, quantidade_cabecas?, motivo?, observacoes?, data? }
 */
export function prepararTrocaLotePasto(db, dados) {
  const rl = resolverLotePorNomeQualquerStatus(db.lotes, dados?.lote);
  if (rl.status === 'ambiguo') return erro('LOTE_AMBIGUO', { candidatos: rl.candidatos });
  if (rl.status !== 'ok') return erro('LOTE_NAO_ENCONTRADO');
  const lote = rl.lote;
  if (loteEstaBloqueado(lote)) return erro('LOTE_BLOQUEADO');
  if (!lote.faz_id) return erro('LOTE_SEM_FAZENDA');

  const rp = resolverPastagemPorNome(db.pastagens, dados?.pasto);
  if (rp.status === 'ambiguo') return erro('PASTO_AMBIGUO', { candidatos: rp.candidatos });
  if (rp.status !== 'ok') return erro('PASTO_NAO_ENCONTRADO');
  const pastagem = rp.pastagem;

  if (Number(pastagem.faz_id) !== Number(lote.faz_id)) return erro('PASTO_OUTRA_FAZENDA');

  const motivo = String(dados?.motivo || '').trim() || null;
  if (isMesmoPastoAtual(lote, pastagem.id) && !motivo) return erro('MESMO_PASTO_SEM_MOTIVO');

  const quantidadeCabecas = dados?.quantidade_cabecas != null ? Number(dados.quantidade_cabecas) : null;
  if (quantidadeCabecas != null && !(quantidadeCabecas > 0)) return erro('QUANTIDADE_INVALIDA');

  const dataMovimentacao = dados?.data || hojeLocalISO();

  return {
    ok: true,
    resumo: [
      'Confirme a movimentação de pasto:',
      '',
      `Lote: ${lote.nome}`,
      `Pasto atual: ${lote.pastagem_id ? (db.pastagens?.find((p) => p.id === lote.pastagem_id)?.nome ?? 'não definido') : 'não definido'}`,
      `Novo pasto: ${pastagem.nome}`,
      motivo ? `Motivo: ${motivo}` : null,
      `Data: ${dataMovimentacao}`,
    ].filter(Boolean),
    rpc: {
      nome: 'mover_lote_para_pasto_bot',
      params: {
        p_lote_id: lote.id,
        p_pastagem_destino_id: pastagem.id,
        p_data: dataMovimentacao,
        p_quantidade_cabecas: quantidadeCabecas,
        p_motivo: motivo,
        p_observacoes: dados?.observacoes || null,
      },
    },
  };
}

/**
 * Retira um lote do pasto atual, sem vincular a um novo (mesma regra de
 * `prepararTrocaLotePasto`, com destino nulo — nunca altera `lote.qtd`).
 * @param {object} db — já recortado pela fazenda ativa da conexão.
 * @param {{ lote, motivo?, observacoes?, data? }} dados
 */
export function prepararRetirarLotePasto(db, dados) {
  const rl = resolverLotePorNomeQualquerStatus(db.lotes, dados?.lote);
  if (rl.status === 'ambiguo') return erro('LOTE_AMBIGUO', { candidatos: rl.candidatos });
  if (rl.status !== 'ok') return erro('LOTE_NAO_ENCONTRADO');
  const lote = rl.lote;
  if (loteEstaBloqueado(lote)) return erro('LOTE_BLOQUEADO');
  if (!lote.pastagem_id) return erro('LOTE_SEM_PASTO');

  const pastagemAtual = (Array.isArray(db.pastagens) ? db.pastagens : []).find((p) => String(p.id) === String(lote.pastagem_id));
  const dataMovimentacao = dados?.data || hojeLocalISO();

  return {
    ok: true,
    resumo: [
      'Confirme a retirada do pasto:',
      '',
      `Lote: ${lote.nome}`,
      `Pasto atual: ${pastagemAtual?.nome || 'não definido'}`,
      `Data: ${dataMovimentacao}`,
      '',
      'O lote fica sem pasto vinculado até uma nova movimentação.',
    ],
    rpc: {
      nome: 'mover_lote_para_pasto_bot',
      params: {
        p_lote_id: lote.id,
        p_pastagem_destino_id: null,
        p_data: dataMovimentacao,
        p_quantidade_cabecas: null,
        p_motivo: String(dados?.motivo || '').trim() || null,
        p_observacoes: dados?.observacoes || null,
      },
    },
  };
}
