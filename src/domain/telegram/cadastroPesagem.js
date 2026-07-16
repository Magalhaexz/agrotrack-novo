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
  const pesagensAtualizadas = (db.pesagens || []).map((p) => (
    Number(p.id) === Number(alvo.id) ? { ...p, peso_medio: peso, data: novaData } : p
  ));
  const { pesoAtual, ultimaPesagem } = recalcularPesoAtualLote(db, lote.id, pesagensAtualizadas);

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
    writes: [
      { tabela: 'pesagens', tipo: 'update', match: { id: alvo.id }, patch: { peso_medio: peso, data: novaData } },
      { tabela: 'lotes', tipo: 'update', match: { id: lote.id }, patch: { p_at: pesoAtual, peso_atual: pesoAtual, peso_medio_atual: pesoAtual, ultima_pesagem: ultimaPesagem } },
    ],
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

  const pesagensRestantes = (db.pesagens || []).filter((p) => Number(p.id) !== Number(alvo.id));
  const { pesoAtual, ultimaPesagem } = recalcularPesoAtualLote(db, lote.id, pesagensRestantes);

  return {
    ok: true,
    resumo: [
      'Confirme a exclusão da pesagem:',
      '',
      `Lote: ${lote.nome}`,
      `Pesagem: ${Number(alvo.peso_medio) || 0} kg em ${alvo.data}`,
      ultimaPesagem ? `Nova última pesagem: ${ultimaPesagem}` : 'O lote ficará sem nenhuma pesagem registrada.',
    ],
    writes: [
      { tabela: 'pesagens', tipo: 'delete', match: { id: alvo.id } },
      { tabela: 'lotes', tipo: 'update', match: { id: lote.id }, patch: { p_at: pesoAtual, peso_atual: pesoAtual, peso_medio_atual: pesoAtual, ultima_pesagem: ultimaPesagem } },
    ],
  };
}
