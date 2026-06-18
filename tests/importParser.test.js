import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeText,
  parseDate,
  parsePositiveNumber,
  gerarTemplateSheets,
  gerarTemplateArrayBuffer,
  parsePlanilha,
  validarPlanilha,
} from '../src/utils/importParser.js';

// ── Helpers de fixture ────────────────────────────────────────────────────────

function emptyDb() {
  return { fazendas: [], lotes: [], animais: [], pesagens: [] };
}

function parsed(overrides = {}) {
  return {
    fazendas: [],
    pastos: [],
    lotes: [],
    animais: [],
    pesagens_lotes: [],
    pesagens_animais: [],
    ...overrides,
  };
}

function erros(resultado) {
  return Object.values(resultado.erros).flat();
}

function semErros(resultado) {
  return resultado.temErros === false && resultado.totalErros === 0;
}

// ── normalizeText ─────────────────────────────────────────────────────────────

test('normalizeText: remove espaços das bordas', () => {
  assert.equal(normalizeText('  Fazenda A  '), 'Fazenda A');
});

test('normalizeText: trata undefined como string vazia', () => {
  assert.equal(normalizeText(undefined), '');
});

test('normalizeText: trata null como string vazia', () => {
  assert.equal(normalizeText(null), '');
});

test('normalizeText: converte número para string', () => {
  assert.equal(normalizeText(42), '42');
});

// ── parseDate ─────────────────────────────────────────────────────────────────

test('parseDate: formato DD/MM/YYYY', () => {
  assert.equal(parseDate('15/01/2024'), '2024-01-15');
});

test('parseDate: formato D/M/YYYY (sem zeros)', () => {
  assert.equal(parseDate('5/3/2024'), '2024-03-05');
});

test('parseDate: formato YYYY-MM-DD', () => {
  assert.equal(parseDate('2024-03-20'), '2024-03-20');
});

test('parseDate: serial do Excel (45291 = 2023-12-31)', () => {
  const result = parseDate('45291');
  assert.match(result, /^\d{4}-\d{2}-\d{2}$/);
});

test('parseDate: string vazia retorna null', () => {
  assert.equal(parseDate(''), null);
});

test('parseDate: texto inválido retorna null', () => {
  assert.equal(parseDate('ontem'), null);
});

test('parseDate: data inexistente retorna null (32/01/2024)', () => {
  assert.equal(parseDate('32/01/2024'), null);
});

// ── parsePositiveNumber ───────────────────────────────────────────────────────

test('parsePositiveNumber: número positivo', () => {
  assert.equal(parsePositiveNumber('300'), 300);
});

test('parsePositiveNumber: número com vírgula decimal', () => {
  assert.equal(parsePositiveNumber('1,5'), 1.5);
});

test('parsePositiveNumber: zero retorna null', () => {
  assert.equal(parsePositiveNumber('0'), null);
});

test('parsePositiveNumber: negativo retorna null', () => {
  assert.equal(parsePositiveNumber('-5'), null);
});

test('parsePositiveNumber: texto não numérico retorna null', () => {
  assert.equal(parsePositiveNumber('abc'), null);
});

test('parsePositiveNumber: string vazia retorna null', () => {
  assert.equal(parsePositiveNumber(''), null);
});

// ── gerarTemplateSheets ───────────────────────────────────────────────────────

test('gerarTemplateSheets: retorna exatamente 6 abas', () => {
  const sheets = gerarTemplateSheets();
  assert.equal(sheets.length, 6);
});

test('gerarTemplateSheets: abas têm os nomes corretos', () => {
  const sheets = gerarTemplateSheets();
  const names = sheets.map((s) => s.name);
  assert.deepEqual(names, ['Fazendas', 'Pastos', 'Lotes', 'Animais', 'Pesagens_Lotes', 'Pesagens_Animais']);
});

test('gerarTemplateSheets: aba Fazendas tem campo nome', () => {
  const sheets = gerarTemplateSheets();
  const fazendas = sheets.find((s) => s.name === 'Fazendas');
  assert.ok(fazendas.columns.some((c) => c.key === 'nome'));
});

