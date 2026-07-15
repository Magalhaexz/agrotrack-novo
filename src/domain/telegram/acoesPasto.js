// Troca de lote de pasto via linguagem natural (Assistente IA). Puro, sem I/O.
//
// ponytail: a RPC `mover_lote_para_pasto` (supabase/migrations/
// 20260619113446_lote_pastagens_historico.sql) já existe e faz exatamente
// isto no app — mas ela é SECURITY INVOKER e depende da RLS do chamador para
// recusar lote/pasto de outra conta. O webhook do Telegram usa o cliente de
// service role (RLS ignorada), então chamar a RPC direto abriria uma
// movimentação cross-conta silenciosa. Em vez disso espelhamos a mesma
// validação aqui, operando sobre o `db` que o orquestrador já recortou pela
// conta/fazenda — a mesma garantia de escopo que todo outro write do bot já
// usa (ver acoesLote.js). Upgrade futuro: expor uma function() SECURITY
// DEFINER equivalente e chamá-la com o owner_user_id validado explicitamente.
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
    writes: [
      {
        tabela: 'lote_pastagens_historico',
        tipo: 'insert',
        registro: {
          lote_id: lote.id,
          faz_id: lote.faz_id,
          pastagem_origem_id: lote.pastagem_id ?? null,
          pastagem_destino_id: pastagem.id,
          data_movimentacao: dataMovimentacao,
          quantidade_cabecas: quantidadeCabecas,
          motivo,
          observacoes: dados?.observacoes || null,
        },
      },
      { tabela: 'lotes', tipo: 'update', match: { id: lote.id }, patch: { pastagem_id: pastagem.id } },
    ],
  };
}
