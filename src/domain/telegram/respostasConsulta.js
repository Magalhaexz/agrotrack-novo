// Formatadores puros das CONSULTAS do Bot do Telegram (Partes 5,7,8,9,10,11).
// Recebem o `db` JÁ recortado pela fazenda ativa e devolvem texto pronto para
// `sendMessage`. Reaproveitam o domínio existente (getResumoLote,
// listarContasFinanceiras, listarEstoqueBaixo...) — nada de cálculo novo.
import { getResumoLote } from '../resumoLote.js';
import {
  listarContasFinanceiras,
  listarEstoqueBaixo,
  listarLotesSemPesagemRecente,
  construirHojeNaFazenda,
} from '../hojeNaFazenda.js';
import { toNumber } from '../calcHelpers.js';

const NAO_INFORMADO = 'não informado';

function reais(v) {
  const n = Number(v || 0);
  const [int, dec] = n.toFixed(2).split('.');
  const comMilhar = int.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `R$ ${comMilhar},${dec}`;
}

function dataBR(iso) {
  if (!iso) return NAO_INFORMADO;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  return `${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')}/${d.getUTCFullYear()}`;
}

function lotesAtivos(db) {
  return (Array.isArray(db?.lotes) ? db.lotes : []).filter((l) => String(l?.status || 'ativo').toLowerCase() !== 'encerrado');
}

// ── /fazendas ───────────────────────────────────────────────────────────────
export function formatarFazendas(fazendas, fazendaAtualId) {
  const lista = Array.isArray(fazendas) ? fazendas : [];
  if (lista.length === 0) return 'Nenhuma fazenda encontrada na sua conta.';
  if (lista.length === 1) return `Fazenda atual: ${lista[0].nome}.`;

  const linhas = ['🏡 Suas fazendas:', ''];
  lista.forEach((f, idx) => {
    const marca = fazendaAtualId != null && Number(f.id) === Number(fazendaAtualId) ? ' — selecionada' : '';
    linhas.push(`${idx + 1}. ${f.nome}${marca}`);
  });
  linhas.push('', 'Para trocar, envie: usar fazenda NOME');
  return linhas.join('\n');
}

// ── /lotes ────────────────────────────────────────────────────────────────
export function formatarLotes(db, { fazendaNome = null } = {}) {
  const lotes = lotesAtivos(db);
  const titulo = fazendaNome ? `🐂 Lotes — ${fazendaNome}` : '🐂 Lotes';
  if (lotes.length === 0) return `${titulo}\n\nNenhum lote ativo.`;

  const linhas = [titulo, ''];
  lotes.forEach((lote, idx) => {
    const r = getResumoLote(db, lote.id);
    const qtd = toNumber(r.totalAnimais) || toNumber(lote.qtd);
    const peso = toNumber(r.pesoAtualMedio);
    const gmd = toNumber(r.gmdKgDia);
    linhas.push(`${idx + 1}. ${lote.nome}`);
    linhas.push(`   ${qtd || 0} animais${peso > 0 ? ` · ${peso.toFixed(0)} kg médio` : ''}${gmd > 0 ? ` · GMD ${gmd.toFixed(2)} kg/dia` : ''}`);
  });
  return linhas.join('\n');
}

// ── /lote NOME ──────────────────────────────────────────────────────────────
export function formatarLote(db, lote) {
  if (!lote) return 'Lote não encontrado.';
  const r = getResumoLote(db, lote.id);
  const qtd = toNumber(r.totalAnimais) || toNumber(lote.qtd);
  const peso = toNumber(r.pesoAtualMedio);
  const gmd = toNumber(r.gmdKgDia);
  const dias = toNumber(r.dias);
  return [
    `🐂 ${lote.nome}`,
    '',
    `Animais: ${qtd || 0}`,
    `Peso médio: ${peso > 0 ? `${peso.toFixed(0)} kg` : NAO_INFORMADO}`,
    `GMD: ${gmd > 0 ? `${gmd.toFixed(2)} kg/dia` : 'dados insuficientes'}`,
    `Dias no lote: ${dias > 0 ? dias : NAO_INFORMADO}`,
    `Última pesagem: ${dataBR(lote.ultima_pesagem)}`,
    `Situação: ${lote.status || 'ativo'}`,
  ].join('\n');
}