test('gerarTemplateSheets: aba Pesagens_Lotes tem campos obrigatórios', () => {
  const sheets = gerarTemplateSheets();
  const pl = sheets.find((s) => s.name === 'Pesagens_Lotes');
  const keys = pl.columns.map((c) => c.key);
  assert.ok(keys.includes('codigo_lote'));
  assert.ok(keys.includes('data_pesagem'));
  assert.ok(keys.includes('peso_medio_kg'));
});

test('gerarTemplateSheets: aba Pesagens_Animais tem campo peso_kg', () => {
  const sheets = gerarTemplateSheets();
  const pa = sheets.find((s) => s.name === 'Pesagens_Animais');
  assert.ok(pa.columns.some((c) => c.key === 'peso_kg'));
});

// ── gerarTemplateArrayBuffer / parsePlanilha (round-trip) ─────────────────────

test('gerarTemplateArrayBuffer: retorna buffer não vazio', () => {
  const data = gerarTemplateArrayBuffer();
  // xlsx pode retornar Uint8Array/Buffer (.length), ArrayBuffer (.byteLength) ou Array
  const tamanho = data?.byteLength ?? data?.length ?? 0;
  assert.ok(data != null && tamanho > 0);
});

test('parsePlanilha: lê o template gerado e retorna as 6 abas', () => {
  const data = gerarTemplateArrayBuffer();
  const result = parsePlanilha(data.buffer ?? data);
  assert.equal(result.ok, true);
  assert.ok(Array.isArray(result.parsed.fazendas));
  assert.ok(Array.isArray(result.parsed.pastos));
  assert.ok(Array.isArray(result.parsed.lotes));
  assert.ok(Array.isArray(result.parsed.animais));
  assert.ok(Array.isArray(result.parsed.pesagens_lotes));
  assert.ok(Array.isArray(result.parsed.pesagens_animais));
});

test('parsePlanilha: linhas de exemplo do template são lidas corretamente', () => {
  const data = gerarTemplateArrayBuffer();
  const result = parsePlanilha(data.buffer ?? data);
  assert.equal(result.ok, true);
  const fazenda = result.parsed.fazendas[0];
  assert.ok(fazenda);
  assert.equal(fazenda.nome, 'Fazenda São João');
});

test('parsePlanilha: arquivo sem abas do HERDON retorna ok=false com mensagem', async () => {
  // Cria um xlsx válido mas com abas diferentes (não são do modelo HERDON)
  const xlsxMod = await import('xlsx');
  const XL = xlsxMod.default ?? xlsxMod;
  const wb = XL.utils.book_new();
  XL.utils.book_append_sheet(wb, XL.utils.aoa_to_sheet([['A', 'B']]), 'Sheet1');
  const data = XL.write(wb, { bookType: 'xlsx', type: 'array' });
  const result = parsePlanilha(data.buffer ?? data);
  assert.equal(result.ok, false);
  assert.ok(result.error);
  assert.equal(result.parsed, null);
});

// ── validarPlanilha — Estrutura ───────────────────────────────────────────────

test('validarPlanilha: planilha vazia não tem erros', () => {
  const result = validarPlanilha(parsed(), emptyDb());
  assert.ok(semErros(result));
});

// ── validarPlanilha — Fazendas ────────────────────────────────────────────────

test('Fazendas: nome ausente gera erro', () => {
  const p = parsed({ fazendas: [{ nome: '', cidade: 'SP' }] });
  const result = validarPlanilha(p, emptyDb());
  const e = erros(result);
  assert.ok(e.some((err) => err.campo === 'nome' && err.linha === 2));
});

test('Fazendas: linha válida não gera erro', () => {
  const p = parsed({ fazendas: [{ nome: 'Fazenda X', cidade: 'GO', estado: 'GO' }] });
  const result = validarPlanilha(p, emptyDb());
  assert.equal(result.erros.fazendas.length, 0);
});

