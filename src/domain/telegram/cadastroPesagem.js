// Edição/exclusão da pesagem mais recente de um lote via linguagem natural
// (bot operacional determinístico). Puro, sem I/O. Reaproveita
// `domain/pesagensLote.js` (extraído de `PesagensPage.jsx` na Sprint
// Paridade 1) para recalcular `lotes.p_at`/`ultima_pesagem` com a MESMA
// fórmula do app — nunca duplica a regra.
//
// ponytail: só opera sobre a pesagem de LOTE mais recente (não pesagens
// individuais por animal) — mesma leitura de "a pesagem" usada nos
// exemplos do spec ("corrija a pesagem do lote X"), sem pedir qual das N
// pesagens quando isso nunca foi ambíguo nos exemplos reais.
import { resolverLotePorNome } from './resolvedores.js';
import { resolveTipoPesagem, recalcularPesoAtualLote } from '../pesagensLote.js';
import { hojeLocalISO } from '../dataCivil.js';

const erro = (codigo, extra = {}) => ({ ok: false, erro: codigo, ...extra });

function pesagensDeLoteMaisRecente(db, loteId) {
  const pesagens = Array.isArray(db?.pesagens) ? db.pesagens : [];
  const doLote = pesagens.filter((p) => resolveTipoPesagem(p) === 'lote' && Number(p.lote_id) === Number(loteId));
  if (doLote.length === 0) return null;
  return [...doLote].sort((a, b) => String(b.data || '').localeCompare(String(a.data || '')) || Number(b.id) - Number(a.id))[0];
}

/**
 * @param {object} db — já recortado pela fazenda ativa da conexão.
 * @param {object} dados — { lote, peso, data? }
 */
export function prepararEdicaoPesagem(db, dados) {
  const rl = resolverLotePorNome(db?.lotes, dados?.lote, { somenteAtivos: true });
  if (rl.status === 'ambiguo') return erro('LOTE_AMBIGUO', { candidatos: rl.candidatos });
  if (rl.status !== 'ok') return erro('LOTE_NAO_ENCONTRADO');
  const lote = rl.lote;

  const peso = Number(dados?.peso);
  if (!(peso > 0)) return erro('PESO_INVALIDO');

  const alvo = pesagensDeLoteMaisRecente(db, lote.id);
  if (!alvo) return erro('PESAGEM_NAO_ENCONTRADA');

  const novaData = dados?.data || alvo.data || hojeLocalISO();

  return {
    ok: true,
    resumo: [
      'Confirme a correção da pesagem:',
      '',
      `Lote: ${lote.nome}`,
      `Peso anterior: ${Number(alvo.peso_medio) || 0} kg`,
      `Peso novo: ${peso} kg`,
      `Data: ${novaData}`,
    ],
    // Sprint Paridade 1, bloco 4: transacional via `editar_ultima_pesagem_lote`
    // — a RPC recalcula `lotes.p_at`/`ultima_pesagem` no próprio banco, com a
    // mesma fórmula de `recalcularPesoAtualLote`, mas server-side.
    rpc: {
      nome: 'editar_ultima_pesagem_lote',
      params: { p_pesagem_id: alvo.id, p_novo_peso: peso, p_nova_data: novaData },
    },
  };
}

/**
 * @param {object} db — já recortado pela fazenda ativa da conexão.
 * @param {object} dados — { lote }
 */
export function prepararExclusaoPesagem(db, dados) {
  const rl = resolverLotePorNome(db?.lotes, dados?.lote, { somenteAtivos: true });
  if (rl.status === 'ambiguo') return erro('LOTE_AMBIGUO', { candidatos: rl.candidatos });
  if (rl.status !== 'ok') return erro('LOTE_NAO_ENCONTRADO');
  const lote = rl.lote;

  const alvo = pesagensDeLoteMaisRecente(db, lote.id);
  if (!alvo) return erro('PESAGEM_NAO_ENCONTRADA');

  // Só para o texto de confirmação — a RPC recalcula de novo, sobre o db
  // fresco, no momento do /confirmar (mesmo padrão de idempotência das
  // demais operações transacionais).
  const pesagensRestantes = (db.pesagens || []).filter((p) => Number(p.id) !== Number(alvo.id));
  const { ultimaPesagem } = recalcularPesoAtualLote(db, lote.id, pesagensRestantes);

  return {
    ok: true,
    resumo: [
      'Confirme a exclusão da pesagem:',
      '',
      `Lote: ${lote.nome}`,
      `Pesagem: ${Number(alvo.peso_medio) || 0} kg em ${alvo.data}`,
      ultimaPesagem ? `Nova última pesagem: ${ultimaPesagem}` : 'O lote ficará sem nenhuma pesagem registrada.',
    ],
    // Sprint Paridade 1, bloco 4: transacional via `excluir_ultima_pesagem_lote`
    // (inclui o fallback pela média dos animais quando não sobra pesagem).
    rpc: {
      nome: 'excluir_ultima_pesagem_lote',
      params: { p_pesagem_id: alvo.id },
    },
  };
}
