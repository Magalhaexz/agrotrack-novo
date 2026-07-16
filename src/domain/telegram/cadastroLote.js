// Cadastro de um lote NOVO via linguagem natural (bot operacional
// determinístico). Puro, sem I/O. Mesmos campos/enums de `LoteForm.jsx` —
// só os que o produtor realmente informa por chat (nome, quantidade, sexo,
// peso, pasto); o resto usa os mesmos defaults do formulário (`FORM_VAZIO`/
// `buildLoteSavePatch` em `LotesPage.jsx`) para nunca deixar uma coluna
// numérica como NULL/NaN nos cálculos que o app já faz sobre `lotes`.
import { normalizarChave } from './resolvedores.js';
import { hojeLocalISO } from '../dataCivil.js';

const erro = (codigo, extra = {}) => ({ ok: false, erro: codigo, ...extra });

const SEXO_ALIASES = {
  macho: 'macho', machos: 'macho',
  femea: 'femea', femeas: 'femea', 'fêmea': 'femea', 'fêmeas': 'femea',
  misto: 'misto', mistos: 'misto', mista: 'misto',
};

function loteAtivo(lote) {
  return String(lote?.status || 'ativo').toLowerCase() !== 'encerrado';
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

/** Fazenda ativa: a do contexto ou, sem ambiguidade, a única da conta. */
function resolverFazendaId(db, ctxFazendaId) {
  if (ctxFazendaId != null) return Number(ctxFazendaId);
  const fazendas = Array.isArray(db?.fazendas) ? db.fazendas : [];
  return fazendas.length === 1 ? Number(fazendas[0].id) : null;
}

/**
 * @param {object} db — já recortado pela fazenda ativa da conexão.
 * @param {object} dados — { nome, quantidade, sexo, peso?, data_entrada?, pasto?, raca?, obs? }
 * @param {{ fazendaId?: number|null }} ctx
 */
export function prepararCadastroLote(db, dados, ctx = {}) {
  const nome = String(dados?.nome || '').trim();
  if (!nome) return erro('NOME_VAZIO');

  const quantidade = Number(dados?.quantidade);
  if (!Number.isInteger(quantidade) || quantidade <= 0) return erro('QUANTIDADE_INVALIDA');

  const sexoChave = SEXO_ALIASES[normalizarChave(dados?.sexo)];
  if (!sexoChave) return erro('SEXO_INVALIDO');

  const fazendaId = resolverFazendaId(db, ctx.fazendaId);
  if (!fazendaId) return erro('FAZENDA_NAO_DEFINIDA');

  const lotes = Array.isArray(db?.lotes) ? db.lotes : [];
  const chaveNome = normalizarChave(nome);
  const duplicado = lotes.some((l) => Number(l.faz_id) === Number(fazendaId)
    && loteAtivo(l)
    && normalizarChave(l.nome) === chaveNome);
  if (duplicado) return erro('NOME_DUPLICADO');

  let pastagemId = null;
  let pastagemNome = null;
  if (dados?.pasto) {
    const rp = resolverPastagemPorNome(db?.pastagens, dados.pasto);
    if (rp.status === 'ambiguo') return erro('PASTO_AMBIGUO', { candidatos: rp.candidatos });
    if (rp.status !== 'ok') return erro('PASTO_NAO_ENCONTRADO');
    if (Number(rp.pastagem.faz_id) !== Number(fazendaId)) return erro('PASTO_OUTRA_FAZENDA');
    pastagemId = rp.pastagem.id;
    pastagemNome = rp.pastagem.nome;
  }

  const peso = Number(dados?.peso) || 0;
  const dataEntrada = dados?.data_entrada || hojeLocalISO();
  const fazenda = (Array.isArray(db?.fazendas) ? db.fazendas : []).find((f) => Number(f.id) === Number(fazendaId));

  const registro = {
    nome,
    faz_id: fazendaId,
    pastagem_id: pastagemId,
    categoria_animal: '',
    raca: dados?.raca || '',
    sexo: sexoChave,
    tipo: 'engorda',
    sistema: pastagemId ? 'pasto' : 'confinamento',
    entrada: dataEntrada,
    qtd: quantidade,
    p_ini: peso,
    p_at: peso,
    peso_alvo: 0,
    gmd_meta: 0,
    investimento: 0,
    custo_fixo_mensal: 0,
    preco_arroba: 0,
    rendimento_carcaca: 52,
    consumo_tipo: 'percentual_pv',
    consumo_por_cabeca_dia: 0,
    supl_nome: '',
    supl_rkg: 0,
    supl_pv_pct: 0,
    supl_meta_dias: 30,
    tem_recria: false,
    tem_engorda: true,
    dias_recria: 0,
    p_ini_recria: 0,
    p_fim_recria: 0,
    dias_engorda: 0,
    supl_estoque_kg: 0,
    obs: dados?.obs || '',
    origem: 'telegram',
  };

  return {
    ok: true,
    resumo: [
      'Confirme o novo lote:',
      '',
      `Lote: ${nome}`,
      fazenda ? `Fazenda: ${fazenda.nome}` : null,
      `Quantidade: ${quantidade} cabeças`,
      `Sexo: ${sexoChave}`,
      peso > 0 ? `Peso médio: ${peso} kg` : null,
      pastagemNome ? `Pasto: ${pastagemNome}` : null,
      `Data de entrada: ${dataEntrada}`,
    ].filter(Boolean),
    writes: [{ tabela: 'lotes', tipo: 'insert', registro }],
  };
}