// ── /estoque ────────────────────────────────────────────────────────────────
function nomeItem(item) {
  return item?.produto || item?.nome || 'Item';
}
function qtdItem(item) {
  return toNumber(item?.quantidade_atual ?? item?.quantidade);
}
function unidadeItem(item) {
  return item?.unidade || item?.unidade_medida || '';
}

export function formatarEstoque(db, { item = null, filtro = null } = {}) {
  const estoque = Array.isArray(db?.estoque) ? db.estoque : [];
  if (estoque.length === 0) return '📦 Estoque\n\nNenhum item de estoque cadastrado.';

  // Consulta de um item específico ("quanto tenho de sal").
  if (item) {
    const alvo = item.toLowerCase();
    const achados = estoque.filter((e) => nomeItem(e).toLowerCase().includes(alvo));
    if (achados.length === 0) return `Não encontrei "${item}" no estoque.`;
    const linhas = ['📦 Estoque', ''];
    achados.forEach((e) => linhas.push(`• ${nomeItem(e)}: ${qtdItem(e)} ${unidadeItem(e)}`.trim()));
    return linhas.join('\n');
  }

  const baixo = listarEstoqueBaixo(db);
  if (filtro === 'baixo') {
    if (baixo.length === 0) return '📦 Estoque\n\n✅ Nenhum item abaixo do mínimo.';
    const linhas = ['📦 Estoque em atenção', ''];
    baixo.forEach((e) => linhas.push(`• ${nomeItem(e)}: ${qtdItem(e)} ${unidadeItem(e)} (mín. ${toNumber(e.quantidade_minima)})`.trim()));
    return linhas.join('\n');
  }

  const baixoIds = new Set(baixo.map((e) => e.id));
  const normais = estoque.filter((e) => !baixoIds.has(e.id));
  const linhas = ['📦 Estoque', ''];
  if (baixo.length > 0) {
    linhas.push('Atenção:');
    baixo.forEach((e) => linhas.push(`• ${nomeItem(e)}: ${qtdItem(e)} ${unidadeItem(e)} (mín. ${toNumber(e.quantidade_minima)})`.trim()));
    linhas.push('');
  }
  if (normais.length > 0) {
    linhas.push('Em estoque normal:');
    normais.slice(0, 10).forEach((e) => linhas.push(`• ${nomeItem(e)}: ${qtdItem(e)} ${unidadeItem(e)}`.trim()));
    if (normais.length > 10) linhas.push(`• +${normais.length - 10} outro(s) item(ns)`);
  }
  return linhas.join('\n').trim();
}

// ── /financeiro ─────────────────────────────────────────────────────────────
export function formatarFinanceiro(db, { filtro = null, loteNome = null } = {}) {
  const temMovs = (Array.isArray(db?.movimentacoes_financeiras) ? db.movimentacoes_financeiras : []).length > 0;
  if (!temMovs) return '💰 Financeiro\n\nNenhuma movimentação financeira registrada.';

  const dias = filtro === 'semana' ? 7 : filtro === 'hoje' ? 0 : 3;
  const { vencidas, proximas } = listarContasFinanceiras(db, dias);

  const totalVencidas = vencidas.reduce((s, m) => s + toNumber(m.valor), 0);
  const totalProximas = proximas.reduce((s, m) => s + toNumber(m.valor), 0);

  const linhas = [`💰 Financeiro${loteNome ? ` — lote ${loteNome}` : ''}`, ''];
  if (filtro !== 'vencer') {
    linhas.push(vencidas.length > 0
      ? `🔴 ${vencidas.length} conta(s) vencida(s) — ${reais(totalVencidas)}`
      : '✅ Nenhuma conta vencida.');
    vencidas.slice(0, 5).forEach((m) => linhas.push(`• ${m.descricao || m.categoria || 'Despesa'}: ${reais(m.valor)}`));
  }
  if (filtro !== 'vencida') {
    linhas.push('', proximas.length > 0
      ? `🟡 ${proximas.length} conta(s) a vencer — ${reais(totalProximas)}`
      : '✅ Nenhuma conta a vencer no período.');
    proximas.slice(0, 5).forEach((m) => linhas.push(`• ${m.descricao || m.categoria || 'Despesa'}: ${reais(m.valor)} (vence ${dataBR(m.data_vencimento || m.data)})`));
  }
  return linhas.join('\n').trim();
}