// ── validarPlanilha — Pastos ──────────────────────────────────────────────────

test('Pastos: nome ausente gera erro', () => {
  const p = parsed({
    fazendas: [{ nome: 'Fazenda X' }],
    pastos: [{ nome: '', codigo_fazenda: 'Fazenda X', area_ha: '100' }],
  });
  const result = validarPlanilha(p, emptyDb());
  assert.ok(result.erros.pastos.some((e) => e.campo === 'nome'));
});

test('Pastos: fazenda não encontrada gera erro', () => {
  const p = parsed({ pastos: [{ nome: 'Pasto A', codigo_fazenda: 'Fazenda Inexistente' }] });
  const result = validarPlanilha(p, emptyDb());
  assert.ok(result.erros.pastos.some((e) => e.campo === 'codigo_fazenda'));
});

test('Pastos: fazenda encontrada via aba Fazendas da planilha', () => {
  const p = parsed({
    fazendas: [{ nome: 'Fazenda Nova' }],
    pastos: [{ nome: 'Pasto B', codigo_fazenda: 'Fazenda Nova', area_ha: '50' }],
  });
  const result = validarPlanilha(p, emptyDb());
  assert.equal(result.erros.pastos.length, 0);
});

test('Pastos: fazenda encontrada via db (já cadastrada)', () => {
  const db = { ...emptyDb(), fazendas: [{ id: 1, nome: 'Fazenda Antiga' }] };
  const p = parsed({ pastos: [{ nome: 'Pasto C', codigo_fazenda: 'Fazenda Antiga' }] });
  const result = validarPlanilha(p, db);
  assert.equal(result.erros.pastos.length, 0);
});

test('Pastos: area_ha inválida gera erro', () => {
  const p = parsed({
    fazendas: [{ nome: 'F' }],
    pastos: [{ nome: 'P', codigo_fazenda: 'F', area_ha: '-10' }],
  });
  const result = validarPlanilha(p, emptyDb());
  assert.ok(result.erros.pastos.some((e) => e.campo === 'area_ha'));
});

test('Pastos: area_ha ausente é aceito (campo opcional)', () => {
  const p = parsed({
    fazendas: [{ nome: 'F' }],
    pastos: [{ nome: 'P', codigo_fazenda: 'F', area_ha: '' }],
  });
  const result = validarPlanilha(p, emptyDb());
  assert.equal(result.erros.pastos.length, 0);
});

// ── validarPlanilha — Lotes ───────────────────────────────────────────────────

function loteValido(overrides = {}) {
  return { codigo_lote: 'L1', codigo_fazenda: 'F1', data_entrada: '2024-01-01', quantidade_cabecas: '50', peso_inicial_kg: '300', ...overrides };
}

test('Lotes: linha válida não gera erro', () => {
  const p = parsed({
    fazendas: [{ nome: 'F1' }],
    lotes: [loteValido()],
  });
  const result = validarPlanilha(p, emptyDb());
  assert.equal(result.erros.lotes.length, 0);
});

test('Lotes: codigo_lote ausente gera erro', () => {
  const p = parsed({ fazendas: [{ nome: 'F1' }], lotes: [loteValido({ codigo_lote: '' })] });
  const result = validarPlanilha(p, emptyDb());
  assert.ok(result.erros.lotes.some((e) => e.campo === 'codigo_lote'));
});

test('Lotes: codigo_lote duplicado na planilha gera erro na segunda linha', () => {
  const p = parsed({
    fazendas: [{ nome: 'F1' }],
    lotes: [loteValido(), loteValido()],
  });
  const result = validarPlanilha(p, emptyDb());
  assert.ok(result.erros.lotes.some((e) => e.linha === 3 && e.campo === 'codigo_lote'));
});

test('Lotes: fazenda não encontrada gera erro', () => {
  const p = parsed({ lotes: [loteValido({ codigo_fazenda: 'X' })] });
  const result = validarPlanilha(p, emptyDb());
  assert.ok(result.erros.lotes.some((e) => e.campo === 'codigo_fazenda'));
});

