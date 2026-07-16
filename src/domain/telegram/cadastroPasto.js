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