// ── /manejos ────────────────────────────────────────────────────────────────
export function formatarManejos(db, { hoje = new Date() } = {}) {
  const sanitario = Array.isArray(db?.sanitario) ? db.sanitario : [];
  const hojeKey = hoje.toISOString().slice(0, 10);
  const pendentes = sanitario.filter((s) => s?.proxima && String(s?.status || '').toLowerCase() !== 'concluido');

  const atrasados = pendentes.filter((s) => String(s.proxima).slice(0, 10) < hojeKey);
  const proximos = pendentes.filter((s) => String(s.proxima).slice(0, 10) >= hojeKey);

  if (atrasados.length === 0 && proximos.length === 0) {
    return '💉 Manejos\n\n✅ Nenhum manejo agendado ou atrasado.';
  }
  const nome = (s) => s?.nome || s?.desc || s?.tipo || 'Manejo';
  const linhas = ['💉 Manejos', ''];
  if (atrasados.length > 0) {
    linhas.push(`🔴 Atrasados (${atrasados.length}):`);
    atrasados.slice(0, 8).forEach((s) => linhas.push(`• ${nome(s)} — venceu ${dataBR(s.proxima)}`));
    linhas.push('');
  }
  if (proximos.length > 0) {
    linhas.push(`🟡 Próximos (${proximos.length}):`);
    proximos.slice(0, 8).forEach((s) => linhas.push(`• ${nome(s)} — ${dataBR(s.proxima)}`));
  }
  return linhas.join('\n').trim();
}

// ── /pesagens ───────────────────────────────────────────────────────────────
export function formatarPesagens(db) {
  const pesagens = Array.isArray(db?.pesagens) ? db.pesagens : [];
  const semPesagem = listarLotesSemPesagemRecente(db);
  const lotesPorId = new Map(lotesAtivos(db).map((l) => [Number(l.id), l.nome]));

  const linhas = ['⚖️ Pesagens', ''];
  if (pesagens.length === 0) {
    linhas.push('Nenhuma pesagem registrada.');
  } else {
    const ultimas = [...pesagens].sort((a, b) => String(b.data).localeCompare(String(a.data))).slice(0, 5);
    linhas.push('Últimas pesagens:');
    ultimas.forEach((p) => {
      const nomeLote = lotesPorId.get(Number(p.lote_id)) || `lote ${p.lote_id}`;
      linhas.push(`• ${nomeLote}: ${toNumber(p.peso_medio).toFixed(0)} kg (${dataBR(p.data)})`);
    });
  }
  if (semPesagem.length > 0) {
    linhas.push('', `🟡 ${semPesagem.length} lote(s) sem pesagem recente:`);
    semPesagem.slice(0, 8).forEach((l) => linhas.push(`• ${l.nome}`));
  }
  return linhas.join('\n').trim();
}

// ── /resumo ─────────────────────────────────────────────────────────────────
export function formatarResumo(db, { fazendaNome = null } = {}) {
  const { detalhes } = construirHojeNaFazenda(db);
  const lotes = lotesAtivos(db);
  const totalAnimais = lotes.reduce((s, l) => s + (toNumber(getResumoLote(db, l.id).totalAnimais) || toNumber(l.qtd)), 0);

  const linhas = [`📊 Resumo${fazendaNome ? ` — ${fazendaNome}` : ''}`, ''];
  linhas.push(`• ${lotes.length} lote(s) ativo(s)`);
  linhas.push(`• ${totalAnimais} animais`);
  if (detalhes.contasVencidas.length > 0) linhas.push(`• 🔴 ${detalhes.contasVencidas.length} conta(s) vencida(s)`);
  if (detalhes.contasProximas.length > 0) linhas.push(`• 🟡 ${detalhes.contasProximas.length} conta(s) vencendo em breve`);
  if (detalhes.estoqueBaixo.length > 0) linhas.push(`• 📦 ${detalhes.estoqueBaixo.length} item(ns) com estoque abaixo do mínimo`);
  if (detalhes.lotesSemPesagem.length > 0) linhas.push(`• ⚖️ ${detalhes.lotesSemPesagem.length} lote(s) sem pesagem recente`);
  if (detalhes.lotesGmdBaixo.length > 0) linhas.push(`• 📉 ${detalhes.lotesGmdBaixo.length} lote(s) com GMD abaixo da meta`);
  return linhas.join('\n');
}