test('Lotes: data_entrada inválida gera erro', () => {
  const p = parsed({ fazendas: [{ nome: 'F1' }], lotes: [loteValido({ data_entrada: '99/99/9999' })] });
  const result = validarPlanilha(p, emptyDb());
  assert.ok(result.erros.lotes.some((e) => e.campo === 'data_entrada'));
});

test('Lotes: data_entrada no formato DD/MM/YYYY é aceita', () => {
  const p = parsed({ fazendas: [{ nome: 'F1' }], lotes: [loteValido({ data_entrada: '15/01/2024' })] });
  const result = validarPlanilha(p, emptyDb());
  assert.equal(result.erros.lotes.filter((e) => e.campo === 'data_entrada').length, 0);
});

test('Lotes: quantidade_cabecas não inteiro gera erro', () => {
  const p = parsed({ fazendas: [{ nome: 'F1' }], lotes: [loteValido({ quantidade_cabecas: '1.5' })] });
  const result = validarPlanilha(p, emptyDb());
  assert.ok(result.erros.lotes.some((e) => e.campo === 'quantidade_cabecas'));
});

test('Lotes: peso_inicial_kg zero gera erro', () => {
  const p = parsed({ fazendas: [{ nome: 'F1' }], lotes: [loteValido({ peso_inicial_kg: '0' })] });
  const result = validarPlanilha(p, emptyDb());
  assert.ok(result.erros.lotes.some((e) => e.campo === 'peso_inicial_kg'));
});

// ── validarPlanilha — Animais ─────────────────────────────────────────────────

function animalValido(overrides = {}) {
  return { brinco: 'BR-001', codigo_lote: 'L1', sexo: 'macho', peso_inicial_kg: '280', ...overrides };
}

test('Animais: linha válida não gera erro', () => {
  const p = parsed({
    fazendas: [{ nome: 'F1' }],
    lotes: [loteValido()],
    animais: [animalValido()],
  });
  const result = validarPlanilha(p, emptyDb());
  assert.equal(result.erros.animais.length, 0);
});

test('Animais: brinco ausente gera erro', () => {
  const p = parsed({ lotes: [loteValido()], animais: [animalValido({ brinco: '' })] });
  const result = validarPlanilha(p, emptyDb());
  assert.ok(result.erros.animais.some((e) => e.campo === 'brinco'));
});

test('Animais: brinco duplicado na planilha gera erro', () => {
  const p = parsed({
    fazendas: [{ nome: 'F1' }],
    lotes: [loteValido()],
    animais: [animalValido(), animalValido()],
  });
  const result = validarPlanilha(p, emptyDb());
  assert.ok(result.erros.animais.some((e) => e.linha === 3 && e.campo === 'brinco'));
});

test('Animais: lote não encontrado gera erro', () => {
  const p = parsed({ animais: [animalValido({ codigo_lote: 'INEXISTENTE' })] });
  const result = validarPlanilha(p, emptyDb());
  assert.ok(result.erros.animais.some((e) => e.campo === 'codigo_lote'));
});

test('Animais: lote encontrado via db gera aceito', () => {
  const db = { ...emptyDb(), lotes: [{ id: 1, nome: 'L1' }] };
  const p = parsed({ animais: [animalValido()] });
  const result = validarPlanilha(p, db);
  assert.equal(result.erros.animais.filter((e) => e.campo === 'codigo_lote').length, 0);
});

test('Animais: peso_inicial_kg opcional — ausente sem erro', () => {
  const p = parsed({
    fazendas: [{ nome: 'F1' }],
    lotes: [loteValido()],
    animais: [animalValido({ peso_inicial_kg: '' })],
  });
  const result = validarPlanilha(p, emptyDb());
  assert.equal(result.erros.animais.filter((e) => e.campo === 'peso_inicial_kg').length, 0);
});

