import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildGrupoAnimaisAutoPatch,
  buildLoteConsumptionAlert,
  buildLoteConsumptionHistoryRows,
  buildLoteSavePatch,
  canCreateLoteInCurrentFarm,
  filterLotesByActiveFarm,
} from '../src/pages/lotesLogic.js';
import {
  normalizarInitialData,
  validarForm,
} from '../src/components/loteFormLogic.js';

const loteFormSource = fs.readFileSync(path.resolve(globalThis.process.cwd(), 'src/components/LoteForm.jsx'), 'utf8');

function buildValidForm(overrides = {}) {
  return {
    nome: 'Lote A',
    faz_id: 1,
    pastagem_id: '',
    categoria_animal: 'Misto',
    raca: 'Nelore',
    tipo: 'engorda',
    sistema: 'confinamento',
    entrada: '2026-06-01',
    qtd: 100,
    p_ini: 320,
    peso_alvo: 520,
    gmd_meta: 1.25,
    supl_nome: 'Ração 18%',
    consumo_tipo: 'kg_cab_dia',
    consumo_por_cabeca_dia: 8.5,
    supl_rkg: 2.85,
    preco_arroba: 250,
    investimento: 150000,
    custo_fixo_mensal: 4500,
    rendimento_carcaca: 52,
    outras_desp_pc_mes: 0,
    tem_recria: false,
    tem_engorda: true,
    dias_recria: 0,
    p_ini_recria: 0,
    p_fim_recria: 0,
    dias_engorda: 160,
    supl_pv_pct: 0,
    supl_estoque_kg: 0,
    supl_meta_dias: 30,
    ...overrides,
  };
}

test('lotes are filtered only by the active farm', () => {
  const lotes = [
    { id: 1, faz_id: 10 },
    { id: 2, faz_id: 20 },
    { id: 3, faz_id: 10 },
  ];

  assert.deepEqual(filterLotesByActiveFarm(lotes, 10).map((item) => item.id), [1, 3]);
  assert.deepEqual(filterLotesByActiveFarm(lotes, null), []);
});

test('new lote payload uses the active farm and edits keep the linked farm', () => {
  const novo = buildLoteSavePatch({ nome: 'Novo lote', faz_id: '' }, null, 7);
  const edicao = buildLoteSavePatch({ nome: 'Lote existente', faz_id: 99 }, { id: 2, faz_id: 15 }, 7);

  assert.equal(novo.faz_id, 7);
  assert.equal(edicao.faz_id, 15);
});

test('lote creation requires an active farm unless editing', () => {
  assert.equal(canCreateLoteInCurrentFarm(null, null), false);
  assert.equal(canCreateLoteInCurrentFarm(3, null), true);
  assert.equal(canCreateLoteInCurrentFarm(null, { id: 1 }), true);
});

test('new lote form bootstraps the active farm id', () => {
  const form = normalizarInitialData(null, [], { id: 12, nome: 'Fazenda Norte' });
  assert.equal(form.faz_id, 12);
});

test('planned days must be an integer', () => {
  const validBase = buildValidForm();
  const planning = {
    diasEstimados: 160,
    dataPrevistaSaida: '2026-11-08',
    consumoTotalEstimado: 1360,
    custoEstimadoTotal: 3876,
  };

  assert.equal(validarForm({ ...validBase, supl_meta_dias: 0 }, planning), 'Informe um número inteiro de dias.');
});

test('nutrição/suplementação e preço da arroba são opcionais para criar o lote (Sprint 34)', () => {
  const validBase = buildValidForm();
  const planning = {
    diasEstimados: 160,
    dataPrevistaSaida: '2026-11-08',
    consumoTotalEstimado: 0,
    custoEstimadoTotal: 0,
  };

  const semNutricao = {
    ...validBase,
    supl_nome: '',
    consumo_por_cabeca_dia: '',
    supl_rkg: '',
    preco_arroba: '',
  };

  assert.equal(validarForm(semNutricao, planning), null);
});

test('history rows include consumo records with the expected shape', () => {
  const rows = buildLoteConsumptionHistoryRows([
    { id: 1, lote_id: 9, data: '2026-06-10', qtd_total: '12,5', peso_medio_usado: '320,5', obs: 'Ração' },
    { id: 2, lote_id: 8, data: '2026-06-11', qtd_total: 9 },
  ], 9);

  assert.equal(rows.length, 1);
  assert.equal(rows[0].tipo, 'consumo');
  assert.equal(rows[0].quantidade, 12.5);
  assert.equal(rows[0].peso_medio, 320.5);
});

test('consumption alert stays finite and surfaces warning and danger states', () => {
  const lote = {
    qtd: 10,
    heads: 10,
    p_at: 320,
    p_ini: 320,
    consumo_tipo: 'kg_cab_dia',
    consumo_por_cabeca_dia: 1,
  };

  const warning = buildLoteConsumptionAlert({
    lote,
    consumoRows: [
      { quantidade: 12 },
      { quantidade: 12 },
    ],
  });
  const danger = buildLoteConsumptionAlert({
    lote,
    consumoRows: [
      { quantidade: 6 },
      { quantidade: 6 },
    ],
  });

  assert.equal(Number.isFinite(warning.expectedDaily), true);
  assert.equal(Number.isFinite(warning.actualDaily), true);
  assert.equal(warning.tone, 'warning');
  assert.equal(warning.message, 'Consumo acima do esperado para este lote.');
  assert.equal(danger.tone, 'danger');
  assert.equal(danger.message, 'Consumo muito abaixo do esperado para este lote.');
});

test('LoteForm no longer exposes removed field labels', () => {
  assert.equal(loteFormSource.includes('Peso atual'), false);
  assert.equal(loteFormSource.includes('Data de nascimento'), false);
});

// ─── grupo de animais automático (Sprint 35) ───────────────────────────────

test('buildGrupoAnimaisAutoPatch monta um grupo a partir dos dados do lote', () => {
  const lote = {
    id: 20, faz_id: 641, nome: 'Lote QA 01', categoria_animal: 'Bois', raca: 'Nelore',
    qtd: 20, p_ini: 300, p_at: 360, entrada: '2026-06-25', rendimento_carcaca: 52,
  };
  const grupo = buildGrupoAnimaisAutoPatch(lote);

  assert.equal(grupo.tipo_registro, 'grupo');
  assert.equal(grupo.fazenda_id, 641);
  assert.equal(grupo.lote_id, 20);
  assert.equal(grupo.identificacao, 'Lote QA 01');
  assert.equal(grupo.categoria, 'Bois');
  assert.equal(grupo.raca, 'Nelore');
  assert.equal(grupo.qtd, 20);
  assert.equal(grupo.p_ini, 300);
  assert.equal(grupo.p_at, 360);
  assert.equal(grupo.data_referencia, '2026-06-25');
  assert.equal(grupo.status, 'ativo');
  assert.equal(grupo.metadata.criado_automaticamente, true);
});

test('buildGrupoAnimaisAutoPatch usa p_ini como p_at quando o lote ainda não tem peso atual', () => {
  const grupo = buildGrupoAnimaisAutoPatch({ id: 1, qtd: 10, p_ini: 280, p_at: 0 });
  assert.equal(grupo.p_at, 280);
});

test('buildGrupoAnimaisAutoPatch retorna null sem cabeças (não cria grupo vazio)', () => {
  assert.equal(buildGrupoAnimaisAutoPatch({ id: 1, qtd: 0 }), null);
  assert.equal(buildGrupoAnimaisAutoPatch({ id: 1 }), null);
  assert.equal(buildGrupoAnimaisAutoPatch(null), null);
});
