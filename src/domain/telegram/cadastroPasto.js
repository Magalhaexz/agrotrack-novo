// Cadastro de um pasto NOVO via linguagem natural (bot operacional
// determinístico). Puro, sem I/O. Mesmos campos de `PastagensPage.jsx`
// (`salvarPastagem`) — não inventa coluna nova (ex.: "tipo de capim" do
// spec não existe na tabela `pastagens` hoje; fica de fora até o app ganhar
// esse campo).
import { normalizarChave } from './resolvedores.js';

const erro = (codigo, extra = {}) => ({ ok: false, erro: codigo, ...extra });

function resolverFazendaId(db, ctxFazendaId) {
  if (ctxFazendaId != null) return Number(ctxFazendaId);
  const fazendas = Array.isArray(db?.fazendas) ? db.fazendas : [];
  return fazendas.length === 1 ? Number(fazendas[0].id) : null;
}

/**
 * @param {object} db — já recortado pela fazenda ativa da conexão.
 * @param {object} dados — { nome, area?, capacidade?, obs? }
 * @param {{ fazendaId?: number|null }} ctx
 */
export function prepararCadastroPasto(db, dados, ctx = {}) {
  const nome = String(dados?.nome || '').trim();
  if (!nome) return erro('NOME_VAZIO');

  const fazendaId = resolverFazendaId(db, ctx.fazendaId);
  if (!fazendaId) return erro('FAZENDA_NAO_DEFINIDA');

  const pastagens = Array.isArray(db?.pastagens) ? db.pastagens : [];
  const chaveNome = normalizarChave(nome);
  const duplicado = pastagens.some((p) => Number(p.faz_id) === Number(fazendaId)
    && normalizarChave(p.nome) === chaveNome);
  if (duplicado) return erro('NOME_DUPLICADO');

  const areaHa = Number(dados?.area) || 0;
  if (areaHa < 0) return erro('AREA_INVALIDA');
  const capacidade = Number(dados?.capacidade) || 0;
  if (capacidade < 0) return erro('CAPACIDADE_INVALIDA');

  const fazenda = (Array.isArray(db?.fazendas) ? db.fazendas : []).find((f) => Number(f.id) === Number(fazendaId));
  const obs = dados?.obs || '';

  return {
    ok: true,
    resumo: [
      'Confirme o novo pasto:',
      '',
      `Pasto: ${nome}`,
      fazenda ? `Fazenda: ${fazenda.nome}` : null,
      areaHa > 0 ? `Área: ${areaHa} ha` : null,
      capacidade > 0 ? `Capacidade de suporte: ${capacidade}` : null,
    ].filter(Boolean),
    writes: [{
      tabela: 'pastagens',
      tipo: 'insert',
      registro: {
        faz_id: fazendaId,
        nome,
        area_ha: areaHa,
        capacidade_suporte_ua_ha: capacidade,
        status: 'ativo',
        observacoes: obs,
        obs,
      },
    }],
  };
}

/**
 * Edita campos de um pasto já existente — só os campos informados são
 * alterados. Não inventa "tipo de capim" (mesma nota do cadastro).
 * @param {object} db — já recortado pela fazenda ativa da conexão.
 * @param {object} dados — { pasto, area?, capacidade?, obs? }
 */
export function prepararEdicaoPasto(db, dados) {
  const pastagens = Array.isArray(db?.pastagens) ? db.pastagens : [];
  const alvo = normalizarChave(dados?.pasto);
  if (!alvo) return erro('PASTO_VAZIO');
  const exatas = pastagens.filter((p) => normalizarChave(p.nome) === alvo);
  const achados = exatas.length > 0 ? exatas : pastagens.filter((p) => normalizarChave(p.nome).includes(alvo));
  if (achados.length === 0) return erro('PASTO_NAO_ENCONTRADO');
  if (achados.length > 1) return erro('PASTO_AMBIGUO', { candidatos: achados });
  const pasto = achados[0];

  const patch = {};
  const resumoCampos = [];
  if (dados?.area != null && String(dados.area).trim()) {
    const areaHa = Number(dados.area);
    if (!(areaHa >= 0)) return erro('AREA_INVALIDA');
    patch.area_ha = areaHa;
    resumoCampos.push(`Área: ${areaHa} ha`);
  }
  if (dados?.capacidade != null && String(dados.capacidade).trim()) {
    const capacidade = Number(dados.capacidade);
    if (!(capacidade >= 0)) return erro('CAPACIDADE_INVALIDA');
    patch.capacidade_suporte_ua_ha = capacidade;
    resumoCampos.push(`Capacidade de suporte: ${capacidade}`);
  }
  if (dados?.obs != null && String(dados.obs).trim()) {
    patch.observacoes = String(dados.obs).trim();
    patch.obs = patch.observacoes;
    resumoCampos.push(`Observação: ${patch.observacoes}`);
  }

  if (Object.keys(patch).length === 0) return erro('NENHUM_CAMPO_INFORMADO');

  return {
    ok: true,
    resumo: ['Confirme a edição do pasto:', '', `Pasto: ${pasto.nome}`, ...resumoCampos],
    writes: [{ tabela: 'pastagens', tipo: 'update', match: { id: pasto.id }, patch }],
  };
}