test('Animais: peso_inicial_kg negativo gera erro', () => {
  const p = parsed({
    fazendas: [{ nome: 'F1' }],
    lotes: [loteValido()],
    animais: [animalValido({ peso_inicial_kg: '-100' })],
  });
  const result = validarPlanilha(p, emptyDb());
  assert.ok(result.erros.animais.some((e) => e.campo === 'peso_inicial_kg'));
});

// ── validarPlanilha — Pesagens por Lote ──────────────────────────────────────

function pesLoteValido(overrides = {}) {
  return { codigo_lote: 'L1', data_pesagem: '2024-03-01', peso_medio_kg: '320', quantidade_cabecas: '50', ...overrides };
}

test('Pesagens_Lotes: linha válida não gera erro', () => {
  const p = parsed({ lotes: [loteValido()], pesagens_lotes: [pesLoteValido()] });
  const result = validarPlanilha(p, emptyDb());
  assert.equal(result.erros.pesagens_lotes.length, 0);
});

test('Pesagens_Lotes: lote ausente gera erro', () => {
  const p = parsed({ pesagens_lotes: [pesLoteValido({ codigo_lote: '' })] });
  const result = validarPlanilha(p, emptyDb());
  assert.ok(result.erros.pesagens_lotes.some((e) => e.campo === 'codigo_lote'));
});

test('Pesagens_Lotes: lote não encontrado gera erro', () => {
  const p = parsed({ pesagens_lotes: [pesLoteValido({ codigo_lote: 'FANTASMA' })] });
  const result = validarPlanilha(p, emptyDb());
  assert.ok(result.erros.pesagens_lotes.some((e) => e.campo === 'codigo_lote'));
});

test('Pesagens_Lotes: data ausente gera erro', () => {
  const p = parsed({ lotes: [loteValido()], pesagens_lotes: [pesLoteValido({ data_pesagem: '' })] });
  const result = validarPlanilha(p, emptyDb());
  assert.ok(result.erros.pesagens_lotes.some((e) => e.campo === 'data_pesagem'));
});

test('Pesagens_Lotes: data inválida gera erro', () => {
  const p = parsed({ lotes: [loteValido()], pesagens_lotes: [pesLoteValido({ data_pesagem: 'amanhã' })] });
  const result = validarPlanilha(p, emptyDb());
  assert.ok(result.erros.pesagens_lotes.some((e) => e.campo === 'data_pesagem'));
});

test('Pesagens_Lotes: peso_medio ausente gera erro', () => {
  const p = parsed({ lotes: [loteValido()], pesagens_lotes: [pesLoteValido({ peso_medio_kg: '' })] });
  const result = validarPlanilha(p, emptyDb());
  assert.ok(result.erros.pesagens_lotes.some((e) => e.campo === 'peso_medio_kg'));
});

test('Pesagens_Lotes: peso_medio zero gera erro', () => {
  const p = parsed({ lotes: [loteValido()], pesagens_lotes: [pesLoteValido({ peso_medio_kg: '0' })] });
  const result = validarPlanilha(p, emptyDb());
  assert.ok(result.erros.pesagens_lotes.some((e) => e.campo === 'peso_medio_kg'));
});

test('Pesagens_Lotes: quantidade_cabecas decimal gera erro', () => {
  const p = parsed({ lotes: [loteValido()], pesagens_lotes: [pesLoteValido({ quantidade_cabecas: '3.7' })] });
  const result = validarPlanilha(p, emptyDb());
  assert.ok(result.erros.pesagens_lotes.some((e) => e.campo === 'quantidade_cabecas'));
});

test('Pesagens_Lotes: quantidade_cabecas ausente é aceito (opcional)', () => {
  const p = parsed({ lotes: [loteValido()], pesagens_lotes: [pesLoteValido({ quantidade_cabecas: '' })] });
  const result = validarPlanilha(p, emptyDb());
  assert.equal(result.erros.pesagens_lotes.filter((e) => e.campo === 'quantidade_cabecas').length, 0);
});

test('Pesagens_Lotes: duplicata lote+data no arquivo gera erro na segunda linha', () => {
  const p = parsed({
    lotes: [loteValido()],
    pesagens_lotes: [pesLoteValido(), pesLoteValido()],
  });
  const result = validarPlanilha(p, emptyDb());
  assert.ok(result.erros.pesagens_lotes.some((e) => e.linha === 3));
});

test('Pesagens_Lotes: conflito com pesagem já no HERDON gera erro bloqueante', () => {
  const db = {
    ...emptyDb(),
    lotes: [{ id: 10, nome: 'L1' }],
    pesagens: [{ id: 1, lote_id: 10, tipo: 'lote', data: '2024-03-01' }],
  };
  const p = parsed({ pesagens_lotes: [pesLoteValido()] });
  const result = validarPlanilha(p, db);
  assert.ok(result.erros.pesagens_lotes.some((e) => e.campo === 'data_pesagem'));
});

// ── validarPlanilha — Pesagens por Animal ─────────────────────────────────────

function pesAnimalValido(overrides = {}) {
  return { brinco: 'BR-001', codigo_lote: 'L1', data_pesagem: '2024-03-01', peso_kg: '310', ...overrides };
}

test('Pesagens_Animais: linha válida não gera erro', () => {
  const p = parsed({ animais: [animalValido()], lotes: [loteValido()], pesagens_animais: [pesAnimalValido()] });
  const result = validarPlanilha(p, emptyDb());
  assert.equal(result.erros.pesagens_animais.length, 0);
});

test('Pesagens_Animais: brinco ausente gera erro', () => {
  const p = parsed({ pesagens_animais: [pesAnimalValido({ brinco: '' })] });
  const result = validarPlanilha(p, emptyDb());
  assert.ok(result.erros.pesagens_animais.some((e) => e.campo === 'brinco'));
});

test('Pesagens_Animais: brinco não encontrado gera erro', () => {
  const p = parsed({ pesagens_animais: [pesAnimalValido({ brinco: 'FANTASMA' })] });
  const result = validarPlanilha(p, emptyDb());
  assert.ok(result.erros.pesagens_animais.some((e) => e.campo === 'brinco'));
});

test('Pesagens_Animais: brinco encontrado via aba Animais da planilha', () => {
  const p = parsed({
    fazendas: [{ nome: 'F1' }],
    lotes: [loteValido()],
    animais: [animalValido()],
    pesagens_animais: [pesAnimalValido()],
  });
  const result = validarPlanilha(p, emptyDb());
  assert.equal(result.erros.pesagens_animais.filter((e) => e.campo === 'brinco').length, 0);
});

test('Pesagens_Animais: brinco encontrado via db', () => {
  const db = { ...emptyDb(), animais: [{ id: 1, identificacao: 'BR-001' }] };
  const p = parsed({ pesagens_animais: [pesAnimalValido()] });
  const result = validarPlanilha(p, db);
  assert.equal(result.erros.pesagens_animais.filter((e) => e.campo === 'brinco').length, 0);
});

test('Pesagens_Animais: data ausente gera erro', () => {
  const p = parsed({ animais: [animalValido()], lotes: [loteValido()], pesagens_animais: [pesAnimalValido({ data_pesagem: '' })] });
  const result = validarPlanilha(p, emptyDb());
  assert.ok(result.erros.pesagens_animais.some((e) => e.campo === 'data_pesagem'));
});

test('Pesagens_Animais: data inválida gera erro', () => {
  const p = parsed({ animais: [animalValido()], lotes: [loteValido()], pesagens_animais: [pesAnimalValido({ data_pesagem: 'xxx' })] });
  const result = validarPlanilha(p, emptyDb());
  assert.ok(result.erros.pesagens_animais.some((e) => e.campo === 'data_pesagem'));
});

test('Pesagens_Animais: peso_kg ausente gera erro', () => {
  const p = parsed({ animais: [animalValido()], lotes: [loteValido()], pesagens_animais: [pesAnimalValido({ peso_kg: '' })] });
  const result = validarPlanilha(p, emptyDb());
  assert.ok(result.erros.pesagens_animais.some((e) => e.campo === 'peso_kg'));
});

test('Pesagens_Animais: peso_kg negativo gera erro', () => {
  const p = parsed({ animais: [animalValido()], lotes: [loteValido()], pesagens_animais: [pesAnimalValido({ peso_kg: '-5' })] });
  const result = validarPlanilha(p, emptyDb());
  assert.ok(result.erros.pesagens_animais.some((e) => e.campo === 'peso_kg'));
});

test('Pesagens_Animais: duplicata brinco+data no arquivo gera erro na segunda linha', () => {
  const p = parsed({
    fazendas: [{ nome: 'F1' }],
    lotes: [loteValido()],
    animais: [animalValido()],
    pesagens_animais: [pesAnimalValido(), pesAnimalValido()],
  });
  const result = validarPlanilha(p, emptyDb());
  assert.ok(result.erros.pesagens_animais.some((e) => e.linha === 3));
});

test('Pesagens_Animais: conflito com pesagem já no HERDON gera erro bloqueante', () => {
  const db = {
    ...emptyDb(),
    animais: [{ id: 5, identificacao: 'BR-001' }],
    pesagens: [{ id: 9, animal_id: 5, tipo: 'animal', data: '2024-03-01' }],
  };
  const p = parsed({ pesagens_animais: [pesAnimalValido()] });
  const result = validarPlanilha(p, db);
  assert.ok(result.erros.pesagens_animais.some((e) => e.campo === 'data_pesagem'));
});

test('Pesagens_Animais: codigo_lote é opcional — ausente sem erro', () => {
  const db = { ...emptyDb(), animais: [{ id: 1, identificacao: 'BR-001' }] };
  const p = parsed({ pesagens_animais: [pesAnimalValido({ codigo_lote: '' })] });
  const result = validarPlanilha(p, db);
  assert.equal(result.erros.pesagens_animais.filter((e) => e.campo === 'codigo_lote').length, 0);
});

// ── validarPlanilha — integridade referencial cruzada ─────────────────────────

test('Referencial: pasto com fazenda só na planilha é válido', () => {
  const p = parsed({
    fazendas: [{ nome: 'Nova Fazenda' }],
    pastos: [{ nome: 'Pasto X', codigo_fazenda: 'Nova Fazenda', area_ha: '' }],
  });
  const result = validarPlanilha(p, emptyDb());
  assert.equal(result.erros.pastos.length, 0);
});

test('Referencial: pesagem_lote com lote só na planilha é válido', () => {
  const p = parsed({
    fazendas: [{ nome: 'F1' }],
    lotes: [loteValido()],
    pesagens_lotes: [pesLoteValido()],
  });
  const result = validarPlanilha(p, emptyDb());
  assert.equal(result.erros.pesagens_lotes.length, 0);
});

test('Referencial: pesagem_animal com animal só no db é válido', () => {
  const db = { ...emptyDb(), animais: [{ id: 2, identificacao: 'BR-002' }] };
  const p = parsed({ pesagens_animais: [pesAnimalValido({ brinco: 'BR-002' })] });
  const result = validarPlanilha(p, db);
  assert.equal(result.erros.pesagens_animais.filter((e) => e.campo === 'brinco').length, 0);
});

// ── validarPlanilha — totalErros e temErros ───────────────────────────────────

test('totalErros conta corretamente quando há erros em múltiplas abas', () => {
  const p = parsed({
    fazendas: [{ nome: '' }],
    pastos: [{ nome: '', codigo_fazenda: '' }],
  });
  const result = validarPlanilha(p, emptyDb());
  assert.ok(result.totalErros >= 3);
  assert.equal(result.temErros, true);
});

test('totalErros é 0 e temErros é false sem erros', () => {
  const result = validarPlanilha(parsed(), emptyDb());
  assert.equal(result.totalErros, 0);
  assert.equal(result.temErros, false);
});
